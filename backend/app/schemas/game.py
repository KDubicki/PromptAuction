from datetime import datetime

from pydantic import BaseModel, Field


class PlayerBid(BaseModel):
    player_id: str
    item_name: str
    bid_amount: float
    won: bool = False
    created_at: datetime = datetime.utcnow()


class GameSessionCreate(BaseModel):
    name: str


class GameSessionUpdate(BaseModel):
    name: str | None = None
    status: str | None = None


class GameSessionOut(BaseModel):
    id: str
    name: str
    status: str
    accepted_prompt_ids: list[str] = Field(default_factory=list)
    current_round: int = 0
    current_iteration: int = 0
