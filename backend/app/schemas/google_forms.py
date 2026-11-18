from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class GoogleFormConnectRequest(BaseModel):
    url: str = Field(..., min_length=1, max_length=2000, description="Form edit link or bare form ID")


class GoogleFormFieldMapping(BaseModel):
    player_id: str | None = None
    prompt_text: str | None = None
    email: str | None = None


class GoogleFormSource(BaseModel):
    form_id: str
    title: str
    edit_url: str
    responder_url: str | None = None
    connected_at: datetime | None = None
    last_synced_at: datetime | None = None
    last_error: str | None = None
    imported_count: int = 0
    skipped_count: int = 0
    mapping: GoogleFormFieldMapping = Field(default_factory=GoogleFormFieldMapping)


class GoogleFormStatus(BaseModel):
    credentials_configured: bool
    credentials_error: str | None = None
    service_account_email: str | None = None
    poll_interval_seconds: float
    form: GoogleFormSource | None = None


class GoogleFormSyncResult(BaseModel):
    imported: int
    skipped: int


class PublicEntryForm(BaseModel):
    title: str
    responder_url: str
