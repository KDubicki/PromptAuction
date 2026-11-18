from __future__ import annotations

from datetime import UTC, datetime
from typing import Any, NamedTuple

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo.errors import DuplicateKeyError

from app.schemas.players import PlayerDetailOut, PlayerOut, PromptSource, PromptVersionOut
from app.schemas.prompts import PromptStatus

VERSION_INSERT_ATTEMPTS = 3
LOCKING_SESSION_STATUSES = ["pending", "running", "paused"]


class PlayerError(Exception):
    status_code = 500

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


class PlayerNotFoundError(PlayerError):
    status_code = 404


class PlayerConflictError(PlayerError):
    status_code = 409


class DuplicateFormResponseError(Exception):
    """A version with this form_response_id already exists, so the submission was already imported."""


class SubmissionResult(NamedTuple):
    version: dict | None
    created: bool
    ignored: bool


def _is_form_response_duplicate(exc: DuplicateKeyError) -> bool:
    details = exc.details or {}
    key_pattern = details.get("keyPattern") or {}
    return "form_response_id" in key_pattern or "form_response_id" in str(exc)


def name_key(name: str) -> str:
    return name.strip().casefold()


def email_key(email: str | None) -> str | None:
    if email is None:
        return None
    return email.strip().casefold() or None


def _clean_email(email: str | None) -> str | None:
    if email is None:
        return None
    return email.strip() or None


async def _ensure_name_free(db: AsyncIOMotorDatabase, key: str, exclude_id: ObjectId | None = None) -> None:
    query: dict[str, Any] = {"$or": [{"name_key": key}, {"former_name_keys": key}]}
    if exclude_id is not None:
        query["_id"] = {"$ne": exclude_id}
    if await db.players.find_one(query) is not None:
        raise PlayerConflictError("A player with this name already exists")


async def _ensure_email_free(
    db: AsyncIOMotorDatabase, key: str | None, exclude_id: ObjectId | None = None
) -> None:
    if key is None:
        return
    query: dict[str, Any] = {"email_key": key}
    if exclude_id is not None:
        query["_id"] = {"$ne": exclude_id}
    if await db.players.find_one(query) is not None:
        raise PlayerConflictError("A player with this email already exists")


async def get_player(db: AsyncIOMotorDatabase, player_id: str) -> dict:
    try:
        oid = ObjectId(player_id)
    except Exception as exc:
        raise PlayerNotFoundError("Player not found") from exc
    player = await db.players.find_one({"_id": oid})
    if player is None:
        raise PlayerNotFoundError("Player not found")
    return player


async def create_player(db: AsyncIOMotorDatabase, name: str, email: str | None, prompt_text: str) -> dict:
    name = name.strip()
    email = _clean_email(email)
    key = name_key(name)
    ekey = email_key(email)
    await _ensure_name_free(db, key)
    await _ensure_email_free(db, ekey)

    now = datetime.now(UTC)
    doc: dict[str, Any] = {
        "name": name,
        "name_key": key,
        "former_name_keys": [],
        "current_version_id": None,
        "created_at": now,
        "updated_at": now,
    }
    if email is not None and ekey is not None:
        doc["email"] = email
        doc["email_key"] = ekey
    try:
        result = await db.players.insert_one(doc)
    except DuplicateKeyError as exc:
        raise PlayerConflictError("A player with this name or email already exists") from exc
    doc["_id"] = result.inserted_id

    try:
        await add_version(db, doc, prompt_text, status="accepted", source="admin", name_at_version=name)
    except Exception:
        await db.players.delete_one({"_id": doc["_id"]})
        raise
    return await get_player(db, str(doc["_id"]))


