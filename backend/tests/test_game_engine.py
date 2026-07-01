from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock

import pytest

from app.services.config_service import config_service
from app.services.game_engine import GameEngineService
from app.services.llm_service import llm_service


@pytest.fixture(autouse=True)
def _default_config() -> None:
    config_service._cache = None


async def _make_session(mock_db, **overrides) -> dict:
    doc = {
        "name": "Test Session",
        "status": "running",
        "accepted_prompt_ids": [],
        "current_round": 0,
        "current_iteration": 0,
    }
    doc.update(overrides)
    result = await mock_db.game_sessions.insert_one(doc)
    doc["_id"] = result.inserted_id
    return doc


async def test_run_iteration_advances_iteration_and_stores_bids(
    mock_db, monkeypatch: pytest.MonkeyPatch
) -> None:
    session = await _make_session(mock_db)
    monkeypatch.setattr(
        llm_service, "generate_bids", AsyncMock(return_value=[{"player_id": "p1", "bid_amount": 50.0}])
    )

    engine = GameEngineService()
    await engine._run_iteration(session)

    updated = await mock_db.game_sessions.find_one({"_id": session["_id"]})
    assert updated["current_iteration"] == 1
    assert updated["current_round"] == 0

    bids = await mock_db.player_bids.find({}).to_list(length=10)
    assert len(bids) == 1
    assert bids[0]["player_id"] == "p1"
    assert bids[0]["bid_amount"] == 50.0
    assert bids[0]["won"] is False
    assert bids[0]["session_id"] == str(session["_id"])


async def test_run_iteration_clamps_bid_to_config_bounds(mock_db, monkeypatch: pytest.MonkeyPatch) -> None:
    session = await _make_session(mock_db)
    monkeypatch.setattr(
        llm_service, "generate_bids", AsyncMock(return_value=[{"player_id": "p1", "bid_amount": 99999.0}])
    )

    engine = GameEngineService()
    await engine._run_iteration(session)

    bids = await mock_db.player_bids.find({}).to_list(length=10)
    assert bids[0]["bid_amount"] == config_service.get_cached().bid_max


async def test_run_iteration_rolls_over_round_when_iterations_exhausted(
    mock_db, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(llm_service, "generate_bids", AsyncMock(return_value=[]))
    cfg = config_service.get_cached()
    session = await _make_session(mock_db, current_round=0, current_iteration=cfg.game_iterations_per_round)

    engine = GameEngineService()
    await engine._run_iteration(session)

    updated = await mock_db.game_sessions.find_one({"_id": session["_id"]})
    assert updated["current_round"] == 1
    assert updated["current_iteration"] == 1


async def test_run_iteration_completes_session_when_rounds_exhausted(
    mock_db, monkeypatch: pytest.MonkeyPatch
) -> None:
    generate_bids = AsyncMock(return_value=[])
    monkeypatch.setattr(llm_service, "generate_bids", generate_bids)
    cfg = config_service.get_cached()
    session = await _make_session(mock_db, current_round=cfg.game_rounds)

    engine = GameEngineService()
    await engine._run_iteration(session)

    updated = await mock_db.game_sessions.find_one({"_id": session["_id"]})
    assert updated["status"] == "completed"
    generate_bids.assert_not_called()


async def test_run_iteration_no_bids_does_not_insert(mock_db, monkeypatch: pytest.MonkeyPatch) -> None:
    session = await _make_session(mock_db)
    monkeypatch.setattr(llm_service, "generate_bids", AsyncMock(return_value=[]))

    engine = GameEngineService()
    await engine._run_iteration(session)

    bids = await mock_db.player_bids.find({}).to_list(length=10)
    assert bids == []


async def test_run_iteration_noop_when_db_not_connected(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.db.mongo import mongo_manager

    mongo_manager.db = None
    engine = GameEngineService()
    # Should return early without raising, even though session dict has no _id lookups performed.
    await engine._run_iteration({"current_round": 0, "current_iteration": 0})


async def test_run_loop_processes_running_sessions_then_stops(
    mock_db, monkeypatch: pytest.MonkeyPatch
) -> None:
    await _make_session(mock_db)
    await _make_session(mock_db, status="pending")  # should be ignored by the query filter
    monkeypatch.setattr(llm_service, "generate_bids", AsyncMock(return_value=[]))
    fast_config = config_service.get_cached().model_copy(update={"game_engine_sleep_seconds": 0.01})
    monkeypatch.setattr(config_service, "get_cached", lambda: fast_config)

    engine = GameEngineService()
    engine.start()
    await asyncio.sleep(0.05)
    await engine.stop()

    sessions = await mock_db.game_sessions.find({}).to_list(length=10)
    running = [s for s in sessions if s["status"] == "running"]
    assert running[0]["current_iteration"] >= 1


async def test_run_loop_sleeps_when_db_not_connected() -> None:
    from app.db.mongo import mongo_manager

    mongo_manager.db = None
    engine = GameEngineService()
    engine.start()
    await asyncio.sleep(0.05)
    await engine.stop()
    assert engine._task.cancelled() or engine._task.done()


async def test_stop_without_start_is_noop() -> None:
    engine = GameEngineService()
    await engine.stop()


async def test_start_is_idempotent_when_task_already_running(
    mock_db, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(llm_service, "generate_bids", AsyncMock(return_value=[]))
    engine = GameEngineService()
    engine.start()
    first_task = engine._task
    engine.start()
    assert engine._task is first_task
    await engine.stop()
