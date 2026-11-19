from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.schemas.prompts import PromptStatus

PromptSource = Literal["admin", "google_forms", "webhook", "migration"]


def _strip_name(value: str | None) -> str | None:
    if value is None:
        return None
    stripped = value.strip()
    if not stripped:
        raise ValueError("name must not be blank")
    return stripped


class PlayerCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    email: str | None = Field(default=None, max_length=320)
    prompt_text: str = Field(..., min_length=3, max_length=2000)

    _strip_name = field_validator("name")(_strip_name)


class PlayerUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    email: str | None = Field(default=None, max_length=320)

    _strip_name = field_validator("name")(_strip_name)


class PromptVersionCreate(BaseModel):
    prompt_text: str = Field(..., min_length=3, max_length=2000)


class PromptVersionOut(BaseModel):
    id: str
    version: int
    prompt_text: str
    status: PromptStatus
    source: PromptSource
    player_name: str
    identity_warning: str | None = None
    email: str | None = None
    created_at: datetime | None = None


class PlayerOut(BaseModel):
    id: str
    name: str
    email: str | None = None
    current_version: PromptVersionOut | None = None
    pending_versions: int = 0
    latest_version: int = 0
    created_at: datetime | None = None


class PlayerDetailOut(PlayerOut):
    versions: list[PromptVersionOut] = Field(default_factory=list)
