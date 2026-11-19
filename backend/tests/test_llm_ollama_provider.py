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


async def test_complete_json_sends_system_and_user_and_returns_text(monkeypatch: pytest.MonkeyPatch) -> None:
    import json

    provider = OllamaProvider(model="llama3", temperature=0.5)
    seen: dict = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"] = str(request.url)
        seen["body"] = json.loads(request.content)
        return httpx.Response(200, json={"message": {"content": '{"a": 1}'}})

    monkeypatch.setattr(httpx, "AsyncClient", _client_factory(handler))

    assert await provider.complete_json("S", "U") == '{"a": 1}'

    assert seen["url"] == "http://localhost:11434/api/chat"
    assert seen["body"] == {
        "model": "llama3",
        "messages": [{"role": "system", "content": "S"}, {"role": "user", "content": "U"}],
        "format": "json",
        "stream": False,
        "options": {"temperature": 0.5},
    }


async def test_complete_json_propagates_api_errors(monkeypatch: pytest.MonkeyPatch) -> None:
    provider = OllamaProvider(model="llama3", temperature=0.5)
    monkeypatch.setattr(httpx, "AsyncClient", _client_factory(lambda r: httpx.Response(500, json={})))

    with pytest.raises(httpx.HTTPStatusError):
        await provider.complete_json("S", "U")
