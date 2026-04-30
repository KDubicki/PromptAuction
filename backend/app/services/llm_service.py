"""Backward-compatible wrapper around the new LLM manager."""

from collections.abc import Sequence

from app.services.llm.manager import llm_manager


class LLMService:
    async def generate_bids(self, *, context: dict) -> Sequence[dict]:
        return await llm_manager.generate_bids(context)


llm_service = LLMService()
