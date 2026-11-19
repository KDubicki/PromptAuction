from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.db.mongo import mongo_manager
from app.schemas.game import (
    BidOut,
    GameSessionCreate,
    GameSessionOut,
    GameSessionUpdate,
    RosterAdd,
    SessionSettings,
)
from app.services import game_sessions as sessions
from app.services.game_sessions import SessionError

router = APIRouter(prefix="/game-sessions", tags=["game-sessions"])


def _db() -> AsyncIOMotorDatabase:
    db = mongo_manager.db
    if db is None:
        raise HTTPException(status_code=503, detail="Database not connected")
    return db


def _http(exc: SessionError) -> HTTPException:
    return HTTPException(status_code=exc.status_code, detail=exc.message)


@router.post("", response_model=GameSessionOut, status_code=status.HTTP_201_CREATED)
async def create_game_session(payload: GameSessionCreate) -> GameSessionOut:
    db = _db()
    now = datetime.now(UTC)
    doc: dict[str, Any] = {
        "name": payload.name,
        "status": "pending",
        "roster": [],
        "started_at": None,
        "current_round": 0,
        "current_iteration": 0,
        "settings": (payload.settings or SessionSettings()).model_dump(),
        "created_at": now,
        "updated_at": now,
    }
    result = await db.game_sessions.insert_one(doc)
    doc["_id"] = result.inserted_id
    return await sessions.session_to_out(db, doc)


@router.get("", response_model=list[GameSessionOut])
async def list_game_sessions() -> list[GameSessionOut]:
    db = _db()
    docs = await db.game_sessions.find().sort("created_at", -1).to_list(length=500)
    return [await sessions.session_to_out(db, s) for s in docs]


@router.get("/{session_id}", response_model=GameSessionOut)
async def get_game_session(session_id: str) -> GameSessionOut:
    db = _db()
    try:
        return await sessions.session_to_out(db, await sessions.get_session(db, session_id))
    except SessionError as exc:
        raise _http(exc) from exc


@router.patch("/{session_id}", response_model=GameSessionOut)
async def update_game_session(session_id: str, payload: GameSessionUpdate) -> GameSessionOut:
    db = _db()
    try:
        doc = await sessions.update_session(db, session_id, payload.name, payload.status, payload.settings)
        return await sessions.session_to_out(db, doc)
    except SessionError as exc:
        raise _http(exc) from exc


@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_game_session(session_id: str) -> None:
    db = _db()
    try:
        await sessions.delete_session(db, session_id)
    except SessionError as exc:
        raise _http(exc) from exc


@router.post("/{session_id}/players", response_model=GameSessionOut, status_code=status.HTTP_201_CREATED)
async def add_session_player(session_id: str, payload: RosterAdd) -> GameSessionOut:
    db = _db()
    try:
        doc = await sessions.add_to_roster(db, session_id, payload.player_id)
        return await sessions.session_to_out(db, doc)
    except SessionError as exc:
        raise _http(exc) from exc


@router.delete("/{session_id}/players/{player_id}", response_model=GameSessionOut)
async def remove_session_player(session_id: str, player_id: str) -> GameSessionOut:
    db = _db()
    try:
        doc = await sessions.remove_from_roster(db, session_id, player_id)
        return await sessions.session_to_out(db, doc)
    except SessionError as exc:
        raise _http(exc) from exc


@router.post("/{session_id}/start", response_model=GameSessionOut)
async def start_game_session(session_id: str) -> GameSessionOut:
    db = _db()
    try:
        doc = await sessions.start_session(db, session_id)
        return await sessions.session_to_out(db, doc)
    except SessionError as exc:
        raise _http(exc) from exc


@router.get("/{session_id}/bids", response_model=list[BidOut])
async def list_session_bids(session_id: str, lot_number: int | None = None) -> list[BidOut]:
    db = _db()
    try:
        return await sessions.list_bids(db, session_id, lot_number)
    except SessionError as exc:
        raise _http(exc) from exc
