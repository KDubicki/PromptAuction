from __future__ import annotations

import httpx
import pytest

from app.services.llm.ollama_provider import OllamaProvider, create

_RealAsyncClient = httpx.AsyncClient


def _client_factory(handler):
    def _factory(*_args, **_kwargs):
        return _RealAsyncClient(transport=httpx.MockTransport(handler), timeout=60.0)

    return _factory


def test_create_uses_default_base_url_when_empty() -> None:
    provider = create(model="llama3", temperature=0.5)
    assert isinstance(provider, OllamaProvider)
    assert provider._base_url == "http://localhost:11434"


def test_create_uses_custom_base_url() -> None:
    provider = create(model="llama3", temperature=0.5, base_url="http://ollama.local:11434")
    assert provider._base_url == "http://ollama.local:11434"


async def test_generate_bids_success(monkeypatch: pytest.MonkeyPatch) -> None:
    provider = OllamaProvider(model="llama3", temperature=0.5)

    def handler(request: httpx.Request) -> httpx.Response:
        body = {"message": {"content": '[{"player_id": "p1", "bid_amount": 33}]'}}
        return httpx.Response(200, json=body)

    monkeypatch.setattr(httpx, "AsyncClient", _client_factory(handler))

    bids = await provider.generate_bids({"accepted_prompts": [{"player_id": "p1", "prompt_text": "go"}]})

    assert len(bids) == 1
    assert bids[0].player_id == "p1"
    assert bids[0].bid_amount == 33.0


async def test_generate_bids_http_error_returns_empty(monkeypatch: pytest.MonkeyPatch) -> None:
    provider = OllamaProvider(model="llama3", temperature=0.5)

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(500, json={"error": "boom"})

    monkeypatch.setattr(httpx, "AsyncClient", _client_factory(handler))

    bids = await provider.generate_bids({})

    assert bids == []


async def test_generate_bids_malformed_json_returns_empty(monkeypatch: pytest.MonkeyPatch) -> None:
    provider = OllamaProvider(model="llama3", temperature=0.5)

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"message": {"content": "not json"}})

    monkeypatch.setattr(httpx, "AsyncClient", _client_factory(handler))

    bids = await provider.generate_bids({})

    assert bids == []


async def test_health_check_true(monkeypatch: pytest.MonkeyPatch) -> None:
    provider = OllamaProvider(model="llama3", temperature=0.5)

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"models": []})

    monkeypatch.setattr(httpx, "AsyncClient", _client_factory(handler))

    assert await provider.health_check() is True


async def test_health_check_false_on_non_200(monkeypatch: pytest.MonkeyPatch) -> None:
    provider = OllamaProvider(model="llama3", temperature=0.5)

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(503)

    monkeypatch.setattr(httpx, "AsyncClient", _client_factory(handler))

    assert await provider.health_check() is False


async def test_health_check_false_on_exception(monkeypatch: pytest.MonkeyPatch) -> None:
    provider = OllamaProvider(model="llama3", temperature=0.5)

    def raise_client(*_args, **_kwargs):
        raise RuntimeError("network down")

    monkeypatch.setattr(httpx, "AsyncClient", raise_client)

    assert await provider.health_check() is False


def test_model_info() -> None:
    provider = OllamaProvider(model="llama3", temperature=0.5)
    info = provider.model_info()
    assert info.provider == "ollama"
    assert info.model == "llama3"

