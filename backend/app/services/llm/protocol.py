from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol, runtime_checkable

from pydantic import BaseModel


class BidResult(BaseModel):
    player_id: str
    bid_amount: float


@dataclass
class ModelMetadata:
    provider: str
    model: str
    temperature: float


@runtime_checkable
class LLMProvider(Protocol):
    async def generate_bids(self, context: dict) -> list[BidResult]: ...
    async def health_check(self) -> bool: ...
    def model_info(self) -> ModelMetadata: ...
