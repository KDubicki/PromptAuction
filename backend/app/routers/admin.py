from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.llm.manager import llm_manager

router = APIRouter(prefix="/admin", tags=["admin"])


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
