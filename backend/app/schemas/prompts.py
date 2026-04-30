from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

PromptStatus = Literal["pending", "accepted", "rejected"]


class PromptSubmissionCreate(BaseModel):
    player_id: str = Field(..., description="External player identifier from form")
    prompt_text: str = Field(..., min_length=3, max_length=2000)
    email: str | None = Field(default=None, max_length=320)
    form_response_id: str | None = Field(default=None, max_length=200)


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