async def add_version(
    db: AsyncIOMotorDatabase,
    player: dict,
    prompt_text: str,
    *,
    status: PromptStatus,
    source: PromptSource,
    name_at_version: str,
    email: str | None = None,
    form_response_id: str | None = None,
    identity_warning: str | None = None,
    submitted_at: datetime | None = None,
) -> dict:
    player_ref = str(player["_id"])
    now = submitted_at or datetime.now(UTC)
    for attempt in range(VERSION_INSERT_ATTEMPTS):
        latest = await db.prompts.find_one({"player_ref": player_ref}, sort=[("version", -1)])
        doc: dict[str, Any] = {
            "player_id": name_at_version,
            "player_ref": player_ref,
            "version": (latest["version"] if latest else 0) + 1,
            "source": source,
            "status": status,
            "prompt_text": prompt_text,
            "created_at": now,
            "updated_at": now,
        }
        if email is not None:
            doc["email"] = email
        if form_response_id is not None:
            doc["form_response_id"] = form_response_id
        if identity_warning is not None:
            doc["identity_warning"] = identity_warning
        try:
            result = await db.prompts.insert_one(doc)
        except DuplicateKeyError as exc:
            if _is_form_response_duplicate(exc):
                raise DuplicateFormResponseError(form_response_id) from exc
            if attempt == VERSION_INSERT_ATTEMPTS - 1:
                raise PlayerConflictError("Could not assign a version number, try again") from None
            continue
        doc["_id"] = result.inserted_id
        if status == "accepted":
            await recompute_current_version(db, player_ref)
        return doc
    raise PlayerConflictError("Could not assign a version number, try again")


async def _find_player_for_submission(
    db: AsyncIOMotorDatabase, name_k: str, email_k: str | None
) -> tuple[dict | None, bool]:
    if email_k is not None:
        player = await db.players.find_one({"email_key": email_k})
        if player is not None:
            return player, True
    player = await db.players.find_one({"name_key": name_k})
    if player is None:
        player = await db.players.find_one({"former_name_keys": name_k})
    return player, False


async def _create_pending_player(db: AsyncIOMotorDatabase, name: str, email: str | None) -> dict:
    ekey = email_key(email)
    now = datetime.now(UTC)
    doc: dict[str, Any] = {
        "name": name,
        "name_key": name_key(name),
        "former_name_keys": [],
        "current_version_id": None,
        "created_at": now,
        "updated_at": now,
    }
    if email is not None and ekey is not None:
        doc["email"] = email
        doc["email_key"] = ekey
    result = await db.players.insert_one(doc)
    doc["_id"] = result.inserted_id
    return doc


async def submit_from_outside(
    db: AsyncIOMotorDatabase,
    *,
    name: str,
    email: str | None,
    prompt_text: str,
    form_response_id: str | None,
    source: PromptSource,
    submitted_at: datetime | None = None,
) -> SubmissionResult:
    name = name.strip()
    email = _clean_email(email)
    name_k = name_key(name)
    email_k = email_key(email)

    if form_response_id:
        existing = await db.prompts.find_one({"form_response_id": form_response_id})
        if existing is not None:
            return SubmissionResult(existing, False, False)
        if await db.ignored_form_responses.find_one({"_id": form_response_id}) is not None:
            return SubmissionResult(None, False, True)

    player, matched_by_email = await _find_player_for_submission(db, name_k, email_k)
    if player is None:
        try:
            player = await _create_pending_player(db, name, email)
        except DuplicateKeyError:
            # A concurrent submission created the same player first.
            player, matched_by_email = await _find_player_for_submission(db, name_k, email_k)
            if player is None:
                raise PlayerConflictError("Could not create the player, try again") from None
    identity_warning: str | None = None
    player_email_k = player.get("email_key")
    if not matched_by_email and player_email_k is not None and player_email_k != email_k:
        identity_warning = "email_mismatch"

    if email is not None and email_k is not None and player_email_k is None:
        try:
            await db.players.update_one(
                {"_id": player["_id"], "email_key": {"$exists": False}},
                {"$set": {"email": email, "email_key": email_k, "updated_at": datetime.now(UTC)}},
            )
        except DuplicateKeyError:
            pass

    try:
        version = await add_version(
            db,
            player,
            prompt_text,
            status="pending",
            source=source,
            name_at_version=name,
            email=email,
            form_response_id=form_response_id,
            identity_warning=identity_warning,
            submitted_at=submitted_at,
        )
    except DuplicateFormResponseError:
        existing = await db.prompts.find_one({"form_response_id": form_response_id})
        return SubmissionResult(existing, False, False)
    return SubmissionResult(version, True, False)


async def recompute_current_version(db: AsyncIOMotorDatabase, player_ref: str) -> str | None:
    best = await db.prompts.find_one({"player_ref": player_ref, "status": "accepted"}, sort=[("version", -1)])
    current = str(best["_id"]) if best else None
    await db.players.update_one(
        {"_id": ObjectId(player_ref)},
        {"$set": {"current_version_id": current, "updated_at": datetime.now(UTC)}},
    )
    return current


