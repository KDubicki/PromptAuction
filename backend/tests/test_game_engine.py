from __future__ import annotations

import asyncio
import json
import logging
from unittest.mock import AsyncMock

import pytest

from app.services import game_engine as game_engine_module
from app.services.auction.prompt import SYSTEM_PROMPT
from app.services.config_service import config_service
from app.services.game_engine import GameEngineService
from app.services.llm_service import llm_service

PAUSE_REASON = "LLM provider failed 3 rounds in a row"


@pytest.fixture(autouse=True)
def _default_config() -> None:
    config_service._cache = None


def _lot(number: int, item: str, quality: int = 5, required: bool = True) -> dict:
    return {
        "number": number,
        "item": item,
        "quality": quality,
        "required": required,
        "status": "pending",
        "sold_to": None,
        "sold_to_name": None,
        "price": None,
        "sold_in_round": None,
    }


def _player(ref: str, name: str, prompt: str, budget: int = 100) -> dict:
    return {
        "player_ref": ref,
        "name": name,
        "version_id": f"v-{ref}",
        "version": 1,
        "prompt_text": prompt,
        "budget": budget,
        "items": [],
    }


async def _make_session(mock_db, *, lots_count: int = 2, max_rounds: int = 3, **overrides) -> dict:
    doc = {
        "name": "Test Session",
        "status": "running",
        "current_round": 0,
        "current_iteration": 0,
        "settings": {"budget": 100, "lots_count": lots_count, "max_rounds": max_rounds},
        "seed": 1,
        "lots": [_lot(i + 1, f"Item{i + 1}") for i in range(lots_count)],
        "required_items": [f"Item{i + 1}" for i in range(lots_count)],
        "roster": [
            _player("pref-a", "Aurelia", "ALPHA-INSTRUCTIONS"),
            _player("pref-b", "Kestrel", "BETA-INSTRUCTIONS"),
        ],
        "auction": {
            "lot_number": 1,
            "current_round": 1,
            "highest_bid": 0,
            "leader_ref": None,
            "leader_name": None,
            "void_rounds": 0,
        },
        "standings": [],
    }
    doc.update(overrides)
    result = await mock_db.game_sessions.insert_one(doc)
    doc["_id"] = result.inserted_id
    return doc


def _reply(bid: int, reason: str = "because") -> str:
    return json.dumps({"bid": bid, "reason": reason})


def _answers(by_prompt: dict[str, tuple[str | None, float]]) -> AsyncMock:
    """Fake ask_player: picks the reply by which player's instructions are in the user message."""

    async def fake(*, system: str, user: str) -> tuple[str | None, float]:
        for marker, reply in by_prompt.items():
            if marker in user:
                return reply
        raise AssertionError("unknown player in request")

    return AsyncMock(side_effect=fake)


def _patch_answers(monkeypatch: pytest.MonkeyPatch, alpha, beta) -> AsyncMock:
    mock = _answers({"ALPHA-INSTRUCTIONS": alpha, "BETA-INSTRUCTIONS": beta})
    monkeypatch.setattr(llm_service, "ask_player", mock)
    return mock


async def _reload(mock_db, session: dict) -> dict:
    return await mock_db.game_sessions.find_one({"_id": session["_id"]})


async def _bids(mock_db) -> list[dict]:
    return await mock_db.player_bids.find({}).sort([("round", 1), ("player_ref", 1)]).to_list(length=None)


async def test_round_sends_one_request_per_player_with_own_instructions(
    mock_db, monkeypatch: pytest.MonkeyPatch
) -> None:
    session = await _make_session(mock_db)
    ask = _patch_answers(monkeypatch, (_reply(0), 10.0), (_reply(0), 10.0))

    await GameEngineService()._run_iteration(session)

    assert ask.await_count == 2
    users = [call.kwargs["user"] for call in ask.await_args_list]
    assert all(call.kwargs["system"] == SYSTEM_PROMPT for call in ask.await_args_list)
    alpha = next(u for u in users if "ALPHA-INSTRUCTIONS" in u)
    beta = next(u for u in users if "BETA-INSTRUCTIONS" in u)
    assert "BETA-INSTRUCTIONS" not in alpha
    assert "ALPHA-INSTRUCTIONS" not in beta
    assert '"you": "Aurelia"' in alpha
    assert '"you": "Kestrel"' in beta


