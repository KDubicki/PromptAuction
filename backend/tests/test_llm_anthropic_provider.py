from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from anthropic.types import TextBlock

from app.services.llm.anthropic_provider import AnthropicProvider, create


def _text_block(text: str) -> TextBlock:
    return TextBlock(type="text", text=text)


def test_create_builds_provider() -> None:
    provider = create(api_key="k", model="claude-sonnet-4", temperature=0.3)
    assert isinstance(provider, AnthropicProvider)
    assert provider.model_info().provider == "anthropic"


async def test_health_check_true() -> None:
    provider = AnthropicProvider(api_key="k", model="claude-sonnet-4", temperature=0.3)
    provider._client.messages.create = AsyncMock(return_value=SimpleNamespace(content=[_text_block("pong")]))

    assert await provider.health_check() is True


async def test_health_check_false_on_exception() -> None:
    provider = AnthropicProvider(api_key="k", model="claude-sonnet-4", temperature=0.3)
    provider._client.messages.create = AsyncMock(side_effect=RuntimeError("down"))

    assert await provider.health_check() is False


def test_model_info() -> None:
    provider = AnthropicProvider(api_key="k", model="claude-sonnet-4", temperature=0.3)
    info = provider.model_info()
    assert info.provider == "anthropic"
    assert info.model == "claude-sonnet-4"


async def test_complete_json_sends_no_sampling_parameters() -> None:
    # API version 2026-10-21 (anthropic SDK 2.x) rejects temperature/top_p/top_k with a 400.
    provider = AnthropicProvider(api_key="k", model="claude-sonnet-4", temperature=0.3)
    create_mock = AsyncMock(return_value=SimpleNamespace(content=[_text_block("{}")]))
    provider._client.messages.create = create_mock

    await provider.complete_json("S", "U")

    sent = create_mock.await_args.kwargs
    assert not {"temperature", "top_p", "top_k"} & sent.keys()
    assert sent["max_tokens"] == 1024


async def test_complete_json_sends_system_and_user_and_returns_text() -> None:
    provider = AnthropicProvider(api_key="k", model="claude-sonnet-4", temperature=0.3)
    mock = AsyncMock(return_value=SimpleNamespace(content=[_text_block('{"a": 1}')]))
    provider._client.messages.create = mock

    assert await provider.complete_json("S", "U") == '{"a": 1}'

    kwargs = mock.await_args.kwargs
    assert kwargs == {
        "model": "claude-sonnet-4",
        "max_tokens": 1024,
        "system": "S",
        "messages": [{"role": "user", "content": "U"}],
    }
    assert "temperature" not in kwargs


async def test_complete_json_non_text_block_raises() -> None:
    provider = AnthropicProvider(api_key="k", model="m", temperature=0.3)
    block = SimpleNamespace(type="tool_use")
    provider._client.messages.create = AsyncMock(return_value=SimpleNamespace(content=[block]))

    with pytest.raises(ValueError):
        await provider.complete_json("S", "U")


async def test_complete_json_propagates_api_errors() -> None:
    provider = AnthropicProvider(api_key="k", model="m", temperature=0.3)
    provider._client.messages.create = AsyncMock(side_effect=RuntimeError("boom"))

    with pytest.raises(RuntimeError, match="boom"):
        await provider.complete_json("S", "U")
