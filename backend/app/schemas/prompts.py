from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

PromptStatus = Literal["pending", "accepted", "rejected"]


class PromptSubmissionCreate(BaseModel):
    player_id: str = Field(
        ..., min_length=1, max_length=100, description="External player identifier from form"
    )
    prompt_text: str = Field(..., min_length=3, max_length=2000)
    email: str | None = Field(default=None, max_length=320)
    form_response_id: str | None = Field(default=None, max_length=200)

    @field_validator("form_response_id", mode="before")
    @classmethod
    def _blank_form_response_id_to_none(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip() or None
        return value

    @field_validator("player_id", mode="before")
    @classmethod
    def _strip_player_id(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class PromptSubmissionStatusUpdate(BaseModel):
    status: PromptStatus


class PromptSubmissionOut(BaseModel):
    id: str
    player_id: str
    prompt_text: str
    status: PromptStatus
    email: str | None = None
    form_response_id: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
    player_ref: str | None = None
    version: int | None = None
    source: str | None = None
    identity_warning: str | None = None
