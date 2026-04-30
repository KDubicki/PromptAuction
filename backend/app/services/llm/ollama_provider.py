import json
import logging

import httpx

from app.services.llm.protocol import BidResult, LLMProvider, ModelMetadata

logger = logging.getLogger(__name__)

BID_SYSTEM_PROMPT = """You are an auction bidding AI. Given player prompts and a current item, generate bids for each player.
Return a JSON array of objects with "player_id" and "bid_amount" (float, between 1.0 and 100.0).
Only return the JSON array, no other text."""


class OllamaProvider:
    def __init__(self, model: str, temperature: float, base_url: str = "") -> None:
        self._base_url = base_url or "http://localhost:11434"
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
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    f"{self._base_url}/api/chat",
                    json={
                        "model": self._model,
                        "messages": [
                            {"role": "system", "content": BID_SYSTEM_PROMPT},
                            {"role": "user", "content": user_message},
                        ],
                        "stream": False,
                        "options": {"temperature": self._temperature},
                    },
                )
                response.raise_for_status()
                content = response.json()["message"]["content"]

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
            logger.error("Ollama generate_bids failed: %s", e)
            return []

    async def health_check(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{self._base_url}/api/tags")
                return response.status_code == 200
        except Exception:
            return False

    def model_info(self) -> ModelMetadata:
        return ModelMetadata(provider="ollama", model=self._model, temperature=self._temperature)


def create(model: str, temperature: float, base_url: str = "", **_kwargs: object) -> LLMProvider:
    return OllamaProvider(model=model, temperature=temperature, base_url=base_url)
