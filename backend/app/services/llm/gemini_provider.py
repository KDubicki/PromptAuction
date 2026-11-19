from google import genai
from google.genai import types

from app.services.llm.protocol import LLMProvider, ModelMetadata


class GeminiProvider:
    def __init__(self, api_key: str, model: str, temperature: float) -> None:
        self._client = genai.Client(api_key=api_key)
        self._model = model
        self._temperature = temperature

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
