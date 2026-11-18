from __future__ import annotations

import asyncio
import json
from collections.abc import Callable
from datetime import UTC, datetime
from typing import Any

import httpx
import pytest
from httpx import AsyncClient
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.config import settings
from app.services import google_forms as gf
from app.services.google_forms import (
    FormAccessError,
    FormMappingError,
    GoogleFormsClient,
    GoogleFormsError,
    InvalidFormLinkError,
    ServiceUnavailableError,
    google_forms_service,
)

FORM_ID = "1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789"
EDIT_URL = f"https://docs.google.com/forms/d/{FORM_ID}/edit"

FORM = {
    "formId": FORM_ID,
    "info": {"title": "PromptAuction — zgłoszenia"},
    "responderUri": "https://docs.google.com/forms/d/e/1FAIpQL-public/viewform",
    "items": [
        {"title": "Nick gracza", "questionItem": {"question": {"questionId": "q_player"}}},
        {"title": "Adres e-mail", "questionItem": {"question": {"questionId": "q_email"}}},
        {"title": "Twój prompt (strategia)", "questionItem": {"question": {"questionId": "q_prompt"}}},
        {"title": "Section header without a question"},
    ],
}


def _answer(value: str) -> dict[str, Any]:
    return {"textAnswers": {"answers": [{"value": value}]}}


def _response(response_id: str, player: str | None, prompt: str | None, email: str | None = None) -> dict:
    answers: dict[str, Any] = {}
    if player is not None:
        answers["q_player"] = _answer(player)
    if prompt is not None:
        answers["q_prompt"] = _answer(prompt)
    if email is not None:
        answers["q_email"] = _answer(email)
    return {
        "responseId": response_id,
        "lastSubmittedTime": "2026-11-18T10:00:00.123456789Z",
        "answers": answers,
    }


class FakeCredentials:
    def __init__(self, valid: bool = True, refresh_error: Exception | None = None) -> None:
        self.valid = valid
        self.token = "token-1" if valid else None
        self.service_account_email = "promptauction@project.iam.gserviceaccount.com"
        self._refresh_error = refresh_error
        self.refreshed = False

    def refresh(self, _request: Any) -> None:
        if self._refresh_error:
            raise self._refresh_error
        self.valid = True
        self.token = "token-refreshed"
        self.refreshed = True


Handler = Callable[[httpx.Request], httpx.Response]


def _google(form: dict | None = None, pages: list[dict] | None = None) -> Handler:
    form = form if form is not None else FORM
    pages = pages if pages is not None else [{"responses": []}]

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/responses"):
            token = request.url.params.get("pageToken")
            index = int(token) if token else 0
            return httpx.Response(200, json=pages[index])
        return httpx.Response(200, json=form)

    return handler


def _install_client(handler: Handler, credentials: FakeCredentials | None = None) -> GoogleFormsClient:
    client = GoogleFormsClient(credentials or FakeCredentials(), transport=httpx.MockTransport(handler))
    google_forms_service._client = client
    return client


# ── Link parsing & field mapping ──────────────────────────────────────────────


@pytest.mark.parametrize(
    "value",
    [EDIT_URL, f"https://docs.google.com/forms/d/{FORM_ID}/edit#responses", f"  {FORM_ID}  "],
)
def test_parse_form_id_accepts_editor_links_and_bare_ids(value: str) -> None:
    assert gf.parse_form_id(value) == FORM_ID


@pytest.mark.parametrize(
    ("value", "hint"),
    [
        ("https://docs.google.com/forms/d/e/1FAIpQLSf/viewform", "players' link"),
        ("https://forms.gle/abc123", "short share link"),
        ("https://example.com/not-a-form", "does not look like"),
    ],
)
def test_parse_form_id_rejects_unusable_links(value: str, hint: str) -> None:
    with pytest.raises(InvalidFormLinkError, match=hint):
        gf.parse_form_id(value)


