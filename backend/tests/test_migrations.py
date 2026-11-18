from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo.errors import DuplicateKeyError

from app.services.migrations import migrate_prompts_to_players

T0 = datetime(2026, 1, 1, tzinfo=UTC)


class _PlayersWithInsert:
    def __init__(self, real: Any, insert: Any) -> None:
        self._real = real
        self.insert_one = insert

    def __getattr__(self, name: str) -> Any:
        return getattr(self._real, name)


class _DbWithPlayerInsert:
    def __init__(self, real: Any, insert: Any) -> None:
        self._real = real
        self.players = _PlayersWithInsert(real.players, insert)

    def __getattr__(self, name: str) -> Any:
        return getattr(self._real, name)


def _legacy(player_id: str, status: str, minutes: int | None, **extra: object) -> dict:
    doc: dict = {"player_id": player_id, "prompt_text": f"{player_id}-{status}", "status": status}
    if minutes is not None:
        doc["created_at"] = T0 + timedelta(minutes=minutes)
        doc["updated_at"] = T0 + timedelta(minutes=minutes)
    doc.update(extra)
    return doc


async def test_migration_groups_by_nick_and_numbers_versions(mock_db: AsyncIOMotorDatabase) -> None:
    await mock_db.prompts.insert_many([
        _legacy("Aurelia", "accepted", 1),
        _legacy("aurelia", "pending", 2),
        _legacy("Kestrel", "rejected", 3),
    ])

    assert await migrate_prompts_to_players(mock_db) == 3

    assert await mock_db.players.count_documents({}) == 2
    aurelia = await mock_db.players.find_one({"name_key": "aurelia"})
    assert aurelia["name"] == "aurelia"
    versions = await mock_db.prompts.find({"player_ref": str(aurelia["_id"])}).sort("version", 1).to_list(10)
    assert [(v["version"], v["status"], v["source"]) for v in versions] == [
        (1, "accepted", "migration"),
        (2, "pending", "migration"),
    ]
    assert aurelia["current_version_id"] == str(versions[0]["_id"])
    kestrel = await mock_db.players.find_one({"name_key": "kestrel"})
    assert kestrel["current_version_id"] is None
    assert kestrel["former_name_keys"] == []


async def test_migration_is_idempotent(mock_db: AsyncIOMotorDatabase) -> None:
    await mock_db.prompts.insert_many([_legacy("Aurelia", "accepted", 1), _legacy("Kestrel", "pending", 2)])
    assert await migrate_prompts_to_players(mock_db) == 2
    assert await migrate_prompts_to_players(mock_db) == 0
    assert await mock_db.players.count_documents({}) == 2
    assert await mock_db.prompts.count_documents({"version": 1}) == 2


async def test_migration_keeps_google_source_and_skips_taken_email(mock_db: AsyncIOMotorDatabase) -> None:
    await mock_db.players.insert_one({
        "name": "Other", "name_key": "other", "former_name_keys": [], "email": "x@example.com",
        "email_key": "x@example.com", "current_version_id": None, "created_at": T0, "updated_at": T0,
    })
    await mock_db.prompts.insert_many([
        _legacy("Aurelia", "pending", 1, source="google_forms", email="X@example.com"),
        _legacy("Brutus", "pending", 2, email="b@example.com"),
    ])

    await migrate_prompts_to_players(mock_db)

    aurelia = await mock_db.players.find_one({"name_key": "aurelia"})
    assert "email" not in aurelia and "email_key" not in aurelia
    brutus = await mock_db.players.find_one({"name_key": "brutus"})
    assert brutus["email_key"] == "b@example.com"
    version = await mock_db.prompts.find_one({"player_ref": str(aurelia["_id"])})
    assert version["source"] == "google_forms"


async def test_migration_handles_legacy_shapes_and_existing_players(mock_db: AsyncIOMotorDatabase) -> None:
    existing = await mock_db.players.insert_one({
        "name": "Renamed", "name_key": "renamed", "former_name_keys": ["oldnick"],
        "current_version_id": None, "created_at": T0, "updated_at": T0,
    })
    ref = str(existing.inserted_id)
    await mock_db.prompts.insert_one(
        {"player_ref": ref, "version": 4, "player_id": "Renamed", "prompt_text": "v4", "status": "pending",
         "source": "admin", "created_at": T0, "updated_at": T0}
    )
    await mock_db.prompts.insert_many([
        _legacy("  OldNick ", "accepted", 5, form_response_id=None, email=None),
        _legacy("Zed", "pending", None),
        _legacy("zed ", "pending", 1, email="  Z@Example.com "),
        _legacy("   ", "pending", 2),
    ])

    assert await migrate_prompts_to_players(mock_db) == 3

    assert await mock_db.players.count_documents({}) == 2
    migrated = await mock_db.prompts.find_one({"status": "accepted"})
    assert migrated["player_ref"] == ref and migrated["version"] == 5
    assert "form_response_id" not in migrated and "email" not in migrated
    player = await mock_db.players.find_one({"_id": existing.inserted_id})
    assert player["current_version_id"] == str(migrated["_id"])

    zed = await mock_db.players.find_one({"name_key": "zed"})
    assert zed["name"] == "zed"
    assert zed["email"] == "Z@Example.com" and zed["email_key"] == "z@example.com"
    zed_versions = await mock_db.prompts.find({"player_ref": str(zed["_id"])}).sort("version", 1).to_list(10)
    assert [v["created_at"] if "created_at" in v else None for v in zed_versions][0] is None
    assert [v["version"] for v in zed_versions] == [1, 2]
    assert await mock_db.prompts.count_documents({"player_ref": None}) == 1


async def test_migration_recovers_when_player_insert_hits_a_unique_index(
    mock_db: AsyncIOMotorDatabase
) -> None:
    await mock_db.prompts.insert_one(_legacy("Aurelia", "pending", 1, email="a@example.com"))
    calls: list[dict] = []

    async def flaky_insert(doc: dict) -> object:
        calls.append(dict(doc))
        if len(calls) == 1:
            raise DuplicateKeyError("email_key taken")
        return await mock_db.players.insert_one(doc)

    db = _DbWithPlayerInsert(mock_db, flaky_insert)

    assert await migrate_prompts_to_players(db) == 1
    assert "email_key" in calls[0] and "email_key" not in calls[1]
    assert "email" not in await mock_db.players.find_one({"name_key": "aurelia"})


async def test_migration_reuses_player_created_concurrently(
    mock_db: AsyncIOMotorDatabase
) -> None:
    await mock_db.prompts.insert_one(_legacy("Aurelia", "pending", 1))

    async def racing_insert(doc: dict) -> object:
        await mock_db.players.insert_one({**doc, "_id": ObjectId()})
        raise DuplicateKeyError("name_key taken")

    assert await migrate_prompts_to_players(_DbWithPlayerInsert(mock_db, racing_insert)) == 1
    assert await mock_db.players.count_documents({}) == 1
