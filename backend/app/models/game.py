from pydantic import BaseModel, Field


class GameSessionModel(BaseModel):
    name: str
    status: str = Field(default="pending")
    accepted_prompt_ids: list[str] = Field(default_factory=list)
    current_round: int = 0
    current_iteration: int = 0


class PlayerBidModel(BaseModel):
    player_id: str
    item_name: str
    bid_amount: float
    won: bool = False