async def test_round_persists_outcomes_and_advances(mock_db, monkeypatch: pytest.MonkeyPatch) -> None:
    session = await _make_session(mock_db)
    _patch_answers(monkeypatch, (_reply(10, "want it"), 120.0), (_reply(0, "skip"), 80.0))

    await GameEngineService()._run_iteration(session)

    updated = await _reload(mock_db, session)
    assert updated["status"] == "running"
    assert updated["auction"] == {
        "lot_number": 1,
        "current_round": 2,
        "highest_bid": 10,
        "leader_ref": "pref-a",
        "leader_name": "Aurelia",
        "void_rounds": 0,
    }
    assert [p["budget"] for p in updated["roster"]] == [100, 100]

    bids = await _bids(mock_db)
    assert len(bids) == 2
    alpha, beta = bids
    assert {
        k: alpha[k] for k in ("session_id", "lot_number", "item", "round", "player_id", "player_ref")
    } == {
        "session_id": str(session["_id"]),
        "lot_number": 1,
        "item": "Item1",
        "round": 1,
        "player_id": "Aurelia",
        "player_ref": "pref-a",
    }
    assert (alpha["bid"], alpha["reason"], alpha["outcome"], alpha["won"]) == (
        10,
        "want it",
        "leading",
        False,
    )
    assert alpha["response_ms"] == 120.0
    assert alpha["created_at"] is not None
    assert (beta["bid"], beta["reason"], beta["outcome"], beta["won"]) == (0, "skip", "pass", False)


async def test_sale_charges_budget_and_marks_winning_bid(mock_db, monkeypatch: pytest.MonkeyPatch) -> None:
    session = await _make_session(mock_db)
    engine = GameEngineService()

    _patch_answers(monkeypatch, (_reply(30), 50.0), (_reply(20), 40.0))
    await engine._run_iteration(session)

    _patch_answers(monkeypatch, (_reply(0), 50.0), (_reply(0), 40.0))
    await engine._run_iteration(await _reload(mock_db, session))

    updated = await _reload(mock_db, session)
    aurelia, kestrel = updated["roster"]
    assert aurelia["budget"] == 70
    assert kestrel["budget"] == 100
    assert aurelia["items"] == [
        {"item": "Item1", "quality": 5, "required": True, "lot_number": 1, "price": 30}
    ]
    lot = updated["lots"][0]
    assert (lot["status"], lot["sold_to"], lot["sold_to_name"], lot["price"], lot["sold_in_round"]) == (
        "sold",
        "pref-a",
        "Aurelia",
        30,
        2,
    )
    assert updated["auction"]["lot_number"] == 2
    assert updated["auction"]["current_round"] == 1
    assert updated["auction"]["highest_bid"] == 0
    assert updated["standings"][0]["player_ref"] == "pref-a"
    assert updated["standings"][0]["unique_required"] == 1
    assert updated["standings"][0]["budget"] == 70

    bids = await _bids(mock_db)
    assert [(b["round"], b["player_ref"], b["outcome"], b["won"]) for b in bids] == [
        (1, "pref-a", "leading", True),
        (1, "pref-b", "outbid", False),
        (2, "pref-a", "pass", False),
        (2, "pref-b", "pass", False),
    ]


async def test_sale_in_last_round_marks_the_bid_of_that_round(
    mock_db, monkeypatch: pytest.MonkeyPatch
) -> None:
    session = await _make_session(mock_db, max_rounds=1)
    _patch_answers(monkeypatch, (_reply(15), 50.0), (_reply(25), 40.0))

    await GameEngineService()._run_iteration(session)

    updated = await _reload(mock_db, session)
    assert updated["roster"][1]["budget"] == 75
    assert updated["lots"][0]["sold_to"] == "pref-b"
    bids = await _bids(mock_db)
    assert [(b["player_ref"], b["outcome"], b["won"]) for b in bids] == [
        ("pref-a", "outbid", False),
        ("pref-b", "leading", True),
    ]


async def test_sale_marks_only_the_latest_leading_bid_of_the_buyer(
    mock_db, monkeypatch: pytest.MonkeyPatch
) -> None:
    session = await _make_session(mock_db, max_rounds=5)
    engine = GameEngineService()
    for alpha, beta in [(10, 0), (0, 20), (30, 0), (0, 0)]:
        _patch_answers(monkeypatch, (_reply(alpha), 50.0), (_reply(beta), 40.0))
        await engine._run_iteration(await _reload(mock_db, session))

    bids = await _bids(mock_db)
    won = [(b["round"], b["player_ref"]) for b in bids if b["won"]]
    assert won == [(3, "pref-a")]
    assert (await _reload(mock_db, session))["roster"][0]["budget"] == 70


