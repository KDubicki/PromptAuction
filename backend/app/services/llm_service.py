import asyncio
import logging
import time

from app.services.llm.manager import llm_manager

logger = logging.getLogger(__name__)

REQUEST_TIMEOUT_SECONDS: float = 30


class LLMService:
    async def ask_player(self, *, system: str, user: str) -> tuple[str | None, float]:
        """One player's request. Returns ``(text, response_ms)``; ``text`` is None on error or timeout."""
        started = time.monotonic()
        try:
            text = await asyncio.wait_for(llm_manager.complete_json(system, user), REQUEST_TIMEOUT_SECONDS)
        except Exception as e:
            logger.warning("LLM request failed: %s", str(e) or type(e).__name__)
            return None, (time.monotonic() - started) * 1000
        return text, (time.monotonic() - started) * 1000


llm_service = LLMService()
