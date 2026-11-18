from __future__ import annotations

from fastapi import APIRouter, HTTPException, Response, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.db.mongo import mongo_manager
from app.schemas.players import (
    PlayerCreate,
    PlayerDetailOut,
    PlayerOut,
    PlayerUpdate,
    PromptVersionCreate,
    PromptVersionOut,
)
from app.services import players as service
from app.services.players import PlayerError

router = APIRouter(prefix="/players", tags=["players"])


def _db() -> AsyncIOMotorDatabase:
    db = mongo_manager.db
    if db is None:
        raise HTTPException(status_code=503, detail="Database not connected")
    return db


@router.post("", response_model=PlayerOut, status_code=status.HTTP_201_CREATED)
async def create_player(payload: PlayerCreate) -> PlayerOut:
    db = _db()
    try:
        player = await service.create_player(db, payload.name, payload.email, payload.prompt_text)
    except PlayerError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
    return await service.player_out(db, player)


@router.get("", response_model=list[PlayerOut])
async def list_players() -> list[PlayerOut]:
    db = _db()
    players = await db.players.find({}).to_list(length=1000)
    players.sort(key=lambda p: p["name_key"])
    return [await service.player_out(db, p) for p in players]


@router.get("/{player_id}", response_model=PlayerDetailOut)
async def get_player(player_id: str) -> PlayerDetailOut:
    db = _db()
    try:
        player = await service.get_player(db, player_id)
    except PlayerError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
    return await service.player_detail_out(db, player)


@router.patch("/{player_id}", response_model=PlayerOut)
async def update_player(player_id: str, payload: PlayerUpdate) -> PlayerOut:
    db = _db()
    try:
        player = await service.update_player(db, player_id, payload.name, payload.email)
    except PlayerError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
    return await service.player_out(db, player)


@router.delete("/{player_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_player(player_id: str) -> Response:
    db = _db()
    try:
        await service.delete_player(db, player_id)
    except PlayerError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{player_id}/versions", response_model=PromptVersionOut, status_code=status.HTTP_201_CREATED)
async def add_player_version(player_id: str, payload: PromptVersionCreate) -> PromptVersionOut:
    db = _db()
    try:
        player = await service.get_player(db, player_id)
        version = await service.add_version(
            db,
            player,
            payload.prompt_text,
            status="accepted",
            source="admin",
            name_at_version=player["name"],
        )
    except PlayerError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
    return service.version_out(version, player["name"])
