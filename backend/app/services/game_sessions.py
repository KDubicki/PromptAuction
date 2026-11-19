from __future__ import annotations

import random
from datetime import UTC, datetime
from typing import Any

from bson import ObjectId
from bson.errors import InvalidId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.ids import parse_object_id
from app.schemas.game import (
    AuctionOut,
    BidOut,
    GameSessionOut,
    GameStatus,
    LotOut,
    OwnedItemOut,
    RosterEntryOut,
    SessionSettings,
    StandingOut,
)
from app.services.auction.catalog import generate_lots
from app.services.auction.rules import compute_standings

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
                budget=entry.get("budget"),
                items=[OwnedItemOut(**it) for it in entry.get("items") or []],
            )
        )
    auction = doc.get("auction")
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
        settings=SessionSettings(**(doc.get("settings") or {})),
        required_items=doc.get("required_items") or [],
        lots=[LotOut(**lot) for lot in doc.get("lots") or []],
        auction=AuctionOut(**auction) if auction else None,
        standings=[StandingOut(**row) for row in doc.get("standings") or []],
        pause_reason=doc.get("pause_reason"),
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

    settings = SessionSettings(**(session.get("settings") or {}))
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
                "budget": settings.budget,
                "items": [],
            }
        )
    seed = random.SystemRandom().randrange(2**31)
    lots, required_items = generate_lots(settings.lots_count, seed)
    now = datetime.now(UTC)
    result = await db.game_sessions.update_one(
        {"_id": session["_id"], "status": "pending"},
        {
            "$set": {
                "status": "running",
                "roster": pinned,
                "started_at": now,
                "updated_at": now,
                "settings": settings.model_dump(),
                "seed": seed,
                "lots": lots,
                "required_items": required_items,
                "auction": {
                    "lot_number": 1,
                    "current_round": 1,
                    "highest_bid": 0,
                    "leader_ref": None,
                    "leader_name": None,
                    "void_rounds": 0,
                },
                "standings": compute_standings(pinned),
            }
        },
    )
    if result.matched_count == 0:
        await get_session(db, session_id)
        raise SessionError("Session has already started", 409)
    return await get_session(db, session_id)


async def update_session(
    db: AsyncIOMotorDatabase,
    session_id: str,
    name: str | None,
    new_status: GameStatus | None,
    settings: SessionSettings | None = None,
) -> dict:
    session = await get_session(db, session_id)
    updates: dict[str, Any] = {}
    unset: dict[str, str] = {}
    if name is not None:
        updates["name"] = name
    if settings is not None:
        if session["status"] != "pending":
            raise SessionError("Settings can only be changed before the session starts", 409)
        updates["settings"] = settings.model_dump()
    if new_status is not None and new_status != session["status"]:
        check_transition(session["status"], new_status)
        updates["status"] = new_status
        if session["status"] == "paused" and new_status == "running":
            if session.get("auction"):
                updates["auction.void_rounds"] = 0
            unset["pause_reason"] = ""
    if updates:
        updates["updated_at"] = datetime.now(UTC)
        filt: dict[str, Any] = {"_id": session["_id"]}
        if "status" in updates or settings is not None:
            filt["status"] = session["status"]
        change: dict[str, Any] = {"$set": updates}
        if unset:
            change["$unset"] = unset
        result = await db.game_sessions.update_one(filt, change)
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


async def list_bids(db: AsyncIOMotorDatabase, session_id: str, lot_number: int | None) -> list[BidOut]:
    session = await get_session(db, session_id)
    query: dict[str, Any] = {"session_id": str(session["_id"]), "lot_number": {"$exists": True}}
    if lot_number is not None:
        query["lot_number"] = lot_number
    order = [("lot_number", 1), ("round", 1), ("response_ms", 1)]
    docs = await db.player_bids.find(query).sort(order).to_list(length=None)
    return [BidOut(**{k: v for k, v in doc.items() if k in BidOut.model_fields}) for doc in docs]
