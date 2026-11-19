"""Backward-compatible wrapper around the new LLM manager."""

import asyncio
import logging
import time
from collections.abc import Sequence
from typing import Any

from app.services.llm.manager import llm_manager

logger = logging.getLogger(__name__)


class LLMService:
    async def generate_bids(self, *, context: dict) -> Sequence[dict]:
        return await llm_manager.generate_bids(context)

    async def generate_bids_per_player(self, *, context: dict) -> list[dict[str, Any]]:
        """One request per player, all at once. Each request sees only that player's prompt.

        Returns ``{"player_id", "bid_amount", "response_ms"}`` for every player whose request
        produced a bid; a failed or empty reply just means that player sits this lot out.
        """
        players = context.get("accepted_prompts", [])
        results = await asyncio.gather(*(self._player_bid(context, player) for player in players))
        return [bid for bid in results if bid is not None]

    async def _player_bid(self, context: dict, player: dict) -> dict[str, Any] | None:
        name = player.get("player_id", "")
        started = time.monotonic()
        try:
            bids = await llm_manager.generate_bids({**context, "accepted_prompts": [player]})
        except Exception as e:
            logger.warning("Bid request for %s failed: %s", name, e)
            return None
        response_ms = (time.monotonic() - started) * 1000

        own = [b for b in bids if b.get("player_id") == name]
        if not own and len(bids) == 1:
            own = bids  # the model renamed the player; the reply still answers this request
        if not own:
            return None
        return {"player_id": name, "bid_amount": float(own[0]["bid_amount"]), "response_ms": response_ms}


llm_service = LLMService()
