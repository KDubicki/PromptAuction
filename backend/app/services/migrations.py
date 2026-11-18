from __future__ import annotations

import logging
from datetime import UTC, datetime
from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo.errors import DuplicateKeyError

from app.services.players import email_key, name_key, recompute_current_version

logger = logging.getLogger(__name__)

MAX_NAME_LENGTH = 100
VALID_SOURCES = {"admin", "google_forms", "webhook", "migration"}
_EPOCH = datetime.min


def _sort_key(doc: dict) -> tuple:
    created = doc.get("created_at")
    if isinstance(created, datetime):
        return (1, created.replace(tzinfo=None), doc["_id"])
    return (0, _EPOCH, doc["_id"])


def _nick(doc: dict) -> str:
    value = doc.get("player_id")
    return value if isinstance(value, str) else ""


async def _find_player(db: AsyncIOMotorDatabase, key: str) -> dict | None:
    player = await db.players.find_one({"name_key": key})
    if player is None:
        player = await db.players.find_one({"former_name_keys": key})
    return player


async def _pick_email(db: AsyncIOMotorDatabase, newest_first: list[dict]) -> tuple[str, str] | None:
    for doc in newest_first:
        raw = doc.get("email")
        if not isinstance(raw, str):
            continue
        clean = raw.strip()
        key = email_key(clean)
        if key is None:
            continue
        if await db.players.find_one({"email_key": key}) is None:
            return clean, key
    return None


async def _find_or_create_player(db: AsyncIOMotorDatabase, key: str, group: list[dict]) -> dict:
    player = await _find_player(db, key)
    if player is not None:
        return player

    newest_first = list(reversed(group))
    name = _nick(newest_first[0]).strip()[:MAX_NAME_LENGTH].strip()
    now = datetime.now(UTC)
    doc: dict[str, Any] = {
        "name": name,
        "name_key": name_key(name),
        "former_name_keys": [],
        "current_version_id": None,
        "created_at": now,
        "updated_at": now,
    }
    email = await _pick_email(db, newest_first)
    if email is not None:
        doc["email"], doc["email_key"] = email
    try:
        result = await db.players.insert_one(doc)
    except DuplicateKeyError:
        # The name or email was claimed meanwhile: reuse the name owner, otherwise retry without the email.
        existing = await _find_player(db, doc["name_key"])
        if existing is not None:
            return existing
        doc.pop("email", None)
        doc.pop("email_key", None)
        result = await db.players.insert_one(doc)
    doc["_id"] = result.inserted_id
    return doc


async def migrate_prompts_to_players(db: AsyncIOMotorDatabase) -> int:
    legacy = await db.prompts.find({"player_ref": None}).to_list(length=None)
    legacy.sort(key=_sort_key)

    groups: dict[str, list[dict]] = {}
    for doc in legacy:
        key = name_key(_nick(doc))
        if not key:
            logger.warning("Skipping legacy prompt %s without a player_id", doc["_id"])
            continue
        groups.setdefault(key, []).append(doc)

    updated = 0
    for key, group in groups.items():
        player = await _find_or_create_player(db, key, group)
        player_ref = str(player["_id"])
        latest = await db.prompts.find_one({"player_ref": player_ref}, sort=[("version", -1)])
        version = latest["version"] if latest else 0
        for doc in group:
            version += 1
            source = doc.get("source")
            update: dict[str, Any] = {
                "$set": {
                    "player_ref": player_ref,
                    "version": version,
                    "source": source if source in VALID_SOURCES else "migration",
                }
            }
            nulls = {f: "" for f in ("form_response_id", "email") if f in doc and doc[f] is None}
            if nulls:
                update["$unset"] = nulls
            await db.prompts.update_one({"_id": doc["_id"]}, update)
            updated += 1
        await recompute_current_version(db, player_ref)

    if updated:
        logger.info("Migrated %d legacy prompts into players", updated)
    return updated
