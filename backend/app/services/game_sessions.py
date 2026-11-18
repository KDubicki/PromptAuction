from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from bson import ObjectId
from bson.errors import InvalidId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.ids import parse_object_id
from app.schemas.game import GameSessionOut, GameStatus, RosterEntryOut

SESSION_NOT_FOUND = "Game session not found"
MIN_PLAYERS = 2

ALLOWED_TRANSITIONS: set[tuple[GameStatus, GameStatus]] = {
    ("running", "paused"),
    ("paused", "running"),
    ("running", "completed"),
    ("paused", "completed"),
}


class SessionError(Exception):
    status_code = 500

    def __init__(self, message: str, status_code: int | None = None) -> None:
        super().__init__(message)
        self.message = message
        if status_code is not None:
            self.status_code = status_code


def check_transition(current: GameStatus, new: GameStatus) -> None:
    if current == new:
        return
    if (current, new) not in ALLOWED_TRANSITIONS:
        raise SessionError(f"Cannot change session status from {current} to {new}", 409)


def _session_oid(session_id: str) -> ObjectId:
    return parse_object_id(session_id, SESSION_NOT_FOUND)


async def get_session(db: AsyncIOMotorDatabase, session_id: str) -> dict:
    session = await db.game_sessions.find_one({"_id": _session_oid(session_id)})
    if session is None:
        raise SessionError(SESSION_NOT_FOUND, 404)
    return session


async def _live_versions(db: AsyncIOMotorDatabase, roster: list[dict]) -> dict[str, tuple[str, dict | None]]:
    """Map player_ref to (live name, current accepted version doc or None)."""
    result: dict[str, tuple[str, dict | None]] = {}
    for entry in roster:
        ref = entry["player_ref"]
        try:
            player = await db.players.find_one({"_id": ObjectId(ref)})
        except (InvalidId, TypeError):
            player = None
        if player is None:
            result[ref] = (entry.get("name", ""), None)
            continue
        version = None
        current_id = player.get("current_version_id")
        if current_id:
            try:
                version = await db.prompts.find_one({"_id": ObjectId(current_id), "status": "accepted"})
            except (InvalidId, TypeError):
                version = None
        result[ref] = (player["name"], version)
    return result


def _blockers(roster: list[dict], live: dict[str, tuple[str, dict | None]]) -> list[str]:
    blockers: list[str] = []
    if len(roster) < MIN_PLAYERS:
        blockers.append("Add at least 2 players")
    for entry in roster:
        name, version = live[entry["player_ref"]]
        if version is None:
            blockers.append(f"{name} has no accepted prompt yet")
    return blockers


async def session_to_out(db: AsyncIOMotorDatabase, doc: dict) -> GameSessionOut:
    roster: list[dict] = doc.get("roster") or []
    pending = doc["status"] == "pending"
    live = await _live_versions(db, roster) if pending else {}
    entries: list[RosterEntryOut] = []
    for entry in roster:
        name = entry.get("name", "")
        current_version: int | None = None
        if pending:
            name, version = live[entry["player_ref"]]
            current_version = version.get("version") if version else None
        entries.append(
            RosterEntryOut(
                player_ref=entry["player_ref"],
                name=name,
                current_version=current_version,
                version_id=entry.get("version_id"),
                version=entry.get("version"),
                prompt_text=entry.get("prompt_text"),
            )
        )
    return GameSessionOut(
        id=str(doc["_id"]),
        name=doc["name"],
        status=doc["status"],
        roster=entries,
        start_blockers=_blockers(roster, live) if pending else [],
        current_round=doc.get("current_round", 0),
        current_iteration=doc.get("current_iteration", 0),
        started_at=doc.get("started_at"),
        created_at=doc.get("created_at"),
        updated_at=doc.get("updated_at"),
    )


async def _require_pending(db: AsyncIOMotorDatabase, session_id: str) -> dict:
    session = await get_session(db, session_id)
    if session["status"] != "pending":
        raise SessionError("Roster is locked once the session has started", 409)
    return session


