from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class UserCreate(BaseModel):
    username: str = Field(..., min_length=2, max_length=50)
    email: str = Field(..., max_length=320)


class UserUpdate(BaseModel):
    username: str | None = Field(default=None, min_length=2, max_length=50)
    email: str | None = Field(default=None, max_length=320)


class UserOut(BaseModel):
    id: str
    username: str
    email: str
    created_at: datetime | None = None
    updated_at: datetime | None = None
