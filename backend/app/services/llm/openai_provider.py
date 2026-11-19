from openai import AsyncOpenAI

from app.services.llm.protocol import LLMProvider, ModelMetadata


class OpenAIProvider:
    def __init__(self, api_key: str, model: str, temperature: float, base_url: str = "") -> None:
        kwargs: dict = {"api_key": api_key}
        if base_url:
            kwargs["base_url"] = base_url
        self._client = AsyncOpenAI(**kwargs)
        self._model = model
        self._temperature = temperature

    async def complete_json(self, system: str, user: str) -> str:
        response = await self._client.chat.completions.create(
            model=self._model,
            temperature=self._temperature,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
        )
        return response.choices[0].message.content or ""

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
