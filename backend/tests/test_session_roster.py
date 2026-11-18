from __future__ import annotations

from httpx import AsyncClient

BAD_ID = "not-an-object-id"


async def _player(client: AsyncClient, name: str, text: str = "Bid smart.") -> dict:
    resp = await client.post("/api/players", json={"name": name, "prompt_text": text})
    assert resp.status_code == 201, resp.text
    return resp.json()


async def _session(client: AsyncClient, name: str = "Match") -> str:
    resp = await client.post("/api/game-sessions", json={"name": name})
    assert resp.status_code == 201
    return resp.json()["id"]


async def _add(client: AsyncClient, session_id: str, player_id: str):
    return await client.post(f"/api/game-sessions/{session_id}/players", json={"player_id": player_id})


async def _started_session(client: AsyncClient) -> tuple[str, dict, dict]:
    a = await _player(client, "Aurelia", "Text A")
    b = await _player(client, "Brutus", "Text B")
    sid = await _session(client)
    await _add(client, sid, a["id"])
    await _add(client, sid, b["id"])
    resp = await client.post(f"/api/game-sessions/{sid}/start")
    assert resp.status_code == 200, resp.text
    return sid, a, b


async def test_add_and_remove_roster_while_pending(client: AsyncClient) -> None:
    player = await _player(client, "Aurelia")
    sid = await _session(client)

    resp = await _add(client, sid, player["id"])
    assert resp.status_code == 201
    entry = resp.json()["roster"][0]
    assert entry["player_ref"] == player["id"]
    assert entry["name"] == "Aurelia"
    assert entry["current_version"] == 1
    assert entry["version_id"] is None
    assert entry["version"] is None
    assert entry["prompt_text"] is None

    resp = await client.delete(f"/api/game-sessions/{sid}/players/{player['id']}")
    assert resp.status_code == 200
    assert resp.json()["roster"] == []


async def test_add_same_player_twice_is_409(client: AsyncClient) -> None:
    player = await _player(client, "Aurelia")
    sid = await _session(client)
    assert (await _add(client, sid, player["id"])).status_code == 201
    assert (await _add(client, sid, player["id"])).status_code == 409


async def test_add_unknown_player_is_404(client: AsyncClient) -> None:
    sid = await _session(client)
    assert (await _add(client, sid, "64b64b64b64b64b64b64b64b")).status_code == 404
    assert (await _add(client, sid, BAD_ID)).status_code == 404


async def test_add_to_unknown_session_is_404(client: AsyncClient) -> None:
    player = await _player(client, "Aurelia")
    assert (await _add(client, "64b64b64b64b64b64b64b64b", player["id"])).status_code == 404


async def test_remove_player_not_in_roster_is_404(client: AsyncClient) -> None:
    player = await _player(client, "Aurelia")
    sid = await _session(client)
    assert (await client.delete(f"/api/game-sessions/{sid}/players/{player['id']}")).status_code == 404


async def test_roster_locked_after_start_is_409(client: AsyncClient) -> None:
    sid, a, _ = await _started_session(client)
    extra = await _player(client, "Cassia")
    assert (await _add(client, sid, extra["id"])).status_code == 409
    assert (await client.delete(f"/api/game-sessions/{sid}/players/{a['id']}")).status_code == 409


async def test_start_blockers_listed(client: AsyncClient) -> None:
    a = await _player(client, "Aurelia")
    sid = await _session(client)
    await _add(client, sid, a["id"])
    body = (await client.get(f"/api/game-sessions/{sid}")).json()
    assert body["start_blockers"] == ["Add at least 2 players"]

    await client.post("/api/prompts/webhook", json={"player_id": "Morrow", "prompt_text": "Shadow."})
    morrow = next(p for p in (await client.get("/api/players")).json() if p["name"] == "Morrow")
    resp = await _add(client, sid, morrow["id"])
    assert resp.json()["roster"][1]["current_version"] is None
    assert "Morrow has no accepted prompt yet" in resp.json()["start_blockers"]

    assert (await client.post(f"/api/game-sessions/{sid}/start")).status_code == 409


