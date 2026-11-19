import httpx

from app.services.llm.protocol import LLMProvider, ModelMetadata


class OllamaProvider:
    def __init__(self, model: str, temperature: float, base_url: str = "") -> None:
        self._base_url = base_url or "http://localhost:11434"
        self._model = model
        self._temperature = temperature

    async def complete_json(self, system: str, user: str) -> str:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{self._base_url}/api/chat",
                json={
                    "model": self._model,
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user", "content": user},
                    ],
                    "format": "json",
                    "stream": False,
                    "options": {"temperature": self._temperature},
                },
            )
            response.raise_for_status()
            return str(response.json()["message"]["content"])

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
