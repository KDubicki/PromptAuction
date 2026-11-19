from anthropic import AsyncAnthropic
from anthropic.types import TextBlock

from app.services.llm.protocol import LLMProvider, ModelMetadata


class AnthropicProvider:
    def __init__(self, api_key: str, model: str, temperature: float) -> None:
        self._client = AsyncAnthropic(api_key=api_key)
        self._model = model
        self._temperature = temperature

    async def complete_json(self, system: str, user: str) -> str:
        response = await self._client.messages.create(
            model=self._model,
            max_tokens=1024,
            system=system,
            messages=[{"role": "user", "content": user}],
        )
        block = response.content[0] if response.content else None
        if not isinstance(block, TextBlock):
            raise ValueError(f"Unexpected content block type: {type(block).__name__}")
        return block.text

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