def test_detect_field_mapping_matches_polish_titles_with_diacritics() -> None:
    form = {
        "items": [
            {"title": "Imię", "questionItem": {"question": {"questionId": "a"}}},
            {"title": "Email gracza", "questionItem": {"question": {"questionId": "b"}}},
            {"title": "Strategia", "questionItem": {"question": {"questionId": "c"}}},
        ]
    }
    mapping = gf.detect_field_mapping(form)
    assert mapping["player_id"]["id"] == "a"
    assert mapping["email"]["id"] == "b"
    assert mapping["prompt_text"]["id"] == "c"


def test_detect_field_mapping_reports_missing_questions_with_titles() -> None:
    form = {"items": [{"title": "Ulubiony kolor", "questionItem": {"question": {"questionId": "a"}}}]}
    with pytest.raises(FormMappingError, match='"Ulubiony kolor"') as exc:
        gf.detect_field_mapping(form)
    assert "player nick" in exc.value.message
    assert "prompt" in exc.value.message


def test_detect_field_mapping_on_empty_form() -> None:
    with pytest.raises(FormMappingError, match="none"):
        gf.detect_field_mapping({})


def test_parse_timestamp_variants() -> None:
    assert gf._parse_timestamp("2026-11-18T10:00:00.123456789Z") == datetime(
        2026, 11, 18, 10, 0, 0, 123456, tzinfo=UTC
    )
    assert gf._parse_timestamp(None) is None
    assert gf._parse_timestamp("not a date") is None


# ── Credentials ───────────────────────────────────────────────────────────────


def test_load_credentials_returns_none_when_unconfigured(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "google_service_account_json", "")
    monkeypatch.setattr(settings, "google_service_account_file", "")
    assert gf.load_credentials() is None


def test_load_credentials_rejects_bad_json(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "google_service_account_json", "{not json")
    with pytest.raises(ServiceUnavailableError, match="Could not load"):
        gf.load_credentials()


def test_load_credentials_rejects_missing_file(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "google_service_account_json", "")
    monkeypatch.setattr(settings, "google_service_account_file", "/nonexistent/key.json")
    with pytest.raises(ServiceUnavailableError, match="Could not load"):
        gf.load_credentials()


def test_load_credentials_from_json_and_file(monkeypatch: pytest.MonkeyPatch, tmp_path: Any) -> None:
    from google.oauth2 import service_account

    calls: list[tuple[str, Any]] = []
    monkeypatch.setattr(
        service_account.Credentials,
        "from_service_account_info",
        classmethod(lambda cls, info, scopes: calls.append(("info", info)) or "creds-info"),
    )
    monkeypatch.setattr(
        service_account.Credentials,
        "from_service_account_file",
        classmethod(lambda cls, path, scopes: calls.append(("file", path)) or "creds-file"),
    )

    monkeypatch.setattr(settings, "google_service_account_json", json.dumps({"type": "service_account"}))
    assert gf.load_credentials() == "creds-info"

    monkeypatch.setattr(settings, "google_service_account_json", "")
    monkeypatch.setattr(settings, "google_service_account_file", str(tmp_path / "key.json"))
    assert gf.load_credentials() == "creds-file"
    assert [c[0] for c in calls] == ["info", "file"]


# ── HTTP client ───────────────────────────────────────────────────────────────


async def test_client_paginates_responses_and_sends_bearer_token() -> None:
    seen_auth: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen_auth.append(request.headers["Authorization"])
        if request.url.params.get("pageToken") == "2":
            return httpx.Response(200, json={"responses": [{"responseId": "r2"}]})
        return httpx.Response(200, json={"responses": [{"responseId": "r1"}], "nextPageToken": "2"})

    client = GoogleFormsClient(FakeCredentials(), transport=httpx.MockTransport(handler))
    responses = await client.list_responses(FORM_ID)
    assert [r["responseId"] for r in responses] == ["r1", "r2"]
    assert seen_auth == ["Bearer token-1", "Bearer token-1"]


