import json
import logging

from google import genai
from google.genai import types

from app.services.llm.protocol import BidResult, LLMProvider, ModelMetadata

logger = logging.getLogger(__name__)

BID_SYSTEM_PROMPT = """You are an auction bidding AI. Given player prompts and a current item, \
generate bids for each player.
Return a JSON array of objects with "player_id" and "bid_amount" (float, between 1.0 and 100.0).
Only return the JSON array, no other text."""


class GeminiProvider:
    def __init__(self, api_key: str, model: str, temperature: float) -> None:
        self._client = genai.Client(api_key=api_key)
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
            response = await self._client.aio.models.generate_content(
                model=self._model,
                contents=user_message,
                config=types.GenerateContentConfig(
                    system_instruction=BID_SYSTEM_PROMPT,
                    temperature=self._temperature,
                    response_mime_type="application/json",
                ),
            )
            content = response.text
            if content is None:
                raise ValueError("Gemini returned no text")
            start = content.find("[")
            end = content.rfind("]") + 1
            bids_data = json.loads(content[start:end] if start >= 0 and end > start else content)

            return [
                BidResult(player_id=b["player_id"], bid_amount=max(1.0, min(100.0, float(b["bid_amount"]))))
                for b in bids_data
                if "player_id" in b and "bid_amount" in b
            ]
        except Exception as e:
            logger.error("Gemini generate_bids failed: %s", e)
            return []

    async def complete_json(self, system: str, user: str) -> str:
        response = await self._client.aio.models.generate_content(
            model=self._model,
            contents=user,
            config=types.GenerateContentConfig(
                system_instruction=system,
                temperature=self._temperature,
                response_mime_type="application/json",
            ),
        )
        return response.text or ""

    async def health_check(self) -> bool:
        try:
            await self._client.aio.models.get(model=self._model)
            return True
        except Exception:
            return False

    def model_info(self) -> ModelMetadata:
        return ModelMetadata(provider="gemini", model=self._model, temperature=self._temperature)


def create(api_key: str, model: str, temperature: float, **_kwargs: object) -> LLMProvider:
    return GeminiProvider(api_key=api_key, model=model, temperature=temperature)
