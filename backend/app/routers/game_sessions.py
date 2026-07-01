from __future__ import annotations

from datetime import UTC, datetime

from bson import ObjectId
from fastapi import APIRouter, HTTPException, status

from app.db.mongo import mongo_manager
from app.schemas.game import GameSessionCreate, GameSessionOut, GameSessionUpdate

router = APIRouter(prefix="/game-sessions", tags=["game-sessions"])


def _session_doc_to_out(s: dict) -> GameSessionOut:
    return GameSessionOut(
        id=str(s["_id"]),
        name=s["name"],
        status=s["status"],
        accepted_prompt_ids=s.get("accepted_prompt_ids", []),
        current_round=s.get("current_round", 0),
        current_iteration=s.get("current_iteration", 0),
        created_at=s.get("created_at"),
        updated_at=s.get("updated_at"),
    )


@router.post("", response_model=GameSessionOut, status_code=status.HTTP_201_CREATED)
async def create_game_session(payload: GameSessionCreate) -> GameSessionOut:
    db = mongo_manager.db
    if db is None:
        raise HTTPException(status_code=503, detail="Database not connected")

    now = datetime.now(UTC)
    doc = {
        "name": payload.name,
        "status": "pending",
        "accepted_prompt_ids": [],
        "current_round": 0,
        "current_iteration": 0,
        "created_at": now,
        "updated_at": now,
    }
    result = await db.game_sessions.insert_one(doc)
    doc["_id"] = result.inserted_id
    return _session_doc_to_out(doc)


@router.get("", response_model=list[GameSessionOut])
async def list_game_sessions() -> list[GameSessionOut]:
    db = mongo_manager.db
    if db is None:
        raise HTTPException(status_code=503, detail="Database not connected")

    sessions = await db.game_sessions.find().sort("created_at", -1).to_list(length=500)
    return [_session_doc_to_out(s) for s in sessions]


@router.get("/{session_id}", response_model=GameSessionOut)
async def get_game_session(session_id: str) -> GameSessionOut:
    db = mongo_manager.db
    if db is None:
        raise HTTPException(status_code=503, detail="Database not connected")

    session = await db.game_sessions.find_one({"_id": ObjectId(session_id)})
    if not session:
        raise HTTPException(status_code=404, detail="Game session not found")

    return _session_doc_to_out(session)


@router.patch("/{session_id}", response_model=GameSessionOut)
async def update_game_session(session_id: str, payload: GameSessionUpdate) -> GameSessionOut:
    db = mongo_manager.db
    if db is None:
        raise HTTPException(status_code=503, detail="Database not connected")

    updates = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    if updates:
        updates["updated_at"] = datetime.now(UTC)
        await db.game_sessions.update_one({"_id": ObjectId(session_id)}, {"$set": updates})

    session = await db.game_sessions.find_one({"_id": ObjectId(session_id)})
    if not session:
        raise HTTPException(status_code=404, detail="Game session not found")

    return _session_doc_to_out(session)


@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_game_session(session_id: str) -> None:
    db = mongo_manager.db
    if db is None:
        raise HTTPException(status_code=503, detail="Database not connected")

    result = await db.game_sessions.delete_one({"_id": ObjectId(session_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Game session not found")
