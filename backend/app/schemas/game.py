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


class SessionSettings(BaseModel):
    budget: int = Field(default=1000, ge=1, le=1_000_000)
    lots_count: int = Field(default=12, ge=1, le=500)
    max_rounds: int = Field(default=10, ge=1, le=100)


class GameSessionCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    settings: SessionSettings | None = None


class GameSessionUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    status: GameStatus | None = None
    settings: SessionSettings | None = None


class RosterAdd(BaseModel):
    player_id: str


class OwnedItemOut(BaseModel):
    item: str
    quality: int
    required: bool
    lot_number: int
    price: int


class RosterEntryOut(BaseModel):
    player_ref: str
    name: str
    current_version: int | None = None
    version_id: str | None = None
    version: int | None = None
    prompt_text: str | None = None
    budget: int | None = None
    items: list[OwnedItemOut] = Field(default_factory=list)


class LotOut(BaseModel):
    number: int
    item: str
    quality: int
    required: bool
    status: Literal["pending", "sold", "unsold"]
    sold_to: str | None = None
    sold_to_name: str | None = None
    price: int | None = None
    sold_in_round: int | None = None


class AuctionOut(BaseModel):
    lot_number: int
    current_round: int
    highest_bid: int
    leader_ref: str | None = None
    leader_name: str | None = None
    void_rounds: int = 0


class StandingOut(BaseModel):
    rank: int
    player_ref: str
    name: str
    unique_required: int
    quality: int
    budget: int


class BidOut(BaseModel):
    lot_number: int
    item: str
    round: int
    player_id: str
    player_ref: str | None = None
    bid: int | None = None
    reason: str | None = None
    response_ms: float | None = None
    outcome: str | None = None
    won: bool = False
    created_at: datetime | None = None


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
    settings: SessionSettings = Field(default_factory=SessionSettings)
    required_items: list[str] = Field(default_factory=list)
    lots: list[LotOut] = Field(default_factory=list)
    auction: AuctionOut | None = None
    standings: list[StandingOut] = Field(default_factory=list)
    pause_reason: str | None = None
