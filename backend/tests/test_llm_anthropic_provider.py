from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock

from anthropic.types import TextBlock

from app.services.llm.anthropic_provider import AnthropicProvider, create


def _text_block(text: str) -> TextBlock:
    return TextBlock(type="text", text=text)


def test_create_builds_provider() -> None:
    provider = create(api_key="k", model="claude-sonnet-4", temperature=0.3)
    assert isinstance(provider, AnthropicProvider)
    assert provider.model_info().provider == "anthropic"


async def test_generate_bids_extracts_json_array_from_prose() -> None:
    provider = AnthropicProvider(api_key="k", model="claude-sonnet-4", temperature=0.3)
    text = 'Sure! Here you go: [{"player_id": "p1", "bid_amount": 20}] Hope that helps.'
    provider._client.messages.create = AsyncMock(return_value=SimpleNamespace(content=[_text_block(text)]))

    bids = await provider.generate_bids({"accepted_prompts": [{"player_id": "p1", "prompt_text": "go"}]})

    assert len(bids) == 1
    assert bids[0].player_id == "p1"
    assert bids[0].bid_amount == 20.0


async def test_generate_bids_pure_json_without_brackets_wrapper() -> None:
    provider = AnthropicProvider(api_key="k", model="claude-sonnet-4", temperature=0.3)
    provider._client.messages.create = AsyncMock(
        return_value=SimpleNamespace(content=[_text_block("not json at all")])
    )

    bids = await provider.generate_bids({})

    assert bids == []


async def test_generate_bids_clamps_bid_amount() -> None:
    provider = AnthropicProvider(api_key="k", model="claude-sonnet-4", temperature=0.3)
    provider._client.messages.create = AsyncMock(
        return_value=SimpleNamespace(content=[_text_block('[{"player_id": "p1", "bid_amount": -5}]')])
    )

    bids = await provider.generate_bids({})

    assert bids[0].bid_amount == 1.0


async def test_generate_bids_non_text_block_returns_empty() -> None:
    provider = AnthropicProvider(api_key="k", model="claude-sonnet-4", temperature=0.3)
    non_text_block = SimpleNamespace(type="tool_use")
    provider._client.messages.create = AsyncMock(return_value=SimpleNamespace(content=[non_text_block]))

    bids = await provider.generate_bids({})

    assert bids == []


async def test_generate_bids_returns_empty_on_exception() -> None:
    provider = AnthropicProvider(api_key="k", model="claude-sonnet-4", temperature=0.3)
    provider._client.messages.create = AsyncMock(side_effect=RuntimeError("boom"))

    bids = await provider.generate_bids({})

    assert bids == []


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
