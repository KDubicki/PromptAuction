from collections.abc import Sequence


class LLMService:
    async def generate_bids(self, *, context: dict) -> Sequence[dict]:
        """Placeholder for real LLM integration."""
        _ = context
        return [{"player_id": "placeholder-player", "bid_amount": 10.0}]


llm_service = LLMService()
