from __future__ import annotations

import asyncio
import json
import logging
import re
import unicodedata
from datetime import UTC, datetime
from typing import Any

import httpx
from pydantic import ValidationError

from app.core.config import settings
from app.db.mongo import mongo_manager
from app.schemas.google_forms import (
    GoogleFormFieldMapping,
    GoogleFormSource,
    GoogleFormStatus,
    GoogleFormSyncResult,
    PublicEntryForm,
)
from app.schemas.players import PromptSource
from app.schemas.prompts import PromptSubmissionCreate
from app.services.players import PlayerError, submit_from_outside

logger = logging.getLogger(__name__)

FORMS_API_BASE_URL = "https://forms.googleapis.com/v1"
SCOPES = [
    "https://www.googleapis.com/auth/forms.body.readonly",
    "https://www.googleapis.com/auth/forms.responses.readonly",
]
SOURCE_COLLECTION = "google_form_source"
SOURCE_DOC_ID = "active"
PROMPT_SOURCE: PromptSource = "google_forms"

# Matched against normalised question titles (lowercase, no diacritics).
# Fields are assigned in this order so "Email gracza" lands on email, not player_id.
FIELD_KEYWORDS: dict[str, tuple[str, ...]] = {
    "prompt_text": ("prompt", "strateg"),
    "email": ("email", "e-mail", "mail"),
    "player_id": ("nick", "gracz", "player", "imie", "name", "nazwa", "login"),
}

_PUBLISHED_LINK_RE = re.compile(r"/forms/d/e/")
_FORM_ID_IN_URL_RE = re.compile(r"/forms/d/([A-Za-z0-9_-]{10,})")
_BARE_FORM_ID_RE = re.compile(r"^[A-Za-z0-9_-]{20,}$")


class GoogleFormsError(Exception):
    """A failure the admin can act on; ``message`` is shown in the admin panel."""

    status_code = 502

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


class InvalidFormLinkError(GoogleFormsError):
    status_code = 400


class FormAccessError(GoogleFormsError):
    status_code = 403


class FormMappingError(GoogleFormsError):
    status_code = 422


class NoFormConnectedError(GoogleFormsError):
    status_code = 404


class ServiceUnavailableError(GoogleFormsError):
    status_code = 503


def parse_form_id(url_or_id: str) -> str:
    value = url_or_id.strip()
    if "forms.gle/" in value:
        raise InvalidFormLinkError(
            "This is a short share link. Open the form in the editor and paste the link from the "
            "address bar (it ends with /edit)."
        )
    if _PUBLISHED_LINK_RE.search(value):
        raise InvalidFormLinkError(
            "This is the players' link (…/forms/d/e/…/viewform). Paste the editor link instead: "
            "open the form for editing and copy the address bar (…/forms/d/<ID>/edit)."
        )
    match = _FORM_ID_IN_URL_RE.search(value)
    if match:
        return match.group(1)
    if _BARE_FORM_ID_RE.match(value):
        return value
    raise InvalidFormLinkError(
        "This does not look like a Google Forms link. Expected https://docs.google.com/forms/d/<ID>/edit."
    )


def edit_url_for(form_id: str) -> str:
    return f"https://docs.google.com/forms/d/{form_id}/edit"


def _normalise(text: str) -> str:
    decomposed = unicodedata.normalize("NFKD", text.lower())
    return "".join(c for c in decomposed if not unicodedata.combining(c)).replace("ł", "l")


