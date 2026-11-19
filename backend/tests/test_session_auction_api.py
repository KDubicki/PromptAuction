from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest
from httpx import AsyncClient
from motor.motor_asyncio import AsyncIOMotorDatabase

from tests.test_session_roster import BAD_ID, _add, _player, _session


async def _ready(client: AsyncClient, settings: dict | None = None) -> str:
    a = await _player(client, "Aurelia", "Text A")
    b = await _player(client, "Brutus", "Text B")
    resp = await client.post("/api/game-sessions", json={"name": "M", "settings": settings})
    assert resp.status_code == 201, resp.text
    sid = resp.json()["id"]
    await _add(client, sid, a["id"])
    await _add(client, sid, b["id"])
    return sid


async def test_create_with_settings_and_defaults(client: AsyncClient) -> None:
    resp = await client.post("/api/game-sessions", json={"name": "Default"})
    assert resp.json()["settings"] == {"budget": 1000, "lots_count": 12, "max_rounds": 10}
    assert resp.json()["lots"] == []
    assert resp.json()["auction"] is None
    assert resp.json()["standings"] == []
    assert resp.json()["pause_reason"] is None

    custom = {"budget": 500, "lots_count": 5, "max_rounds": 3}
    resp = await client.post("/api/game-sessions", json={"name": "Custom", "settings": custom})
    assert resp.status_code == 201
    assert resp.json()["settings"] == custom
    fetched = await client.get(f"/api/game-sessions/{resp.json()['id']}")
    assert fetched.json()["settings"] == custom


@pytest.mark.parametrize(
    "bad",
    [
        {"budget": 0},
        {"budget": 1_000_001},
        {"lots_count": 0},
        {"lots_count": 501},
        {"max_rounds": 0},
        {"max_rounds": 101},
    ],
)
async def test_settings_validation_ranges_422(client: AsyncClient, bad: dict) -> None:
    resp = await client.post("/api/game-sessions", json={"name": "X", "settings": bad})
    assert resp.status_code == 422
    sid = await _session(client)
    resp = await client.patch(f"/api/game-sessions/{sid}", json={"settings": bad})
    assert resp.status_code == 422


async def test_patch_settings_only_while_pending(client: AsyncClient) -> None:
    sid = await _ready(client)
    new = {"budget": 200, "lots_count": 4, "max_rounds": 2}
    resp = await client.patch(f"/api/game-sessions/{sid}", json={"settings": new})
    assert resp.status_code == 200
    assert resp.json()["settings"] == new

    assert (await client.post(f"/api/game-sessions/{sid}/start")).status_code == 200
    resp = await client.patch(f"/api/game-sessions/{sid}", json={"settings": new})
    assert resp.status_code == 409
    resp = await client.patch(f"/api/game-sessions/{sid}", json={"name": "Renamed"})
    assert resp.status_code == 200


async def test_start_generates_lots_budgets_and_auction(client: AsyncClient) -> None:
    sid = await _ready(client, {"budget": 300, "lots_count": 5, "max_rounds": 4})
    resp = await client.post(f"/api/game-sessions/{sid}/start")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert len(body["lots"]) == 5
    assert [lot["number"] for lot in body["lots"]] == [1, 2, 3, 4, 5]
    assert all(lot["status"] == "pending" for lot in body["lots"])
    assert body["required_items"]
    assert body["settings"]["budget"] == 300
    assert all(e["budget"] == 300 and e["items"] == [] for e in body["roster"])
    assert body["auction"] == {
        "lot_number": 1,
        "current_round": 1,
        "highest_bid": 0,
        "leader_ref": None,
        "leader_name": None,
        "void_rounds": 0,
    }
    assert len(body["standings"]) == 2
    assert all(s["rank"] == 1 and s["budget"] == 300 for s in body["standings"])


async def test_start_writes_default_settings_when_doc_has_none(
    client: AsyncClient, mock_db: AsyncIOMotorDatabase
) -> None:
    sid = await _ready(client)
    from bson import ObjectId

    await mock_db.game_sessions.update_one({"_id": ObjectId(sid)}, {"$unset": {"settings": ""}})
    body = (await client.get(f"/api/game-sessions/{sid}")).json()
    assert body["settings"]["lots_count"] == 12
    started = (await client.post(f"/api/game-sessions/{sid}/start")).json()
    assert len(started["lots"]) == 12
    stored = await mock_db.game_sessions.find_one({"_id": ObjectId(sid)})
    assert stored["settings"] == {"budget": 1000, "lots_count": 12, "max_rounds": 10}


async def test_resume_from_paused_resets_void_rounds_and_reason(
    client: AsyncClient, mock_db: AsyncIOMotorDatabase
) -> None:
    from bson import ObjectId

    sid = await _ready(client)
    await client.post(f"/api/game-sessions/{sid}/start")
    await mock_db.game_sessions.update_one(
        {"_id": ObjectId(sid)},
        {"$set": {"status": "paused", "pause_reason": "llm down", "auction.void_rounds": 3}},
    )
    paused = (await client.get(f"/api/game-sessions/{sid}")).json()
    assert paused["pause_reason"] == "llm down"
    assert paused["auction"]["void_rounds"] == 3

    resp = await client.patch(f"/api/game-sessions/{sid}", json={"status": "running"})
    assert resp.status_code == 200
    assert resp.json()["auction"]["void_rounds"] == 0
    assert resp.json()["pause_reason"] is None
    stored = await mock_db.game_sessions.find_one({"_id": ObjectId(sid)})
    assert "pause_reason" not in stored


async def test_bids_endpoint_filters_and_sorts_new_shape_only(
    client: AsyncClient, mock_db: AsyncIOMotorDatabase
) -> None:
    sid = await _ready(client)
    now = datetime.now(UTC)

    def bid(lot: int, rnd: int, ms: float, who: str, session: str = sid) -> dict:
        return {
            "session_id": session,
            "lot_number": lot,
            "item": "Vase",
            "round": rnd,
            "player_id": who,
            "player_ref": "ref-" + who,
            "bid": 10,
            "reason": "r",
            "response_ms": ms,
            "outcome": "valid",
            "won": False,
            "created_at": now + timedelta(seconds=lot),
        }

    await mock_db.player_bids.insert_many(
        [
            {"session_id": sid, "player_id": "old", "item_name": "Old", "bid_amount": 5.0},
            bid(2, 1, 5, "A"),
            bid(1, 2, 9, "A"),
            bid(1, 1, 30, "B"),
            bid(1, 1, 10, "A"),
            bid(1, 1, 1, "Z", session="other"),
        ]
    )
    resp = await client.get(f"/api/game-sessions/{sid}/bids")
    assert resp.status_code == 200
    got = [(b["lot_number"], b["round"], b["response_ms"]) for b in resp.json()]
    assert got == [(1, 1, 10), (1, 1, 30), (1, 2, 9), (2, 1, 5)]
    assert resp.json()[0]["player_id"] == "A"

    resp = await client.get(f"/api/game-sessions/{sid}/bids", params={"lot_number": 2})
    assert [b["lot_number"] for b in resp.json()] == [2]


async def test_bids_endpoint_unknown_session_is_404(client: AsyncClient) -> None:
    assert (await client.get(f"/api/game-sessions/{BAD_ID}/bids")).status_code == 404
    assert (await client.get("/api/game-sessions/64b64b64b64b64b64b64b64b/bids")).status_code == 404


async def test_bids_endpoint_503_without_db(client_no_db: AsyncClient) -> None:
    assert (await client_no_db.get("/api/game-sessions/x/bids")).status_code == 503