async def update_player(
    db: AsyncIOMotorDatabase, player_id: str, name: str | None, email: str | None
) -> dict:
    player = await get_player(db, player_id)
    sets: dict[str, Any] = {}
    unsets: dict[str, str] = {}
    add_to_set: dict[str, str] = {}
    pull: dict[str, str] = {}

    if name is not None:
        name = name.strip()
        new_key = name_key(name)
        if new_key != player["name_key"]:
            await _ensure_name_free(db, new_key, player["_id"])
            add_to_set["former_name_keys"] = player["name_key"]
            pull["former_name_keys"] = new_key
            sets["name_key"] = new_key
        sets["name"] = name

    if email is not None:
        clean = _clean_email(email)
        new_ekey = email_key(clean)
        if new_ekey is None:
            unsets = {"email": "", "email_key": ""}
        else:
            await _ensure_email_free(db, new_ekey, player["_id"])
            sets["email"] = clean
            sets["email_key"] = new_ekey

    sets["updated_at"] = datetime.now(UTC)
    update: dict[str, Any] = {"$set": sets}
    if unsets:
        update["$unset"] = unsets
    try:
        # Pulling the new key first keeps a rename back to an own former name from leaving it in the list.
        if pull:
            await db.players.update_one({"_id": player["_id"]}, {"$pull": pull})
        if add_to_set:
            update["$addToSet"] = add_to_set
        await db.players.update_one({"_id": player["_id"]}, update)
    except DuplicateKeyError as exc:
        raise PlayerConflictError("A player with this name or email already exists") from exc
    return await get_player(db, player_id)


async def delete_player(db: AsyncIOMotorDatabase, player_id: str) -> None:
    player = await get_player(db, player_id)
    player_ref = str(player["_id"])
    in_session = await db.game_sessions.find_one(
        {"status": {"$in": LOCKING_SESSION_STATUSES}, "roster.player_ref": player_ref}
    )
    if in_session is not None:
        raise PlayerConflictError("Player is in an unfinished game session")

    now = datetime.now(UTC)
    async for version in db.prompts.find({"player_ref": player_ref, "form_response_id": {"$type": "string"}}):
        await db.ignored_form_responses.update_one(
            {"_id": version["form_response_id"]},
            {"$set": {"player_name": version.get("player_id", player["name"]), "deleted_at": now}},
            upsert=True,
        )
    await db.prompts.delete_many({"player_ref": player_ref})
    await db.players.delete_one({"_id": player["_id"]})


def version_out(v: dict, fallback_name: str = "") -> PromptVersionOut:
    return PromptVersionOut(
        id=str(v["_id"]),
        version=v.get("version", 0),
        prompt_text=v["prompt_text"],
        status=v["status"],
        source=v.get("source", "migration"),
        player_name=v.get("player_id", fallback_name),
        identity_warning=v.get("identity_warning"),
        email=v.get("email"),
        created_at=v.get("created_at"),
    )


async def _current_version(db: AsyncIOMotorDatabase, player: dict) -> PromptVersionOut | None:
    current_id = player.get("current_version_id")
    if not current_id:
        return None
    try:
        doc = await db.prompts.find_one({"_id": ObjectId(current_id)})
    except Exception:
        return None
    return version_out(doc, player["name"]) if doc else None


async def player_out(db: AsyncIOMotorDatabase, player: dict) -> PlayerOut:
    pending = await db.prompts.count_documents({"player_ref": str(player["_id"]), "status": "pending"})
    return PlayerOut(
        id=str(player["_id"]),
        name=player["name"],
        email=player.get("email"),
        current_version=await _current_version(db, player),
        pending_versions=pending,
        created_at=player.get("created_at"),
    )


async def player_detail_out(db: AsyncIOMotorDatabase, player: dict) -> PlayerDetailOut:
    base = await player_out(db, player)
    docs = await db.prompts.find({"player_ref": str(player["_id"])}).sort("version", -1).to_list(length=1000)
    return PlayerDetailOut(**base.model_dump(), versions=[version_out(d, player["name"]) for d in docs])
