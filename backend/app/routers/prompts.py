from bson import ObjectId
from fastapi import APIRouter, HTTPException, status

from app.db.mongo import mongo_manager
from app.schemas.prompts import (
    PromptSubmissionCreate,
    PromptSubmissionOut,
    PromptSubmissionStatusUpdate,
)

router = APIRouter(prefix="/prompts", tags=["prompts"])


@router.post("/webhook", response_model=PromptSubmissionOut, status_code=status.HTTP_201_CREATED)
async def receive_prompt_webhook(payload: PromptSubmissionCreate) -> PromptSubmissionOut:
    db = mongo_manager.db
    if db is None:
        raise HTTPException(status_code=503, detail="Database not connected")

    doc = payload.model_dump() | {"status": "pending"}
    result = await db.prompts.insert_one(doc)
    return PromptSubmissionOut(id=str(result.inserted_id), **doc)


@router.get("", response_model=list[PromptSubmissionOut])
async def list_prompts(status_filter: str | None = None) -> list[PromptSubmissionOut]:
    db = mongo_manager.db
    if db is None:
        raise HTTPException(status_code=503, detail="Database not connected")

    query = {"status": status_filter} if status_filter else {}
    prompts = await db.prompts.find(query).to_list(length=500)
    return [
        PromptSubmissionOut(
            id=str(p["_id"]),
            player_id=p["player_id"],
            prompt_text=p["prompt_text"],
            status=p["status"],
        )
        for p in prompts
    ]


@router.patch("/{prompt_id}/status", response_model=PromptSubmissionOut)
async def update_prompt_status(prompt_id: str, payload: PromptSubmissionStatusUpdate) -> PromptSubmissionOut:
    db = mongo_manager.db
    if db is None:
        raise HTTPException(status_code=503, detail="Database not connected")

    if payload.status not in {"accepted", "rejected", "pending"}:
        raise HTTPException(status_code=400, detail="Invalid status")

    await db.prompts.update_one({"_id": ObjectId(prompt_id)}, {"$set": {"status": payload.status}})
    prompt = await db.prompts.find_one({"_id": ObjectId(prompt_id)})
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")

    return PromptSubmissionOut(
        id=str(prompt["_id"]),
        player_id=prompt["player_id"],
        prompt_text=prompt["prompt_text"],
        status=prompt["status"],
    )
