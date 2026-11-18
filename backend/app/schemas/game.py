from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

GameStatus = Literal["pending", "running", "completed", "paused"]


class PlayerBid(BaseModel):
    player_id: str
    item_name: str
    bid_amount: float
    won: bool = False
    session_id: str | None = None
    created_at: datetime | None = None


class GameSessionCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)


class GameSessionUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    status: GameStatus | None = None


class RosterAdd(BaseModel):
    player_id: str


class RosterEntryOut(BaseModel):
    player_ref: str
    name: str
    current_version: int | None = None
    version_id: str | None = None
    version: int | None = None
    prompt_text: str | None = None


class GameSessionOut(BaseModel):
    id: str
    name: str
    status: GameStatus
    roster: list[RosterEntryOut] = Field(default_factory=list)
    start_blockers: list[str] = Field(default_factory=list)
    current_round: int = 0
    current_iteration: int = 0
    started_at: datetime | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
