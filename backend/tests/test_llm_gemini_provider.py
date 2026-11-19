from __future__ import annotations

from unittest.mock import AsyncMock

from google.genai import types

from app.services.llm.gemini_provider import BID_SYSTEM_PROMPT, GeminiProvider, create
from app.services.llm.manager import create_provider

CONTEXT = {"current_item": "Crystal Fox", "accepted_prompts": [{"player_id": "p1", "prompt_text": "go"}]}


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


async def test_generate_bids_sends_prompt_config_and_parses_json() -> None:
    provider, mock = _provider('[{"player_id": "p1", "bid_amount": 42.5}]')

    bids = await provider.generate_bids(CONTEXT)

    assert [(b.player_id, b.bid_amount) for b in bids] == [("p1", 42.5)]
    kwargs = mock.await_args.kwargs
    assert kwargs["model"] == "gemini-2.5-flash"
    assert "Crystal Fox" in kwargs["contents"]
    assert "Player 'p1': go" in kwargs["contents"]
    config = kwargs["config"]
    assert config.system_instruction == BID_SYSTEM_PROMPT
    assert config.temperature == 0.4
    assert config.response_mime_type == "application/json"


async def test_generate_bids_extracts_array_from_prose_and_clamps() -> None:
    provider, _ = _provider('Here: [{"player_id": "p1", "bid_amount": 500}, {"player_id": "p2"}] done')

    bids = await provider.generate_bids(CONTEXT)

    assert [(b.player_id, b.bid_amount) for b in bids] == [("p1", 100.0)]


async def test_generate_bids_returns_empty_on_bad_or_missing_text() -> None:
    for text in ("not json", None):
        provider, _ = _provider(text)
        assert await provider.generate_bids(CONTEXT) == []


async def test_generate_bids_returns_empty_when_api_fails() -> None:
    provider, mock = _provider()
    mock.side_effect = RuntimeError("quota exceeded")
    assert await provider.generate_bids(CONTEXT) == []


async def test_health_check_reads_the_configured_model() -> None:
    provider, _ = _provider()
    get = AsyncMock(return_value=types.Model(name="models/gemini-2.5-flash"))
    provider._client.aio.models.get = get  # type: ignore[method-assign]
    assert await provider.health_check() is True
    assert get.await_args.kwargs["model"] == "gemini-2.5-flash"

    get.side_effect = RuntimeError("invalid key")
    assert await provider.health_check() is False