def detect_field_mapping(form: dict[str, Any]) -> dict[str, dict[str, str]]:
    """Map PromptAuction fields to form questions by title. Returns {field: {id, title}}."""
    questions: list[tuple[str, str]] = []
    for item in form.get("items", []):
        question = item.get("questionItem", {}).get("question", {})
        question_id = question.get("questionId")
        if question_id:
            questions.append((question_id, item.get("title", "")))

    mapping: dict[str, dict[str, str]] = {}
    taken: set[str] = set()
    for field, keywords in FIELD_KEYWORDS.items():
        for question_id, title in questions:
            if question_id in taken:
                continue
            if any(keyword in _normalise(title) for keyword in keywords):
                mapping[field] = {"id": question_id, "title": title}
                taken.add(question_id)
                break

    missing = [f for f in ("player_id", "prompt_text") if f not in mapping]
    if missing:
        titles = ", ".join(f'"{t}"' for _, t in questions) or "none"
        labels = {"player_id": 'player nick (e.g. "Nick gracza")', "prompt_text": 'prompt (e.g. "Prompt")'}
        wanted = " and ".join(labels[f] for f in missing)
        raise FormMappingError(
            f"Could not find a question for the {wanted}. Question titles in this form: {titles}."
        )
    return mapping


def _text_answer(response: dict[str, Any], question_id: str | None) -> str | None:
    if not question_id:
        return None
    answers = response.get("answers", {}).get(question_id, {}).get("textAnswers", {}).get("answers", [])
    if not answers:
        return None
    value = str(answers[0].get("value", "")).strip()
    return value or None


def _parse_timestamp(value: str | None) -> datetime | None:
    if not value:
        return None
    # Google may send nanosecond precision; fromisoformat accepts at most microseconds.
    trimmed = re.sub(r"(\.\d{6})\d+", r"\1", value)
    try:
        return datetime.fromisoformat(trimmed.replace("Z", "+00:00"))
    except ValueError:
        return None


def load_credentials() -> Any | None:
    """Service account credentials from env, or None when neither variable is set."""
    if not settings.google_service_account_json and not settings.google_service_account_file:
        return None

    from google.oauth2 import service_account

    try:
        if settings.google_service_account_json:
            info = json.loads(settings.google_service_account_json)
            return service_account.Credentials.from_service_account_info(info, scopes=SCOPES)
        return service_account.Credentials.from_service_account_file(
            settings.google_service_account_file, scopes=SCOPES
        )
    except (OSError, ValueError, KeyError) as e:
        raise ServiceUnavailableError(f"Could not load the Google service account key: {e}") from e


