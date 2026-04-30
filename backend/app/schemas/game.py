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


class GameSessionOut(BaseModel):
    id: str
    name: str
    status: GameStatus
    accepted_prompt_ids: list[str] = Field(default_factory=list)
    current_round: int = 0
    current_iteration: int = 0
    created_at: datetime | None = None
    updated_at: datetime | None = None
