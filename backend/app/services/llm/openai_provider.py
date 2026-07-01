import json
import logging

from openai import AsyncOpenAI

from app.services.llm.protocol import BidResult, LLMProvider, ModelMetadata

logger = logging.getLogger(__name__)

BID_SYSTEM_PROMPT = """You are an auction bidding AI. Given player prompts and a current item, \
generate bids for each player.
Return a JSON array of objects with "player_id" and "bid_amount" (float, between 1.0 and 100.0).
Only return the JSON array, no other text."""


class OpenAIProvider:
    def __init__(self, api_key: str, model: str, temperature: float, base_url: str = "") -> None:
        kwargs: dict = {"api_key": api_key}
        if base_url:
            kwargs["base_url"] = base_url
        self._client = AsyncOpenAI(**kwargs)
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
            f"Generate a bid for each player based on their prompt strategy."
        )

        try:
            response = await self._client.chat.completions.create(
                model=self._model,
                temperature=self._temperature,
                messages=[
                    {"role": "system", "content": BID_SYSTEM_PROMPT},
                    {"role": "user", "content": user_message},
                ],
                response_format={"type": "json_object"},
            )
            content = response.choices[0].message.content or "[]"
            parsed = json.loads(content)
            bids_data = parsed if isinstance(parsed, list) else parsed.get("bids", [])
            return [
                BidResult(player_id=b["player_id"], bid_amount=max(1.0, min(100.0, float(b["bid_amount"]))))
                for b in bids_data
                if "player_id" in b and "bid_amount" in b
            ]
        except Exception as e:
            logger.error("OpenAI generate_bids failed: %s", e)
            return []

    async def health_check(self) -> bool:
        try:
            await self._client.models.list()
            return True
        except Exception:
            return False

    def model_info(self) -> ModelMetadata:
        return ModelMetadata(provider="openai", model=self._model, temperature=self._temperature)


def create(api_key: str, model: str, temperature: float, base_url: str = "") -> LLMProvider:
    return OpenAIProvider(api_key=api_key, model=model, temperature=temperature, base_url=base_url)
