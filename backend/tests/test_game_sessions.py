from __future__ import annotations

from httpx import AsyncClient


async def test_create_and_get_game_session(client: AsyncClient) -> None:
    resp = await client.post("/api/game-sessions", json={"name": "Evening Match"})
    assert resp.status_code == 201
    body = resp.json()
    assert body["name"] == "Evening Match"
    assert body["status"] == "pending"
    assert body["current_round"] == 0
    session_id = body["id"]

    resp = await client.get(f"/api/game-sessions/{session_id}")
    assert resp.status_code == 200
    assert resp.json()["name"] == "Evening Match"


async def test_list_game_sessions_sorted(client: AsyncClient) -> None:
    await client.post("/api/game-sessions", json={"name": "First"})
    await client.post("/api/game-sessions", json={"name": "Second"})

    resp = await client.get("/api/game-sessions")
    assert resp.status_code == 200
    names = [s["name"] for s in resp.json()]
    assert set(names) == {"First", "Second"}


async def test_get_game_session_not_found(client: AsyncClient) -> None:
    resp = await client.get("/api/game-sessions/64b64b64b64b64b64b64b64b")
    assert resp.status_code == 404


async def test_update_game_session(client: AsyncClient) -> None:
    created = await client.post("/api/game-sessions", json={"name": "Match"})
    session_id = created.json()["id"]

    resp = await client.patch(f"/api/game-sessions/{session_id}", json={"status": "running"})
    assert resp.status_code == 200
    assert resp.json()["status"] == "running"


async def test_update_game_session_no_fields_is_noop(client: AsyncClient) -> None:
    created = await client.post("/api/game-sessions", json={"name": "Match"})
    session_id = created.json()["id"]

    resp = await client.patch(f"/api/game-sessions/{session_id}", json={})
    assert resp.status_code == 200
    assert resp.json()["status"] == "pending"


async def test_update_game_session_not_found(client: AsyncClient) -> None:
    resp = await client.patch("/api/game-sessions/64b64b64b64b64b64b64b64b", json={"status": "running"})
    assert resp.status_code == 404


async def test_delete_game_session(client: AsyncClient) -> None:
    created = await client.post("/api/game-sessions", json={"name": "ToDelete"})
    session_id = created.json()["id"]

    resp = await client.delete(f"/api/game-sessions/{session_id}")
    assert resp.status_code == 204

    resp = await client.get(f"/api/game-sessions/{session_id}")
    assert resp.status_code == 404


async def test_delete_game_session_not_found(client: AsyncClient) -> None:
    resp = await client.delete("/api/game-sessions/64b64b64b64b64b64b64b64b")
    assert resp.status_code == 404


async def test_game_sessions_endpoints_503_when_db_not_connected(client_no_db: AsyncClient) -> None:
    oid = "64b64b64b64b64b64b64b64b"
    assert (await client_no_db.post("/api/game-sessions", json={"name": "x"})).status_code == 503
    assert (await client_no_db.get("/api/game-sessions")).status_code == 503
    assert (await client_no_db.get(f"/api/game-sessions/{oid}")).status_code == 503
    assert (await client_no_db.patch(f"/api/game-sessions/{oid}", json={})).status_code == 503
    assert (await client_no_db.delete(f"/api/game-sessions/{oid}")).status_code == 503
