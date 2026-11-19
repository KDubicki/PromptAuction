from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol, runtime_checkable


@dataclass
class ModelMetadata:
    provider: str
    model: str
    temperature: float


@runtime_checkable
class LLMProvider(Protocol):
    async def complete_json(self, system: str, user: str) -> str: ...
    async def health_check(self) -> bool: ...
    def model_info(self) -> ModelMetadata: ...