async def test_client_refreshes_expired_token() -> None:
    creds = FakeCredentials(valid=False)
    client = GoogleFormsClient(creds, transport=httpx.MockTransport(_google()))
    await client.get_form(FORM_ID)
    assert creds.refreshed is True


async def test_client_reports_rejected_key() -> None:
    from google.auth.exceptions import RefreshError

    creds = FakeCredentials(valid=False, refresh_error=RefreshError("invalid_grant"))
    client = GoogleFormsClient(creds, transport=httpx.MockTransport(_google()))
    with pytest.raises(ServiceUnavailableError, match="rejected the service account key"):
        await client.get_form(FORM_ID)


@pytest.mark.parametrize(
    ("status", "body", "error", "match"),
    [
        (403, "PERMISSION_DENIED", FormAccessError, "promptauction@project.iam.gserviceaccount.com"),
        (404, "NOT_FOUND", FormAccessError, "Share it with the service account"),
        (403, '{"reason": "SERVICE_DISABLED"}', ServiceUnavailableError, "not enabled"),
        (400, "INVALID_ARGUMENT", InvalidFormLinkError, "did not recognise"),
        (500, "boom", GoogleFormsError, "HTTP 500"),
    ],
)
async def test_client_maps_google_errors(status: int, body: str, error: type, match: str) -> None:
    client = GoogleFormsClient(
        FakeCredentials(), transport=httpx.MockTransport(lambda _r: httpx.Response(status, text=body))
    )
    with pytest.raises(error, match=match):
        await client.get_form(FORM_ID)


async def test_client_reports_network_errors() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("offline", request=request)

    client = GoogleFormsClient(FakeCredentials(), transport=httpx.MockTransport(handler))
    with pytest.raises(GoogleFormsError, match="Could not reach"):
        await client.get_form(FORM_ID)


# ── Admin API ─────────────────────────────────────────────────────────────────


async def test_status_without_credentials(client: AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "google_service_account_json", "")
    monkeypatch.setattr(settings, "google_service_account_file", "")
    resp = await client.get("/api/admin/google-form")
    assert resp.status_code == 200
    body = resp.json()
    assert body["credentials_configured"] is False
    assert "GOOGLE_SERVICE_ACCOUNT_JSON" in body["credentials_error"]
    assert body["service_account_email"] is None
    assert body["form"] is None


async def test_connect_without_credentials_is_503(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "google_service_account_json", "")
    monkeypatch.setattr(settings, "google_service_account_file", "")
    resp = await client.put("/api/admin/google-form", json={"url": EDIT_URL})
    assert resp.status_code == 503


async def test_connect_rejects_players_link(client: AsyncClient) -> None:
    _install_client(_google())
    resp = await client.put(
        "/api/admin/google-form", json={"url": "https://docs.google.com/forms/d/e/1FAIpQLSf/viewform"}
    )
    assert resp.status_code == 400
    assert "editor link" in resp.json()["detail"]


async def test_connect_reports_missing_access(client: AsyncClient) -> None:
    _install_client(lambda _r: httpx.Response(403, text="PERMISSION_DENIED"))
    resp = await client.put("/api/admin/google-form", json={"url": EDIT_URL})
    assert resp.status_code == 403
    assert "as an editor" in resp.json()["detail"]


async def test_connect_reports_unmappable_form(client: AsyncClient) -> None:
    _install_client(_google(form={"info": {"title": "x"}, "items": []}))
    resp = await client.put("/api/admin/google-form", json={"url": EDIT_URL})
    assert resp.status_code == 422