async def test_sale_without_recorded_leading_bid_still_settles(
    mock_db, monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    session = await _make_session(mock_db)
    session["auction"].update(current_round=2, highest_bid=10, leader_ref="pref-a", leader_name="Aurelia")
    await mock_db.game_sessions.update_one({"_id": session["_id"]}, {"$set": {"auction": session["auction"]}})
    _patch_answers(monkeypatch, (_reply(0), 50.0), (_reply(0), 40.0))

    with caplog.at_level(logging.WARNING):
        await GameEngineService()._run_iteration(session)

    assert (await _reload(mock_db, session))["roster"][0]["budget"] == 90
    assert [b["won"] for b in await _bids(mock_db)] == [False, False]
    assert "No leading bid found" in caplog.text


async def test_unsold_lot_moves_on_without_charging(mock_db, monkeypatch: pytest.MonkeyPatch) -> None:
    session = await _make_session(mock_db)
    _patch_answers(monkeypatch, (_reply(0), 50.0), (_reply(500), 40.0))

    await GameEngineService()._run_iteration(session)

    updated = await _reload(mock_db, session)
    assert updated["lots"][0]["status"] == "unsold"
    assert updated["auction"]["lot_number"] == 2
    assert [p["budget"] for p in updated["roster"]] == [100, 100]
    bids = await _bids(mock_db)
    assert [(b["outcome"], b["won"]) for b in bids] == [("pass", False), ("over_budget", False)]


async def test_last_lot_completes_session(mock_db, monkeypatch: pytest.MonkeyPatch) -> None:
    session = await _make_session(mock_db, lots_count=1, max_rounds=1)
    _patch_answers(monkeypatch, (_reply(5), 50.0), (_reply(0), 40.0))

    await GameEngineService()._run_iteration(session)

    updated = await _reload(mock_db, session)
    assert updated["status"] == "completed"
    assert updated["auction"] is None
    assert updated["lots"][0]["status"] == "sold"
    assert updated["roster"][0]["budget"] == 95


async def test_three_void_rounds_pause_session(mock_db, monkeypatch: pytest.MonkeyPatch) -> None:
    session = await _make_session(mock_db)
    monkeypatch.setattr(llm_service, "ask_player", AsyncMock(return_value=(None, 30000.0)))
    engine = GameEngineService()

    for expected_void in (1, 2):
        await engine._run_iteration(await _reload(mock_db, session))
        updated = await _reload(mock_db, session)
        assert updated["status"] == "running"
        assert updated["auction"]["void_rounds"] == expected_void
        assert "pause_reason" not in updated

    await engine._run_iteration(await _reload(mock_db, session))

    updated = await _reload(mock_db, session)
    assert updated["status"] == "paused"
    assert updated["pause_reason"] == PAUSE_REASON
    assert updated["auction"]["void_rounds"] == 3
    assert updated["auction"]["current_round"] == 1
    assert updated["auction"]["lot_number"] == 1
    bids = await _bids(mock_db)
    assert len(bids) == 6
    assert all(b["outcome"] == "no_answer" and b["bid"] is None and b["won"] is False for b in bids)


async def test_answer_resets_void_counter(mock_db, monkeypatch: pytest.MonkeyPatch) -> None:
    session = await _make_session(mock_db)
    session["auction"]["void_rounds"] = 2
    await mock_db.game_sessions.update_one({"_id": session["_id"]}, {"$set": {"auction.void_rounds": 2}})
    _patch_answers(monkeypatch, (None, 30000.0), (_reply(0), 40.0))

    await GameEngineService()._run_iteration(session)

    updated = await _reload(mock_db, session)
    assert updated["status"] == "running"
    assert updated["auction"]["void_rounds"] == 0


async def test_stale_round_is_not_settled_twice(mock_db, monkeypatch: pytest.MonkeyPatch) -> None:
    session = await _make_session(mock_db)
    _patch_answers(monkeypatch, (_reply(10), 50.0), (_reply(0), 40.0))
    engine = GameEngineService()

    await engine._run_iteration(session)
    await engine._run_iteration(session)

    updated = await _reload(mock_db, session)
    assert updated["auction"]["current_round"] == 2
    assert len(await _bids(mock_db)) == 2


async def test_stale_void_round_is_not_counted_twice(mock_db, monkeypatch: pytest.MonkeyPatch) -> None:
    session = await _make_session(mock_db)
    monkeypatch.setattr(llm_service, "ask_player", AsyncMock(return_value=(None, 1.0)))
    engine = GameEngineService()

    await engine._run_iteration(session)
    await engine._run_iteration(session)

    updated = await _reload(mock_db, session)
    assert updated["auction"]["void_rounds"] == 1
    assert len(await _bids(mock_db)) == 2


async def test_round_is_not_settled_once_session_left_running(
    mock_db, monkeypatch: pytest.MonkeyPatch
) -> None:
    session = await _make_session(mock_db)
    await mock_db.game_sessions.update_one({"_id": session["_id"]}, {"$set": {"status": "paused"}})
    _patch_answers(monkeypatch, (_reply(10), 50.0), (_reply(0), 40.0))

    await GameEngineService()._run_iteration(session)

    updated = await _reload(mock_db, session)
    assert updated["status"] == "paused"
    assert updated["auction"]["current_round"] == 1
    assert await _bids(mock_db) == []


async def test_legacy_running_session_is_skipped(
    mock_db, monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    session = await _make_session(mock_db)
    del session["auction"]
    await mock_db.game_sessions.update_one({"_id": session["_id"]}, {"$unset": {"auction": ""}})
    ask = AsyncMock(return_value=(_reply(1), 1.0))
    monkeypatch.setattr(llm_service, "ask_player", ask)

    with caplog.at_level(logging.WARNING):
        await GameEngineService()._run_iteration(session)

    ask.assert_not_called()
    assert await _bids(mock_db) == []
    updated = await _reload(mock_db, session)
    assert updated["status"] == "running"
    assert "auction" not in updated
    assert str(session["_id"]) in caplog.text


async def test_empty_or_garbage_reply_is_no_answer(mock_db, monkeypatch: pytest.MonkeyPatch) -> None:
    session = await _make_session(mock_db)
    _patch_answers(monkeypatch, ("", 50.0), ("not json at all", 40.0))

    await GameEngineService()._run_iteration(session)

    bids = await _bids(mock_db)
    assert [b["outcome"] for b in bids] == ["no_answer", "no_answer"]
    assert [(b["failure"], b["raw_response"]) for b in bids] == [
        ("no_reply", None),
        ("unreadable", "not json at all"),
    ]
    assert (await _reload(mock_db, session))["auction"]["void_rounds"] == 1


async def test_reply_text_is_kept_with_the_bid(mock_db, monkeypatch: pytest.MonkeyPatch) -> None:
    session = await _make_session(mock_db)
    long_reply = _reply(10, "x" * 80) + " " + "y" * 3000
    _patch_answers(monkeypatch, (long_reply, 50.0), (None, 30000.0))

    await GameEngineService()._run_iteration(session)

    alpha, beta = await _bids(mock_db)
    assert alpha["raw_response"] == long_reply[: game_engine_module.RAW_RESPONSE_MAX_LENGTH]
    assert alpha["failure"] is None
    assert (beta["raw_response"], beta["failure"]) == (None, "no_reply")


async def test_failure_for_one_player_only_costs_that_player(
    mock_db, monkeypatch: pytest.MonkeyPatch
) -> None:
    session = await _make_session(mock_db, max_rounds=1)
    _patch_answers(monkeypatch, (_reply(10), 50.0), (_reply(20), 40.0))
    real_parse = game_engine_module.parse_decision

    def exploding_parse(text: str):
        if '"bid": 20' in text:
            raise RecursionError("too deep")
        return real_parse(text)

    monkeypatch.setattr(game_engine_module, "parse_decision", exploding_parse)

    await GameEngineService()._run_iteration(session)

    bids = await _bids(mock_db)
    assert [(b["player_ref"], b["outcome"], b["won"]) for b in bids] == [
        ("pref-a", "leading", True),
        ("pref-b", "no_answer", False),
    ]
    assert (await _reload(mock_db, session))["roster"][0]["budget"] == 90


async def test_state_build_failure_is_no_answer_for_that_player(
    mock_db, monkeypatch: pytest.MonkeyPatch
) -> None:
    session = await _make_session(mock_db)
    ask = _patch_answers(monkeypatch, (_reply(10), 50.0), (_reply(20), 40.0))
    real_build = game_engine_module.build_state

    def exploding_build(doc: dict, player_ref: str) -> dict:
        if player_ref == "pref-b":
            raise StopIteration
        return real_build(doc, player_ref)

    monkeypatch.setattr(game_engine_module, "build_state", exploding_build)

    await GameEngineService()._run_iteration(session)

    assert ask.await_count == 1
    bids = await _bids(mock_db)
    assert [(b["player_ref"], b["outcome"]) for b in bids] == [("pref-a", "leading"), ("pref-b", "no_answer")]


async def test_session_without_roster_is_skipped(mock_db, monkeypatch: pytest.MonkeyPatch) -> None:
    session = await _make_session(mock_db, roster=[])
    ask = AsyncMock(return_value=(_reply(1), 1.0))
    monkeypatch.setattr(llm_service, "ask_player", ask)

    await GameEngineService()._run_iteration(session)

    ask.assert_not_called()
    assert (await _reload(mock_db, session))["lots"][0]["status"] == "pending"


async def test_run_iteration_noop_when_db_not_connected(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.db.mongo import mongo_manager

    mongo_manager.db = None
    ask = AsyncMock()
    monkeypatch.setattr(llm_service, "ask_player", ask)
    await GameEngineService()._run_iteration({"auction": {"lot_number": 1}})
    ask.assert_not_called()


def _fast_loop(monkeypatch: pytest.MonkeyPatch) -> None:
    fast_config = config_service.get_cached().model_copy(update={"game_engine_sleep_seconds": 0.01})
    monkeypatch.setattr(config_service, "get_cached", lambda: fast_config)


async def test_run_loop_processes_running_sessions_then_stops(
    mock_db, monkeypatch: pytest.MonkeyPatch
) -> None:
    running = await _make_session(mock_db)
    pending = await _make_session(mock_db, status="pending")
    _patch_answers(monkeypatch, (_reply(0), 1.0), (_reply(0), 1.0))
    _fast_loop(monkeypatch)

    engine = GameEngineService()
    engine.start()
    await asyncio.sleep(0.05)
    await engine.stop()

    assert (await _reload(mock_db, running))["lots"][0]["status"] == "unsold"
    assert (await _reload(mock_db, pending))["lots"][0]["status"] == "pending"


async def test_run_loop_survives_a_failing_session(mock_db, monkeypatch: pytest.MonkeyPatch) -> None:
    broken = await _make_session(mock_db, settings={})
    healthy = await _make_session(mock_db)
    _patch_answers(monkeypatch, (_reply(0), 1.0), (_reply(0), 1.0))
    _fast_loop(monkeypatch)

    engine = GameEngineService()
    engine.start()
    await asyncio.sleep(0.05)
    await engine.stop()

    assert (await _reload(mock_db, healthy))["lots"][0]["status"] == "unsold"
    assert (await _reload(mock_db, broken))["status"] == "running"


async def test_run_loop_survives_a_failing_tick(
    mock_db, monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    healthy = await _make_session(mock_db)
    _patch_answers(monkeypatch, (_reply(0), 1.0), (_reply(0), 1.0))
    fast_config = config_service.get_cached().model_copy(update={"game_engine_sleep_seconds": 0.01})
    monkeypatch.setattr(game_engine_module, "FALLBACK_SLEEP_SECONDS", 0.01)
    calls = {"n": 0}

    def flaky_get_cached():
        calls["n"] += 1
        if calls["n"] == 1:
            raise RuntimeError("config exploded")
        return fast_config

    monkeypatch.setattr(config_service, "get_cached", flaky_get_cached)

    engine = GameEngineService()
    with caplog.at_level(logging.ERROR):
        engine.start()
        await asyncio.sleep(0.15)
        await engine.stop()

    assert "Game engine tick failed" in caplog.text
    assert (await _reload(mock_db, healthy))["lots"][0]["status"] == "unsold"


async def test_ask_logs_exception_type_when_message_is_empty(
    mock_db, monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    session = await _make_session(mock_db)

    async def boom(*, system: str, user: str):
        raise TimeoutError()

    monkeypatch.setattr(llm_service, "ask_player", boom)
    with caplog.at_level(logging.WARNING):
        await GameEngineService()._ask(session, session["roster"][0])

    assert "TimeoutError" in caplog.text


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


async def test_start_is_idempotent_when_task_already_running(mock_db) -> None:
    engine = GameEngineService()
    engine.start()
    first_task = engine._task
    engine.start()
    assert engine._task is first_task
    await engine.stop()
