from __future__ import annotations

from datetime import UTC, datetime

from bson import ObjectId
from fastapi import APIRouter, Header, HTTPException, status

from app.core.config import settings
from app.db.mongo import mongo_manager
from app.schemas.prompts import (
    PromptStatus,
    PromptSubmissionCreate,
    PromptSubmissionOut,
    PromptSubmissionStatusUpdate,
)

router = APIRouter(prefix="/prompts", tags=["prompts"])


def _prompt_doc_to_out(p: dict) -> PromptSubmissionOut:
    return PromptSubmissionOut(
        id=str(p["_id"]),
        player_id=p["player_id"],
        prompt_text=p["prompt_text"],
        status=p["status"],
        email=p.get("email"),
        form_response_id=p.get("form_response_id"),
        created_at=p.get("created_at"),
        updated_at=p.get("updated_at"),
    )


def _verify_webhook_token(token: str | None) -> None:
    if settings.webhook_secret and token != settings.webhook_secret:
        raise HTTPException(status_code=401, detail="Invalid webhook token")


@router.post("/webhook", response_model=PromptSubmissionOut, status_code=status.HTTP_201_CREATED)
async def receive_prompt_webhook(
    payload: PromptSubmissionCreate,
    x_webhook_token: str | None = Header(default=None),
) -> PromptSubmissionOut:
    _verify_webhook_token(x_webhook_token)

    db = mongo_manager.db
    if db is None:
        raise HTTPException(status_code=503, detail="Database not connected")

    if payload.form_response_id:
        existing = await db.prompts.find_one({"form_response_id": payload.form_response_id})
        if existing:
            return _prompt_doc_to_out(existing)

    now = datetime.now(UTC)
    doc = payload.model_dump() | {"status": "pending", "created_at": now, "updated_at": now}
    result = await db.prompts.insert_one(doc)
    doc["_id"] = result.inserted_id
    return _prompt_doc_to_out(doc)


@router.get("", response_model=list[PromptSubmissionOut])
async def list_prompts(status_filter: PromptStatus | None = None) -> list[PromptSubmissionOut]:
    db = mongo_manager.db
    if db is None:
        raise HTTPException(status_code=503, detail="Database not connected")

    query: dict = {"status": status_filter} if status_filter else {}
    prompts = await db.prompts.find(query).sort("created_at", -1).to_list(length=500)
    return [_prompt_doc_to_out(p) for p in prompts]


@router.patch("/{prompt_id}/status", response_model=PromptSubmissionOut)
async def update_prompt_status(prompt_id: str, payload: PromptSubmissionStatusUpdate) -> PromptSubmissionOut:
    db = mongo_manager.db
    if db is None:
        raise HTTPException(status_code=503, detail="Database not connected")

    now = datetime.now(UTC)
    result = await db.prompts.update_one(
        {"_id": ObjectId(prompt_id)},
        {"$set": {"status": payload.status, "updated_at": now}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Prompt not found")

    prompt = await db.prompts.find_one({"_id": ObjectId(prompt_id)})
    if prompt is None:
        raise HTTPException(status_code=404, detail="Prompt not found")
    return _prompt_doc_to_out(prompt)