async def test_connect_imports_existing_responses(client: AsyncClient, mock_db: AsyncIOMotorDatabase) -> None:
    pages = [
        {
            "responses": [
                _response("r1", "Alice", "Bid high on anything shiny.", "alice@example.com"),
                {**_response("r2", "Bob", "Never bid above 10."), "respondentEmail": "bob@example.com"},
                _response("r3", None, "No nick given"),
                _response("r4", "Carol", "x"),  # too short for the prompt schema
                {"answers": {}},  # no responseId at all
            ]
        }
    ]
    _install_client(_google(pages=pages))

    resp = await client.put("/api/admin/google-form", json={"url": EDIT_URL})
    assert resp.status_code == 200
    body = resp.json()
    assert body["credentials_configured"] is True
    assert body["service_account_email"] == "promptauction@project.iam.gserviceaccount.com"
    form = body["form"]
    assert form["form_id"] == FORM_ID
    assert form["title"] == "PromptAuction — zgłoszenia"
    assert form["edit_url"] == EDIT_URL
    assert form["imported_count"] == 2
    assert form["skipped_count"] == 2
    assert form["last_error"] is None
    assert form["mapping"] == {
        "player_id": "Nick gracza",
        "prompt_text": "Twój prompt (strategia)",
        "email": "Adres e-mail",
    }

    prompts = await mock_db.prompts.find({}).sort("form_response_id", 1).to_list(length=None)
    assert [(p["player_id"], p["email"], p["status"]) for p in prompts] == [
        ("Alice", "alice@example.com", "pending"),
        ("Bob", "bob@example.com", "pending"),
    ]
    assert prompts[0]["source"] == "google_forms"
    # BSON dates have millisecond precision; the form's submission time is kept, not the import time.
    assert prompts[0]["created_at"] == datetime(2026, 11, 18, 10, 0, 0, 123000)

    listed = await client.get("/api/prompts", params={"status_filter": "pending"})
    assert {p["player_id"] for p in listed.json()} == {"Alice", "Bob"}


async def test_sync_only_imports_new_responses(client: AsyncClient, mock_db: AsyncIOMotorDatabase) -> None:
    pages = [{"responses": [_response("r1", "Alice", "First prompt")]}]
    _install_client(_google(pages=pages))
    await client.put("/api/admin/google-form", json={"url": EDIT_URL})

    pages[0]["responses"].append(_response("r2", "Bob", "Second prompt"))
    resp = await client.post("/api/admin/google-form/sync")
    assert resp.json() == {"imported": 1, "skipped": 0}

    resp = await client.post("/api/admin/google-form/sync")
    assert resp.json() == {"imported": 0, "skipped": 0}
    assert await mock_db.prompts.count_documents({}) == 2


async def test_sync_skips_response_already_received_by_webhook(
    client: AsyncClient, mock_db: AsyncIOMotorDatabase
) -> None:
    await client.post(
        "/api/prompts/webhook",
        json={"player_id": "Alice", "prompt_text": "From the webhook", "form_response_id": "r1"},
    )
    _install_client(_google(pages=[{"responses": [_response("r1", "Alice", "From the form")]}]))
    await client.put("/api/admin/google-form", json={"url": EDIT_URL})
    assert await mock_db.prompts.count_documents({}) == 1


async def test_sync_tolerates_duplicate_key_race(
    client: AsyncClient, mock_db: AsyncIOMotorDatabase, monkeypatch: pytest.MonkeyPatch
) -> None:
    from pymongo.errors import DuplicateKeyError

    _install_client(_google(pages=[{"responses": [_response("r1", "Alice", "A prompt")]}]))

    async def _raise(_self: object, _doc: dict) -> None:
        raise DuplicateKeyError("dup")

    # mongomock_motor hands out a fresh collection wrapper per attribute access, so patch the class.
    monkeypatch.setattr(type(mock_db.prompts), "insert_one", _raise)
    resp = await client.put("/api/admin/google-form", json={"url": EDIT_URL})
    assert resp.status_code == 200
    assert resp.json()["form"]["imported_count"] == 0


async def test_sync_failure_is_recorded_on_the_source(client: AsyncClient) -> None:
    _install_client(_google())
    await client.put("/api/admin/google-form", json={"url": EDIT_URL})

    _install_client(lambda _r: httpx.Response(403, text="PERMISSION_DENIED"))
    resp = await client.post("/api/admin/google-form/sync")
    assert resp.status_code == 403

    status = (await client.get("/api/admin/google-form")).json()
    assert "No access to this form" in status["form"]["last_error"]


