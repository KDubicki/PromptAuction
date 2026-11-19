from __future__ import annotations

from unittest.mock import AsyncMock

import pytest
from google.genai import types

from app.services.llm.gemini_provider import GeminiProvider, create
from app.services.llm.manager import create_provider


def _response(text: str | None) -> types.GenerateContentResponse:
    if text is None:
        return types.GenerateContentResponse()
    part = types.Part(text=text)
    return types.GenerateContentResponse(
        candidates=[types.Candidate(content=types.Content(role="model", parts=[part]))]
    )


def _provider(text: str | None = "[]") -> tuple[GeminiProvider, AsyncMock]:
    provider = GeminiProvider(api_key="k", model="gemini-2.5-flash", temperature=0.4)
    mock = AsyncMock(return_value=_response(text))
    provider._client.aio.models.generate_content = mock  # type: ignore[method-assign]
    return provider, mock


def test_create_builds_provider_via_factory() -> None:
    provider = create_provider("gemini", api_key="k", model="gemini-2.5-flash", temperature=0.4)
    assert isinstance(provider, GeminiProvider)
    info = provider.model_info()
    assert (info.provider, info.model, info.temperature) == ("gemini", "gemini-2.5-flash", 0.4)
    assert isinstance(create(api_key="k", model="m", temperature=0.1), GeminiProvider)


async def test_health_check_reads_the_configured_model() -> None:
    provider, _ = _provider()
    get = AsyncMock(return_value=types.Model(name="models/gemini-2.5-flash"))
    provider._client.aio.models.get = get  # type: ignore[method-assign]
    assert await provider.health_check() is True
    assert get.await_args.kwargs["model"] == "gemini-2.5-flash"

    get.side_effect = RuntimeError("invalid key")
    assert await provider.health_check() is False


async def test_complete_json_sends_system_and_user_and_returns_text() -> None:
    provider, mock = _provider('{"a": 1}')

    assert await provider.complete_json("S", "U") == '{"a": 1}'

    kwargs = mock.await_args.kwargs
    assert kwargs["model"] == "gemini-2.5-flash"
    assert kwargs["contents"] == "U"
    assert kwargs["config"].system_instruction == "S"
    assert kwargs["config"].temperature == 0.4
    assert kwargs["config"].response_mime_type == "application/json"


async def test_complete_json_no_text_returns_empty() -> None:
    provider, _ = _provider(None)

    assert await provider.complete_json("S", "U") == ""


async def test_complete_json_propagates_api_errors() -> None:
    provider, mock = _provider()
    mock.side_effect = RuntimeError("boom")

    with pytest.raises(RuntimeError, match="boom"):
        await provider.complete_json("S", "U")
