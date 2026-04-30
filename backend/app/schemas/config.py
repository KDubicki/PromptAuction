from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class GameConfig(BaseModel):
    """Runtime game configuration stored in MongoDB."""

    # Game loop
    game_rounds: int = Field(default=50, ge=1, le=1000)
    game_iterations_per_round: int = Field(default=45, ge=1, le=500)
    game_engine_sleep_seconds: float = Field(default=1.0, ge=0.1, le=60.0)

    # Bidding rules
    bid_min: float = Field(default=1.0, ge=0.0)
    bid_max: float = Field(default=100.0, ge=1.0)
    starting_budget: float = Field(default=1000.0, ge=0.0)

    # Game mode
    game_mode: Literal["classic", "blitz", "elimination"] = "classic"
    blitz_round_seconds: int = Field(default=30, ge=5, le=300)

    # Item generation
    item_theme: str = Field(default="fantasy", max_length=100)
    item_categories: list[str] = Field(
        default_factory=lambda: ["Art", "Technology", "Magic", "Nature"]
    )

    # LLM overrides (applied on top of env-var provider)
    llm_temperature: float | None = Field(default=None, ge=0.0, le=2.0)


class GameConfigUpdate(BaseModel):
    game_rounds: int | None = Field(default=None, ge=1, le=1000)
    game_iterations_per_round: int | None = Field(default=None, ge=1, le=500)
    game_engine_sleep_seconds: float | None = Field(default=None, ge=0.1, le=60.0)
    bid_min: float | None = Field(default=None, ge=0.0)
    bid_max: float | None = Field(default=None, ge=1.0)
    starting_budget: float | None = Field(default=None, ge=0.0)
    game_mode: Literal["classic", "blitz", "elimination"] | None = None
    blitz_round_seconds: int | None = Field(default=None, ge=5, le=300)
    item_theme: str | None = Field(default=None, max_length=100)
    item_categories: list[str] | None = None
    llm_temperature: float | None = Field(default=None, ge=0.0, le=2.0)


class GameConfigOut(GameConfig):
    version: int = 1
    updated_by: str = "system"
    updated_at: datetime | None = None
