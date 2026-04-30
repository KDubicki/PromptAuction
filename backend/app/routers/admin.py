from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.schemas.config import GameConfigOut, GameConfigUpdate
from app.services.config_service import config_service
from app.services.llm.manager import llm_manager

router = APIRouter(prefix="/admin", tags=["admin"])


# ── LLM Provider ──────────────────────────────────────────────────────────────

class LLMProviderSwapRequest(BaseModel):
    provider: str = Field(..., description="Provider name: openai, anthropic, ollama")
    model: str = Field(..., description="Model name (e.g. gpt-4o, claude-sonnet-4-20250514)")
    api_key: str = Field(default="", description="API key (not needed for ollama)")
    base_url: str = Field(default="", description="Custom base URL")
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)


class LLMProviderInfoResponse(BaseModel):
    provider: str
    model: str
    temperature: float


class LLMHealthResponse(BaseModel):
    primary: bool | None = None
    fallback: bool | None = None


@router.patch("/llm-provider", response_model=LLMProviderInfoResponse)
async def swap_llm_provider(payload: LLMProviderSwapRequest) -> LLMProviderInfoResponse:
    try:
        meta = llm_manager.swap_provider(
            provider_name=payload.provider,
            api_key=payload.api_key,
            model=payload.model,
            temperature=payload.temperature,
            base_url=payload.base_url,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return LLMProviderInfoResponse(provider=meta.provider, model=meta.model, temperature=meta.temperature)


@router.get("/llm-provider", response_model=LLMProviderInfoResponse)
async def get_llm_provider_info() -> LLMProviderInfoResponse:
    meta = llm_manager.model_info()
    if meta is None:
        raise HTTPException(status_code=404, detail="No LLM provider configured")
    return LLMProviderInfoResponse(provider=meta.provider, model=meta.model, temperature=meta.temperature)


@router.get("/llm-provider/health", response_model=LLMHealthResponse)
async def check_llm_health() -> LLMHealthResponse:
    result = await llm_manager.health_check()
    return LLMHealthResponse(**result)


# ── Game Config ───────────────────────────────────────────────────────────────

@router.get("/config", response_model=GameConfigOut)
async def get_game_config() -> GameConfigOut:
    return await config_service.get()


@router.patch("/config", response_model=GameConfigOut)
async def update_game_config(payload: GameConfigUpdate) -> GameConfigOut:
    try:
        return await config_service.update(payload, updated_by="admin")
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))


@router.post("/config/reset", response_model=GameConfigOut)
async def reset_game_config() -> GameConfigOut:
    try:
        return await config_service.reset_to_defaults(updated_by="admin")
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))


@router.get("/config/history", response_model=list[GameConfigOut])
async def get_config_history(limit: int = 20) -> list[GameConfigOut]:
    return await config_service.get_history(limit=min(limit, 100))

