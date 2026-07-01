from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.config import settings
from app.db.mongo import mongo_manager
from app.main import app, lifespan
from app.services.config_service import config_service
from app.services.game_engine import game_engine_service
from app.services.llm.manager import llm_manager


@pytest.fixture(autouse=True)
def _stub_infra(monkeypatch: pytest.MonkeyPatch) -> None:
    """Lifespan touches real infra (Mongo connect, background task) — stub it out for unit testing."""
    monkeypatch.setattr(mongo_manager, "connect", AsyncMock())
    monkeypatch.setattr(mongo_manager, "disconnect", AsyncMock())
    monkeypatch.setattr(config_service, "get", AsyncMock(return_value=None))
    monkeypatch.setattr(game_engine_service, "start", MagicMock())
    monkeypatch.setattr(game_engine_service, "stop", AsyncMock())


async def test_lifespan_configures_llm_when_api_key_present(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "llm_api_key", "test-key")
    monkeypatch.setattr(settings, "llm_provider", "ollama")

    async with lifespan(app):
        assert llm_manager.is_configured is True

    mongo_manager.connect.assert_awaited_once()
    mongo_manager.disconnect.assert_awaited_once()
    game_engine_service.start.assert_called_once()
    game_engine_service.stop.assert_awaited_once()


async def test_lifespan_configures_ollama_even_without_api_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "llm_api_key", "")
    monkeypatch.setattr(settings, "llm_provider", "ollama")

    async with lifespan(app):
        assert llm_manager.is_configured is True


async def test_lifespan_skips_llm_configuration_without_api_key_or_ollama(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "llm_api_key", "")
    monkeypatch.setattr(settings, "llm_provider", "openai")

    async with lifespan(app):
        assert llm_manager.is_configured is False


async def test_health_endpoint_reports_llm_status() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.get("/api/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok", "llm": "not_configured"}