class GoogleFormsClient:
    """Minimal async client for the two Forms API calls we need."""

    def __init__(
        self,
        credentials: Any,
        transport: httpx.AsyncBaseTransport | None = None,
        base_url: str = FORMS_API_BASE_URL,
    ) -> None:
        self._credentials = credentials
        self._transport = transport
        self._base_url = base_url

    @property
    def service_account_email(self) -> str | None:
        return getattr(self._credentials, "service_account_email", None)

    def _refresh(self) -> None:
        from google.auth.exceptions import GoogleAuthError
        from google.auth.transport.requests import Request

        try:
            self._credentials.refresh(Request())
        except GoogleAuthError as e:
            raise ServiceUnavailableError(f"Google rejected the service account key: {e}") from e

    async def _get(self, path: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        if not self._credentials.valid:
            await asyncio.to_thread(self._refresh)
        headers = {"Authorization": f"Bearer {self._credentials.token}"}

        async with httpx.AsyncClient(
            base_url=self._base_url, transport=self._transport, timeout=15.0
        ) as http:
            try:
                resp = await http.get(path, params=params, headers=headers)
            except httpx.HTTPError as e:
                raise GoogleFormsError(f"Could not reach the Google Forms API: {e}") from e

        if resp.status_code < 400:
            data: dict[str, Any] = resp.json()
            return data

        if "SERVICE_DISABLED" in resp.text or "has not been used" in resp.text:
            raise ServiceUnavailableError(
                "The Google Forms API is not enabled in the service account's Google Cloud project."
            )
        if resp.status_code in (403, 404):
            raise FormAccessError(
                "No access to this form. Share it with the service account "
                f"({self.service_account_email or 'see the admin panel'}) as an editor, then try again."
            )
        if resp.status_code == 400:
            raise InvalidFormLinkError(
                "Google did not recognise this form ID. Paste the link from the form editor's address bar."
            )
        raise GoogleFormsError(f"Google Forms API returned HTTP {resp.status_code}.")

    async def get_form(self, form_id: str) -> dict[str, Any]:
        return await self._get(f"/forms/{form_id}")

    async def list_responses(self, form_id: str) -> list[dict[str, Any]]:
        responses: list[dict[str, Any]] = []
        page_token: str | None = None
        while True:
            params: dict[str, Any] = {"pageSize": 5000}
            if page_token:
                params["pageToken"] = page_token
            page = await self._get(f"/forms/{form_id}/responses", params=params)
            responses.extend(page.get("responses", []))
            page_token = page.get("nextPageToken")
            if not page_token:
                return responses


class GoogleFormsService:
    """Pulls player prompts from the Google Form the admin connected, into the prompts collection."""

    def __init__(self) -> None:
        self._client: GoogleFormsClient | None = None
        self._lock = asyncio.Lock()
        self._task: asyncio.Task[None] | None = None

    def _get_client(self) -> GoogleFormsClient:
        if self._client is None:
            credentials = load_credentials()
            if credentials is None:
                raise ServiceUnavailableError(
                    "No Google service account is configured on the server "
                    "(set GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_SERVICE_ACCOUNT_FILE)."
                )
            self._client = GoogleFormsClient(credentials)
        return self._client

    @staticmethod
    def _require_db() -> Any:
        db = mongo_manager.db
        if db is None:
            raise ServiceUnavailableError("Database not connected")
        return db

    async def status(self) -> GoogleFormStatus:
        credentials_error: str | None = None
        email: str | None = None
        try:
            email = self._get_client().service_account_email
        except GoogleFormsError as e:
            credentials_error = e.message

        form: GoogleFormSource | None = None
        db = mongo_manager.db
        if db is not None:
            doc = await db[SOURCE_COLLECTION].find_one({"_id": SOURCE_DOC_ID})
            if doc is not None:
                doc.pop("_id", None)
                form = GoogleFormSource(**doc)

        return GoogleFormStatus(
            credentials_configured=credentials_error is None,
            credentials_error=credentials_error,
            service_account_email=email,
            poll_interval_seconds=settings.google_forms_poll_seconds,
            form=form,
        )

    async def public_entry_form(self) -> PublicEntryForm | None:
        db = mongo_manager.db
        if db is None:
            return None
        doc = await db[SOURCE_COLLECTION].find_one({"_id": SOURCE_DOC_ID})
        if doc is None or not doc.get("responder_url"):
            return None
        return PublicEntryForm(title=doc["title"], responder_url=doc["responder_url"])

    async def connect(self, url: str) -> GoogleFormStatus:
        form_id = parse_form_id(url)
        client = self._get_client()
        db = self._require_db()

        form = await client.get_form(form_id)
        mapping = detect_field_mapping(form)

        source = GoogleFormSource(
            form_id=form_id,
            title=form.get("info", {}).get("title") or form.get("info", {}).get("documentTitle") or form_id,
            edit_url=edit_url_for(form_id),
            responder_url=form.get("responderUri"),
            connected_at=datetime.now(UTC),
            mapping=GoogleFormFieldMapping(**{field: q["title"] for field, q in mapping.items()}),
        )
        doc = source.model_dump() | {"_id": SOURCE_DOC_ID}
        await db[SOURCE_COLLECTION].replace_one({"_id": SOURCE_DOC_ID}, doc, upsert=True)
        logger.info("Google Form connected: %s (%s)", source.title, form_id)

        try:
            await self.sync_once()
        except GoogleFormsError:
            pass  # recorded as last_error; the form itself is connected
        return await self.status()

    async def disconnect(self) -> None:
        db = self._require_db()
        await db[SOURCE_COLLECTION].delete_one({"_id": SOURCE_DOC_ID})

    async def sync_once(self) -> GoogleFormSyncResult:
        async with self._lock:
            db = self._require_db()
            state = await db[SOURCE_COLLECTION].find_one({"_id": SOURCE_DOC_ID})
            if state is None:
                raise NoFormConnectedError("No Google Form is connected.")
            form_id: str = state["form_id"]

            try:
                client = self._get_client()
                form = await client.get_form(form_id)
                mapping = detect_field_mapping(form)
                responses = await client.list_responses(form_id)
            except GoogleFormsError as e:
                await db[SOURCE_COLLECTION].update_one(
                    {"_id": SOURCE_DOC_ID}, {"$set": {"last_error": e.message}}
                )
                raise

            imported, skipped = await self._import_responses(db, form_id, mapping, responses)
            imported_total = await db.prompts.count_documents({"source": PROMPT_SOURCE})
            await db[SOURCE_COLLECTION].update_one(
                {"_id": SOURCE_DOC_ID},
                {
                    "$set": {
                        "title": form.get("info", {}).get("title") or state.get("title", form_id),
                        "responder_url": form.get("responderUri") or state.get("responder_url"),
                        "mapping": {field: q["title"] for field, q in mapping.items()},
                        "last_synced_at": datetime.now(UTC),
                        "last_error": None,
                        "imported_count": imported_total,
                        "skipped_count": skipped,
                    }
                },
            )
            if imported:
                logger.info("Imported %d new prompt(s) from Google Form %s", imported, form_id)
            return GoogleFormSyncResult(imported=imported, skipped=skipped)

    @staticmethod
    async def _import_responses(
        db: Any,
        form_id: str,
        mapping: dict[str, dict[str, str]],
        responses: list[dict[str, Any]],
    ) -> tuple[int, int]:
        response_ids = [r["responseId"] for r in responses if r.get("responseId")]
        existing_docs = await db.prompts.find(
            {"form_response_id": {"$in": response_ids}}, {"form_response_id": 1}
        ).to_list(length=None)
        existing = {d["form_response_id"] for d in existing_docs}

        imported = skipped = 0
        now = datetime.now(UTC)
        for response in responses:
            response_id = response.get("responseId")
            if not response_id or response_id in existing:
                continue

            player_id = _text_answer(response, mapping["player_id"]["id"])
            email = _text_answer(response, mapping.get("email", {}).get("id")) or response.get(
                "respondentEmail"
            )
            try:
                if not player_id:
                    raise ValueError("missing player id")
                payload = PromptSubmissionCreate(
                    player_id=player_id,
                    prompt_text=_text_answer(response, mapping["prompt_text"]["id"]) or "",
                    email=email,
                    form_response_id=response_id,
                )
            except (ValidationError, ValueError):
                skipped += 1
                continue

            submitted_at = _parse_timestamp(response.get("lastSubmittedTime") or response.get("createTime"))
            try:
                result = await submit_from_outside(
                    db,
                    name=payload.player_id,
                    email=payload.email,
                    prompt_text=payload.prompt_text,
                    form_response_id=response_id,
                    source=PROMPT_SOURCE,
                    submitted_at=submitted_at or now,
                )
            except PlayerError:
                skipped += 1
                continue
            if not result.created:
                continue
            imported += 1
        return imported, skipped

    async def _has_source(self) -> bool:
        db = mongo_manager.db
        if db is None:
            return False
        return await db[SOURCE_COLLECTION].count_documents({"_id": SOURCE_DOC_ID}) > 0

    async def run(self) -> None:
        while True:
            try:
                if await self._has_source():
                    await self.sync_once()
            except GoogleFormsError as e:
                logger.warning("Google Form sync failed: %s", e.message)
            except Exception:
                logger.exception("Unexpected error while syncing the Google Form")
            await asyncio.sleep(settings.google_forms_poll_seconds)

    def start(self) -> None:
        if self._task is None or self._task.done():
            self._task = asyncio.create_task(self.run())

    async def stop(self) -> None:
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        self._task = None


google_forms_service = GoogleFormsService()
