from __future__ import annotations

from datetime import UTC, datetime

from bson import ObjectId
from fastapi import APIRouter, Header, HTTPException, Response, status
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.db.mongo import mongo_manager
from app.schemas.prompts import (
    PromptStatus,
    PromptSubmissionCreate,
    PromptSubmissionOut,
    PromptSubmissionStatusUpdate,
)
from app.services.players import PlayerError, recompute_current_version, submit_from_outside

router = APIRouter(prefix="/prompts", tags=["prompts"])


def _prompt_doc_to_out(p: dict) -> PromptSubmissionOut:
    return PromptSubmissionOut(
        id=str(p["_id"]),
        player_id=p["player_id"],
        prompt_text=p["prompt_text"],
        status=p["status"],
        email=p.get("email"),
        form_response_id=p.get("form_response_id"),
        player_ref=p.get("player_ref"),
        version=p.get("version"),
        source=p.get("source"),
        identity_warning=p.get("identity_warning"),
        created_at=p.get("created_at"),
        updated_at=p.get("updated_at"),
    )


def _verify_webhook_token(token: str | None) -> None:
    if settings.webhook_secret and token != settings.webhook_secret:
        raise HTTPException(status_code=401, detail="Invalid webhook token")


@router.post("/webhook", response_model=PromptSubmissionOut, status_code=status.HTTP_201_CREATED)
async def receive_prompt_webhook(
    payload: PromptSubmissionCreate,
    response: Response,
    x_webhook_token: str | None = Header(default=None),
) -> PromptSubmissionOut | JSONResponse:
    _verify_webhook_token(x_webhook_token)

    db = mongo_manager.db
    if db is None:
        raise HTTPException(status_code=503, detail="Database not connected")

    try:
        result = await submit_from_outside(
            db,
            name=payload.player_id,
            email=payload.email,
            prompt_text=payload.prompt_text,
            form_response_id=payload.form_response_id,
            source="webhook",
        )
    except PlayerError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
    if result.ignored:
        return JSONResponse({"ignored": True, "form_response_id": payload.form_response_id})
    if result.version is None:
        raise HTTPException(status_code=500, detail="Submission was not stored")
    if not result.created:
        response.status_code = status.HTTP_200_OK
    return _prompt_doc_to_out(result.version)


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

    try:
        oid = ObjectId(prompt_id)
    except Exception as exc:
        raise HTTPException(status_code=404, detail="Prompt not found") from exc

    now = datetime.now(UTC)
    result = await db.prompts.update_one(
        {"_id": oid},
        {"$set": {"status": payload.status, "updated_at": now}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Prompt not found")

    prompt = await db.prompts.find_one({"_id": oid})
    if prompt is None:
        raise HTTPException(status_code=404, detail="Prompt not found")
    if prompt.get("player_ref"):
        await recompute_current_version(db, prompt["player_ref"])
    return _prompt_doc_to_out(prompt)