async def test_connect_keeps_form_when_first_sync_fails(client: AsyncClient) -> None:
    calls = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/responses"):
            return httpx.Response(500, text="boom")
        calls["n"] += 1
        return httpx.Response(200, json=FORM)

    _install_client(handler)
    resp = await client.put("/api/admin/google-form", json={"url": EDIT_URL})
    assert resp.status_code == 200
    assert resp.json()["form"]["last_error"] == "Google Forms API returned HTTP 500."


async def test_sync_without_connected_form_is_404(client: AsyncClient) -> None:
    _install_client(_google())
    resp = await client.post("/api/admin/google-form/sync")
    assert resp.status_code == 404


async def test_disconnect_and_public_entry_form(client: AsyncClient) -> None:
    assert (await client.get("/api/entry-form")).status_code == 404

    _install_client(_google())
    await client.put("/api/admin/google-form", json={"url": EDIT_URL})
    public = await client.get("/api/entry-form")
    assert public.json() == {
        "title": "PromptAuction — zgłoszenia",
        "responder_url": "https://docs.google.com/forms/d/e/1FAIpQL-public/viewform",
    }

    assert (await client.delete("/api/admin/google-form")).status_code == 204
    assert (await client.get("/api/admin/google-form")).json()["form"] is None
    assert (await client.get("/api/entry-form")).status_code == 404


async def test_endpoints_without_db(client_no_db: AsyncClient) -> None:
    _install_client(_google())
    assert (await client_no_db.put("/api/admin/google-form", json={"url": EDIT_URL})).status_code == 503
    assert (await client_no_db.post("/api/admin/google-form/sync")).status_code == 503
    assert (await client_no_db.delete("/api/admin/google-form")).status_code == 503
    assert (await client_no_db.get("/api/entry-form")).status_code == 404
    assert (await client_no_db.get("/api/admin/google-form")).json()["form"] is None


# ── Background poller ─────────────────────────────────────────────────────────


async def _run_one_iteration(monkeypatch: pytest.MonkeyPatch) -> None:
    async def _stop(_seconds: float) -> None:
        raise asyncio.CancelledError

    monkeypatch.setattr(gf.asyncio, "sleep", _stop)
    with pytest.raises(asyncio.CancelledError):
        await google_forms_service.run()


async def test_poller_syncs_connected_form(
    client: AsyncClient, mock_db: AsyncIOMotorDatabase, monkeypatch: pytest.MonkeyPatch
) -> None:
    pages = [{"responses": []}]
    _install_client(_google(pages=pages))
    await client.put("/api/admin/google-form", json={"url": EDIT_URL})

    pages[0]["responses"].append(_response("r1", "Alice", "Late entry"))
    await _run_one_iteration(monkeypatch)
    assert await mock_db.prompts.count_documents({}) == 1


@pytest.mark.parametrize("failure", [FormAccessError("nope"), RuntimeError("unexpected")])
async def test_poller_survives_failures(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch, failure: Exception
) -> None:
    _install_client(_google())
    await client.put("/api/admin/google-form", json={"url": EDIT_URL})

    async def _fail() -> None:
        raise failure

    monkeypatch.setattr(google_forms_service, "sync_once", _fail)
    await _run_one_iteration(monkeypatch)


async def test_poller_idles_without_db(monkeypatch: pytest.MonkeyPatch) -> None:
    await _run_one_iteration(monkeypatch)


async def test_start_and_stop(monkeypatch: pytest.MonkeyPatch) -> None:
    started = asyncio.Event()

    async def _run() -> None:
        started.set()
        await asyncio.Event().wait()

    monkeypatch.setattr(google_forms_service, "run", _run)
    google_forms_service.start()
    google_forms_service.start()  # idempotent while running
    await started.wait()
    await google_forms_service.stop()
    assert google_forms_service._task is None
    await google_forms_service.stop()  # no-op when not running
