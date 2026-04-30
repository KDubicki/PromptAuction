from __future__ import annotations

import logging
from typing import Any

from app.services.llm.protocol import BidResult, LLMProvider, ModelMetadata

logger = logging.getLogger(__name__)

_PROVIDERS: dict[str, str] = {
    "openai": "app.services.llm.openai_provider",
    "anthropic": "app.services.llm.anthropic_provider",
    "ollama": "app.services.llm.ollama_provider",
}


def create_provider(
    provider_name: str,
    api_key: str = "",
    model: str = "",
    temperature: float = 0.7,
    base_url: str = "",
) -> LLMProvider:
    import importlib

    module_path = _PROVIDERS.get(provider_name)
    if not module_path:
        raise ValueError(f"Unknown LLM provider: {provider_name}. Available: {list(_PROVIDERS.keys())}")

    module = importlib.import_module(module_path)
    return module.create(api_key=api_key, model=model, temperature=temperature, base_url=base_url)


class LLMServiceManager:
    """Manages primary + fallback LLM provider with runtime hot-swap."""

    def __init__(self) -> None:
        self._primary: LLMProvider | None = None
        self._fallback: LLMProvider | None = None

    def configure(
        self,
        provider_name: str,
        api_key: str = "",
        model: str = "",
        temperature: float = 0.7,
        base_url: str = "",
        fallback_provider: str = "",
    ) -> None:
        self._primary = create_provider(provider_name, api_key, model, temperature, base_url)
        if fallback_provider and fallback_provider != provider_name:
            try:
                self._fallback = create_provider(fallback_provider, api_key, model, temperature, base_url)
            except Exception as e:
                logger.warning("Failed to configure fallback provider '%s': %s", fallback_provider, e)
                self._fallback = None

    def swap_provider(
        self,
        provider_name: str,
        api_key: str = "",
        model: str = "",
        temperature: float = 0.7,
        base_url: str = "",
    ) -> ModelMetadata:
        self._primary = create_provider(provider_name, api_key, model, temperature, base_url)
        return self._primary.model_info()

    async def generate_bids(self, context: dict) -> list[dict[str, Any]]:
        if self._primary is None:
            logger.warning("No LLM provider configured, returning empty bids")
            return []

        bids = await self._primary.generate_bids(context)
        if not bids and self._fallback:
            logger.info("Primary provider returned no bids, trying fallback")
            bids = await self._fallback.generate_bids(context)

        return [b.model_dump() for b in bids]

    async def health_check(self) -> dict[str, bool]:
        result: dict[str, bool] = {}
        if self._primary:
            result["primary"] = await self._primary.health_check()
        if self._fallback:
            result["fallback"] = await self._fallback.health_check()
        return result

    def model_info(self) -> ModelMetadata | None:
        if self._primary:
            return self._primary.model_info()
        return None

    @property
    def is_configured(self) -> bool:
        return self._primary is not None


llm_manager = LLMServiceManager()
