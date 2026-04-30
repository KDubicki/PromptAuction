import json
import logging

from anthropic import AsyncAnthropic

from app.services.llm.protocol import BidResult, LLMProvider, ModelMetadata

logger = logging.getLogger(__name__)

BID_SYSTEM_PROMPT = """You are an auction bidding AI. Given player prompts and a current item, generate bids for each player.
Return a JSON array of objects with "player_id" and "bid_amount" (float, between 1.0 and 100.0).
Only return the JSON array, no other text."""


class AnthropicProvider:
    def __init__(self, api_key: str, model: str, temperature: float) -> None:
        self._client = AsyncAnthropic(api_key=api_key)
        self._model = model
        self._temperature = temperature

    async def generate_bids(self, context: dict) -> list[BidResult]:
        prompts_text = "\n".join(
            f"- Player '{p.get('player_id', 'unknown')}': {p.get('prompt_text', '')}"
            for p in context.get("accepted_prompts", [])
        )
        user_message = (
            f"Current item for auction: {context.get('current_item', 'Unknown Item')}\n\n"
            f"Player prompts:\n{prompts_text}\n\n"
            f"Generate a bid for each player based on their prompt strategy. "
            f"Return ONLY a JSON array of objects with player_id and bid_amount."
        )

        try:
            response = await self._client.messages.create(
                model=self._model,
                max_tokens=1024,
                temperature=self._temperature,
                system=BID_SYSTEM_PROMPT,
                messages=[{"role": "user", "content": user_message}],
            )
            content = response.content[0].text
            # Try to extract JSON from the response
            start = content.find("[")
            end = content.rfind("]") + 1
            if start >= 0 and end > start:
                bids_data = json.loads(content[start:end])
            else:
                bids_data = json.loads(content)

            return [
                BidResult(player_id=b["player_id"], bid_amount=max(1.0, min(100.0, float(b["bid_amount"]))))
                for b in bids_data
                if "player_id" in b and "bid_amount" in b
            ]
        except Exception as e:
            logger.error("Anthropic generate_bids failed: %s", e)
            return []

    async def health_check(self) -> bool:
        try:
            await self._client.messages.create(
                model=self._model,
                max_tokens=10,
                messages=[{"role": "user", "content": "ping"}],
            )
            return True
        except Exception:
            return False

    def model_info(self) -> ModelMetadata:
        return ModelMetadata(provider="anthropic", model=self._model, temperature=self._temperature)


def create(api_key: str, model: str, temperature: float, **_kwargs: object) -> LLMProvider:
    return AnthropicProvider(api_key=api_key, model=model, temperature=temperature)