async def test_start_pins_current_versions(client: AsyncClient) -> None:
    sid, a, _ = await _started_session(client)
    body = (await client.get(f"/api/game-sessions/{sid}")).json()
    assert body["status"] == "running"
    assert body["started_at"] is not None
    assert body["start_blockers"] == []
    entry = next(e for e in body["roster"] if e["player_ref"] == a["id"])
    assert entry["version"] == 1
    assert entry["prompt_text"] == "Text A"
    assert entry["version_id"] == a["current_version"]["id"]

    resp = await client.post(f"/api/players/{a['id']}/versions", json={"prompt_text": "Text A2"})
    assert resp.status_code == 201, resp.text
    body = (await client.get(f"/api/game-sessions/{sid}")).json()
    entry = next(e for e in body["roster"] if e["player_ref"] == a["id"])
    assert entry["version"] == 1
    assert entry["prompt_text"] == "Text A"


async def test_second_start_is_409_and_pins_once(client: AsyncClient) -> None:
    sid, a, _ = await _started_session(client)
    first = (await client.get(f"/api/game-sessions/{sid}")).json()
    resp = await client.post(f"/api/game-sessions/{sid}/start")
    assert resp.status_code == 409
    again = (await client.get(f"/api/game-sessions/{sid}")).json()
    assert again["started_at"] == first["started_at"]
    assert again["roster"] == first["roster"]


async def test_start_unknown_session_is_404(client: AsyncClient) -> None:
    assert (await client.post("/api/game-sessions/64b64b64b64b64b64b64b64b/start")).status_code == 404


async def test_patch_cannot_jump_pending_to_running(client: AsyncClient) -> None:
    sid = await _session(client)
    resp = await client.patch(f"/api/game-sessions/{sid}", json={"status": "running"})
    assert resp.status_code == 409


async def test_patch_allowed_transitions(client: AsyncClient) -> None:
    sid, _, _ = await _started_session(client)
    for target in ("paused", "running", "completed"):
        resp = await client.patch(f"/api/game-sessions/{sid}", json={"status": target})
        assert resp.status_code == 200, resp.text
        assert resp.json()["status"] == target


async def test_patch_same_status_is_noop_and_completed_is_final(client: AsyncClient) -> None:
    sid, _, _ = await _started_session(client)
    assert (await client.patch(f"/api/game-sessions/{sid}", json={"status": "running"})).status_code == 200
    await client.patch(f"/api/game-sessions/{sid}", json={"status": "completed"})
    assert (await client.patch(f"/api/game-sessions/{sid}", json={"status": "completed"})).status_code == 200
    assert (await client.patch(f"/api/game-sessions/{sid}", json={"status": "running"})).status_code == 409
    assert (await client.patch(f"/api/game-sessions/{sid}", json={"status": "pending"})).status_code == 409


async def test_patch_rename(client: AsyncClient) -> None:
    sid = await _session(client)
    resp = await client.patch(f"/api/game-sessions/{sid}", json={"name": "Renamed"})
    assert resp.status_code == 200
    assert resp.json()["name"] == "Renamed"


async def test_delete_running_session_is_409(client: AsyncClient) -> None:
    sid, _, _ = await _started_session(client)
    assert (await client.delete(f"/api/game-sessions/{sid}")).status_code == 409
    assert (await client.get(f"/api/game-sessions/{sid}")).status_code == 200


async def test_malformed_session_id_is_404(client: AsyncClient) -> None:
    player = await _player(client, "Aurelia")
    assert (await client.get(f"/api/game-sessions/{BAD_ID}")).status_code == 404
    assert (await client.patch(f"/api/game-sessions/{BAD_ID}", json={"status": "paused"})).status_code == 404
    assert (await client.delete(f"/api/game-sessions/{BAD_ID}")).status_code == 404
    assert (await client.post(f"/api/game-sessions/{BAD_ID}/start")).status_code == 404
    assert (await _add(client, BAD_ID, player["id"])).status_code == 404
    assert (await client.delete(f"/api/game-sessions/{BAD_ID}/players/{player['id']}")).status_code == 404


async def test_roster_endpoints_503_without_db(client_no_db: AsyncClient) -> None:
    oid = "64b64b64b64b64b64b64b64b"
    assert (await _add(client_no_db, oid, oid)).status_code == 503
    assert (await client_no_db.delete(f"/api/game-sessions/{oid}/players/{oid}")).status_code == 503
    assert (await client_no_db.post(f"/api/game-sessions/{oid}/start")).status_code == 503


async def test_legacy_session_without_roster_still_lists(client: AsyncClient, mock_db) -> None:
    await mock_db.game_sessions.insert_one(
        {"name": "Old", "status": "completed", "accepted_prompt_ids": ["x"], "current_round": 3}
    )
    body = (await client.get("/api/game-sessions")).json()
    assert body[0]["roster"] == []
    assert body[0]["start_blockers"] == []
    assert "accepted_prompt_ids" not in body[0]
