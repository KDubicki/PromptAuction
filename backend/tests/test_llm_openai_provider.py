from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock

from app.services.llm.openai_provider import OpenAIProvider, create


def _make_response(content: str) -> SimpleNamespace:
    message = SimpleNamespace(content=content)
    choice = SimpleNamespace(message=message)
    return SimpleNamespace(choices=[choice])


def test_create_builds_provider_with_base_url() -> None:
    provider = create(api_key="k", model="gpt-4o-mini", temperature=0.5, base_url="http://custom")
    assert isinstance(provider, OpenAIProvider)
    assert provider.model_info().model == "gpt-4o-mini"


async def test_generate_bids_parses_json_array() -> None:
    provider = OpenAIProvider(api_key="k", model="gpt-4o-mini", temperature=0.5)
    provider._client.chat.completions.create = AsyncMock(
        return_value=_make_response('[{"player_id": "p1", "bid_amount": 42}]')
    )

    bids = await provider.generate_bids({"accepted_prompts": [{"player_id": "p1", "prompt_text": "go"}]})

    assert len(bids) == 1
    assert bids[0].player_id == "p1"
    assert bids[0].bid_amount == 42.0


async def test_generate_bids_parses_json_object_with_bids_key() -> None:
    provider = OpenAIProvider(api_key="k", model="gpt-4o-mini", temperature=0.5)
    provider._client.chat.completions.create = AsyncMock(
        return_value=_make_response('{"bids": [{"player_id": "p1", "bid_amount": 5}]}')
    )

    bids = await provider.generate_bids({})

    assert len(bids) == 1


async def test_generate_bids_clamps_bid_amount() -> None:
    provider = OpenAIProvider(api_key="k", model="gpt-4o-mini", temperature=0.5)
    provider._client.chat.completions.create = AsyncMock(
        return_value=_make_response('[{"player_id": "p1", "bid_amount": 500}]')
    )

    bids = await provider.generate_bids({})

    assert bids[0].bid_amount == 100.0


async def test_generate_bids_skips_entries_missing_fields() -> None:
    provider = OpenAIProvider(api_key="k", model="gpt-4o-mini", temperature=0.5)
    provider._client.chat.completions.create = AsyncMock(
        return_value=_make_response('[{"player_id": "p1"}, {"bid_amount": 5}]')
    )

    bids = await provider.generate_bids({})

    assert bids == []


async def test_generate_bids_handles_null_content() -> None:
    provider = OpenAIProvider(api_key="k", model="gpt-4o-mini", temperature=0.5)
    provider._client.chat.completions.create = AsyncMock(return_value=_make_response(None))

    bids = await provider.generate_bids({})

    assert bids == []


async def test_generate_bids_returns_empty_on_exception() -> None:
    provider = OpenAIProvider(api_key="k", model="gpt-4o-mini", temperature=0.5)
    provider._client.chat.completions.create = AsyncMock(side_effect=RuntimeError("boom"))

    bids = await provider.generate_bids({})

    assert bids == []


async def test_health_check_true() -> None:
    provider = OpenAIProvider(api_key="k", model="gpt-4o-mini", temperature=0.5)
    provider._client.models.list = AsyncMock(return_value=None)

    assert await provider.health_check() is True


async def test_health_check_false_on_exception() -> None:
    provider = OpenAIProvider(api_key="k", model="gpt-4o-mini", temperature=0.5)
    provider._client.models.list = AsyncMock(side_effect=RuntimeError("down"))

    assert await provider.health_check() is False


def test_model_info() -> None:
    provider = OpenAIProvider(api_key="k", model="gpt-4o-mini", temperature=0.5)
    info = provider.model_info()
    assert info.provider == "openai"
    assert info.model == "gpt-4o-mini"
    assert info.temperature == 0.5
