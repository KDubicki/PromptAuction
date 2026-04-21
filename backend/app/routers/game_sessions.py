from bson import ObjectId
from fastapi import APIRouter, HTTPException, status

from app.db.mongo import mongo_manager
from app.schemas.game import GameSessionCreate, GameSessionOut, GameSessionUpdate

router = APIRouter(prefix="/game-sessions", tags=["game-sessions"])


@router.post("", response_model=GameSessionOut, status_code=status.HTTP_201_CREATED)
async def create_game_session(payload: GameSessionCreate) -> GameSessionOut:
    db = mongo_manager.db
    if db is None:
        raise HTTPException(status_code=503, detail="Database not connected")

    doc = {
        "name": payload.name,
        "status": "pending",
        "accepted_prompt_ids": [],
        "current_round": 0,
        "current_iteration": 0,
    }
    result = await db.game_sessions.insert_one(doc)
    return GameSessionOut(id=str(result.inserted_id), **doc)


@router.get("", response_model=list[GameSessionOut])
async def list_game_sessions() -> list[GameSessionOut]:
    db = mongo_manager.db
    if db is None:
        raise HTTPException(status_code=503, detail="Database not connected")

    sessions = await db.game_sessions.find().to_list(length=500)
    return [
        GameSessionOut(
            id=str(s["_id"]),
            name=s["name"],
            status=s["status"],
            accepted_prompt_ids=s.get("accepted_prompt_ids", []),
            current_round=s.get("current_round", 0),
            current_iteration=s.get("current_iteration", 0),
        )
        for s in sessions
    ]


@router.get("/{session_id}", response_model=GameSessionOut)
async def get_game_session(session_id: str) -> GameSessionOut:
    db = mongo_manager.db
    if db is None:
        raise HTTPException(status_code=503, detail="Database not connected")

    session = await db.game_sessions.find_one({"_id": ObjectId(session_id)})
    if not session:
        raise HTTPException(status_code=404, detail="Game session not found")

    return GameSessionOut(
        id=str(session["_id"]),
        name=session["name"],
        status=session["status"],
        accepted_prompt_ids=session.get("accepted_prompt_ids", []),
        current_round=session.get("current_round", 0),
        current_iteration=session.get("current_iteration", 0),
    )


@router.patch("/{session_id}", response_model=GameSessionOut)
async def update_game_session(session_id: str, payload: GameSessionUpdate) -> GameSessionOut:
    db = mongo_manager.db
    if db is None:
        raise HTTPException(status_code=503, detail="Database not connected")

    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    if updates:
        await db.game_sessions.update_one({"_id": ObjectId(session_id)}, {"$set": updates})

    session = await db.game_sessions.find_one({"_id": ObjectId(session_id)})
    if not session:
        raise HTTPException(status_code=404, detail="Game session not found")

    return GameSessionOut(
        id=str(session["_id"]),
        name=session["name"],
        status=session["status"],
        accepted_prompt_ids=session.get("accepted_prompt_ids", []),
        current_round=session.get("current_round", 0),
        current_iteration=session.get("current_iteration", 0),
    )


@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_game_session(session_id: str) -> None:
    db = mongo_manager.db
    if db is None:
        raise HTTPException(status_code=503, detail="Database not connected")

    result = await db.game_sessions.delete_one({"_id": ObjectId(session_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Game session not found")
