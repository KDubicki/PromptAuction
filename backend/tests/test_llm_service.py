from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock

import pytest

from app.services.llm.manager import llm_manager
from app.services.llm_service import llm_service


async def test_llm_service_delegates_to_manager(monkeypatch: pytest.MonkeyPatch) -> None:
    fake_bids = [{"player_id": "p1", "bid_amount": 5.0}]
    monkeypatch.setattr(llm_manager, "generate_bids", AsyncMock(return_value=fake_bids))

    result = await llm_service.generate_bids(context={"foo": "bar"})

    assert result == [{"player_id": "p1", "bid_amount": 5.0}]
    llm_manager.generate_bids.assert_awaited_once_with({"foo": "bar"})


PLAYERS = [
    {"player_id": "Aurelia", "prompt_text": "Bid high on magic."},
    {"player_id": "Kestrel", "prompt_text": "Prefer technology."},
]


async def test_per_player_bids_send_each_player_only_their_own_prompt(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    seen: list[list[dict]] = []

    async def fake(context: dict) -> list[dict]:
        seen.append(context["accepted_prompts"])
        player = context["accepted_prompts"][0]["player_id"]
        return [{"player_id": player, "bid_amount": 10.0 if player == "Aurelia" else 20.0}]

    monkeypatch.setattr(llm_manager, "generate_bids", fake)

    bids = await llm_service.generate_bids_per_player(
        context={"current_item": "Fox", "accepted_prompts": PLAYERS}
    )

    assert sorted(seen, key=lambda p: p[0]["player_id"]) == [[PLAYERS[0]], [PLAYERS[1]]]
    assert {b["player_id"]: b["bid_amount"] for b in bids} == {"Aurelia": 10.0, "Kestrel": 20.0}
    assert all(b["response_ms"] >= 0 for b in bids)


async def test_per_player_bids_run_concurrently_and_time_each_reply(monkeypatch: pytest.MonkeyPatch) -> None:
    started = 0
    both_started = asyncio.Event()

    async def fake(context: dict) -> list[dict]:
        nonlocal started
        started += 1
        if started == 2:
            both_started.set()
        # Neither call can finish until both have started: proves they run at the same time.
        await asyncio.wait_for(both_started.wait(), timeout=1)
        player = context["accepted_prompts"][0]["player_id"]
        await asyncio.sleep(0.05 if player == "Aurelia" else 0)
        return [{"player_id": player, "bid_amount": 5.0}]

    monkeypatch.setattr(llm_manager, "generate_bids", fake)

    bids = await llm_service.generate_bids_per_player(context={"accepted_prompts": PLAYERS})

    times = {b["player_id"]: b["response_ms"] for b in bids}
    assert times["Kestrel"] < times["Aurelia"]


async def test_a_failed_or_empty_reply_only_costs_that_player(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake(context: dict) -> list[dict]:
        player = context["accepted_prompts"][0]["player_id"]
        if player == "Aurelia":
            raise RuntimeError("quota exceeded")
        return [{"player_id": player, "bid_amount": 7.0}]

    monkeypatch.setattr(llm_manager, "generate_bids", fake)
    bids = await llm_service.generate_bids_per_player(context={"accepted_prompts": PLAYERS})
    assert [b["player_id"] for b in bids] == ["Kestrel"]

    monkeypatch.setattr(llm_manager, "generate_bids", AsyncMock(return_value=[]))
    assert await llm_service.generate_bids_per_player(context={"accepted_prompts": PLAYERS}) == []


async def test_single_reply_under_another_name_is_credited_to_the_asking_player(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        llm_manager, "generate_bids", AsyncMock(return_value=[{"player_id": "player_1", "bid_amount": 9.0}])
    )
    bids = await llm_service.generate_bids_per_player(context={"accepted_prompts": PLAYERS[:1]})
    assert [(b["player_id"], b["bid_amount"]) for b in bids] == [("Aurelia", 9.0)]

    monkeypatch.setattr(
        llm_manager,
        "generate_bids",
        AsyncMock(
            return_value=[{"player_id": "x", "bid_amount": 1.0}, {"player_id": "y", "bid_amount": 2.0}]
        ),
    )
    assert await llm_service.generate_bids_per_player(context={"accepted_prompts": PLAYERS[:1]}) == []
