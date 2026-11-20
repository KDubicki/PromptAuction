from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock

import pytest

from app.services import llm_service as llm_service_module
from app.services.llm.manager import llm_manager
from app.services.llm_service import llm_service


def test_request_timeout_is_thirty_seconds() -> None:
    assert llm_service_module.REQUEST_TIMEOUT_SECONDS == 30


async def test_ask_player_returns_text_and_response_time(monkeypatch: pytest.MonkeyPatch) -> None:
    complete = AsyncMock(return_value='{"bid": 5, "reason": "x"}')
    monkeypatch.setattr(llm_manager, "complete_json", complete)

    text, response_ms = await llm_service.ask_player(system="SYS", user="USR")

    assert text == '{"bid": 5, "reason": "x"}'
    assert response_ms >= 0
    complete.assert_awaited_once_with("SYS", "USR")


async def test_ask_player_times_out_to_none(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    async def slow(system: str, user: str) -> str:
        await asyncio.sleep(5)
        return "{}"

    monkeypatch.setattr(llm_manager, "complete_json", slow)
    monkeypatch.setattr(llm_service_module, "REQUEST_TIMEOUT_SECONDS", 0.01)

    text, response_ms = await llm_service.ask_player(system="SYS", user="USR")

    assert text is None
    assert 0 <= response_ms < 1000
    assert "LLM request failed" in caplog.text
    assert "TimeoutError" in caplog.text


async def test_ask_player_error_to_none(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    monkeypatch.setattr(llm_manager, "complete_json", AsyncMock(side_effect=RuntimeError("quota exceeded")))

    text, response_ms = await llm_service.ask_player(system="SYS", user="USR")

    assert text is None
    assert response_ms >= 0
    assert "quota exceeded" in caplog.text


async def test_ask_player_without_configured_provider_is_none() -> None:
    text, _ = await llm_service.ask_player(system="SYS", user="USR")
    assert text is None