async def add_to_roster(db: AsyncIOMotorDatabase, session_id: str, player_id: str) -> dict:
    session = await _require_pending(db, session_id)
    player = await db.players.find_one({"_id": parse_object_id(player_id, "Player not found")})
    if player is None:
        raise SessionError("Player not found", 404)
    ref = str(player["_id"])
    result = await db.game_sessions.update_one(
        {"_id": session["_id"], "status": "pending", "roster.player_ref": {"$ne": ref}},
        {
            "$push": {"roster": {"player_ref": ref, "name": player["name"]}},
            "$set": {"updated_at": datetime.now(UTC)},
        },
    )
    if result.matched_count == 0:
        await _require_pending(db, session_id)
        raise SessionError("Player is already in this session", 409)
    return await get_session(db, session_id)


async def remove_from_roster(db: AsyncIOMotorDatabase, session_id: str, player_id: str) -> dict:
    session = await _require_pending(db, session_id)
    ref = str(parse_object_id(player_id, "Player not found"))
    if not any(e["player_ref"] == ref for e in session.get("roster") or []):
        raise SessionError("Player is not in this session", 404)
    result = await db.game_sessions.update_one(
        {"_id": session["_id"], "status": "pending"},
        {"$pull": {"roster": {"player_ref": ref}}, "$set": {"updated_at": datetime.now(UTC)}},
    )
    if result.matched_count == 0:
        await _require_pending(db, session_id)
    return await get_session(db, session_id)


async def start_session(db: AsyncIOMotorDatabase, session_id: str) -> dict:
    session = await get_session(db, session_id)
    if session["status"] != "pending":
        raise SessionError("Session has already started", 409)
    roster: list[dict] = session.get("roster") or []
    live = await _live_versions(db, roster)
    blockers = _blockers(roster, live)
    if blockers:
        raise SessionError("; ".join(blockers), 409)

    pinned: list[dict[str, Any]] = []
    for entry in roster:
        name, version = live[entry["player_ref"]]
        assert version is not None
        pinned.append(
            {
                "player_ref": entry["player_ref"],
                "name": name,
                "version_id": str(version["_id"]),
                "version": version["version"],
                "prompt_text": version["prompt_text"],
            }
        )
    now = datetime.now(UTC)
    result = await db.game_sessions.update_one(
        {"_id": session["_id"], "status": "pending"},
        {"$set": {"status": "running", "roster": pinned, "started_at": now, "updated_at": now}},
    )
    if result.matched_count == 0:
        await get_session(db, session_id)
        raise SessionError("Session has already started", 409)
    return await get_session(db, session_id)


async def update_session(
    db: AsyncIOMotorDatabase, session_id: str, name: str | None, new_status: GameStatus | None
) -> dict:
    session = await get_session(db, session_id)
    updates: dict[str, Any] = {}
    if name is not None:
        updates["name"] = name
    if new_status is not None and new_status != session["status"]:
        check_transition(session["status"], new_status)
        updates["status"] = new_status
    if updates:
        updates["updated_at"] = datetime.now(UTC)
        filt: dict[str, Any] = {"_id": session["_id"]}
        if "status" in updates:
            filt["status"] = session["status"]
        result = await db.game_sessions.update_one(filt, {"$set": updates})
        if result.matched_count == 0:
            raise SessionError("Session status changed concurrently, try again", 409)
    return await get_session(db, session_id)


async def delete_session(db: AsyncIOMotorDatabase, session_id: str) -> None:
    oid = _session_oid(session_id)
    session = await db.game_sessions.find_one({"_id": oid})
    if session is None:
        raise SessionError(SESSION_NOT_FOUND, 404)
    if session["status"] == "running":
        raise SessionError("Pause or complete the session before deleting it", 409)
    await db.game_sessions.delete_one({"_id": oid})
