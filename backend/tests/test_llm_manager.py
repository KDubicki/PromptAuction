from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from app.services.llm.manager import LLMServiceManager, create_provider
from app.services.llm.protocol import BidResult, ModelMetadata


def test_create_provider_unknown_raises_value_error() -> None:
    with pytest.raises(ValueError, match="Unknown LLM provider"):
        create_provider("not-a-real-provider")


def test_create_provider_ollama_builds_instance() -> None:
    provider = create_provider("ollama", model="llama3", temperature=0.5)
    assert provider.model_info().provider == "ollama"


def test_configure_sets_primary_and_fallback() -> None:
    manager = LLMServiceManager()
    manager.configure(provider_name="ollama", model="a", fallback_provider="ollama")
    # fallback == primary provider name -> fallback intentionally left unset
    assert manager.is_configured is True
    assert manager._fallback is None


def test_configure_with_distinct_fallback() -> None:
    manager = LLMServiceManager()
    manager.configure(provider_name="ollama", model="a", fallback_provider="openai", api_key="k")
    assert manager._fallback is not None


def test_configure_fallback_failure_is_swallowed(monkeypatch: pytest.MonkeyPatch) -> None:
    manager = LLMServiceManager()

    def fake_create_provider(provider_name: str, *_args: object, **_kwargs: object) -> object:
        if provider_name == "broken":
            raise RuntimeError("boom")
        return create_provider("ollama", model="a")

    monkeypatch.setattr("app.services.llm.manager.create_provider", fake_create_provider)
    manager.configure(provider_name="ollama", model="a", fallback_provider="broken")

    assert manager.is_configured is True
    assert manager._fallback is None


def test_swap_provider_returns_metadata() -> None:
    manager = LLMServiceManager()
    meta = manager.swap_provider(provider_name="ollama", model="llama3", temperature=0.9)
    assert meta == ModelMetadata(provider="ollama", model="llama3", temperature=0.9)


async def test_generate_bids_no_primary_returns_empty() -> None:
    manager = LLMServiceManager()
    assert await manager.generate_bids({}) == []


async def test_generate_bids_uses_primary_when_it_has_results() -> None:
    manager = LLMServiceManager()
    manager._primary = MagicMock()
    manager._primary.generate_bids = AsyncMock(return_value=[BidResult(player_id="p1", bid_amount=5.0)])
    manager._fallback = MagicMock()
    manager._fallback.generate_bids = AsyncMock(return_value=[])

    result = await manager.generate_bids({})

    assert result == [{"player_id": "p1", "bid_amount": 5.0}]
    manager._fallback.generate_bids.assert_not_called()


async def test_generate_bids_falls_back_when_primary_empty() -> None:
    manager = LLMServiceManager()
    manager._primary = MagicMock()
    manager._primary.generate_bids = AsyncMock(return_value=[])
    manager._fallback = MagicMock()
    manager._fallback.generate_bids = AsyncMock(return_value=[BidResult(player_id="p2", bid_amount=7.0)])

    result = await manager.generate_bids({})

    assert result == [{"player_id": "p2", "bid_amount": 7.0}]


async def test_health_check_no_providers() -> None:
    manager = LLMServiceManager()
    assert await manager.health_check() == {}


async def test_health_check_primary_and_fallback() -> None:
    manager = LLMServiceManager()
    manager._primary = MagicMock()
    manager._primary.health_check = AsyncMock(return_value=True)
    manager._fallback = MagicMock()
    manager._fallback.health_check = AsyncMock(return_value=False)

    result = await manager.health_check()

    assert result == {"primary": True, "fallback": False}


def test_model_info_none_when_unconfigured() -> None:
    manager = LLMServiceManager()
    assert manager.model_info() is None
