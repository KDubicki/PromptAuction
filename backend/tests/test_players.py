from __future__ import annotations

from httpx import AsyncClient
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo.errors import DuplicateKeyError

from app.services.players import add_version


async def _create(client: AsyncClient, name: str = "Aurelia", email: str | None = "A@x.pl") -> dict:
    payload: dict = {"name": name, "prompt_text": "Bid high."}
    if email is not None:
        payload["email"] = email
    resp = await client.post("/api/players", json=payload)
    assert resp.status_code == 201, resp.text
    return resp.json()


async def test_create_player_creates_accepted_v1(client: AsyncClient) -> None:
    resp = await client.post(
        "/api/players", json={"name": "Aurelia", "email": "A@x.pl", "prompt_text": "Bid high."}
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["name"] == "Aurelia"
    assert body["current_version"]["version"] == 1
    assert body["current_version"]["status"] == "accepted"
    assert body["current_version"]["source"] == "admin"
    assert body["pending_versions"] == 0


async def test_create_player_without_email_stores_no_email_key(
    client: AsyncClient, mock_db: AsyncIOMotorDatabase
) -> None:
    body = await _create(client, email=None)
    assert body["email"] is None
    doc = await mock_db.players.find_one({})
    assert doc is not None
    assert "email_key" not in doc
    assert "email" not in doc


async def test_create_player_rejects_same_name_ignoring_case(client: AsyncClient) -> None:
    await _create(client)
    resp = await client.post("/api/players", json={"name": " aurelia ", "prompt_text": "Bid high."})
    assert resp.status_code == 409


async def test_create_player_rejects_taken_email(client: AsyncClient) -> None:
    await _create(client)
    resp = await client.post(
        "/api/players", json={"name": "Other", "email": "a@X.pl", "prompt_text": "Bid high."}
    )
    assert resp.status_code == 409


async def test_create_player_rejects_former_name_of_other_player(client: AsyncClient) -> None:
    first = await _create(client)
    await client.patch(f"/api/players/{first['id']}", json={"name": "Aurora"})
    resp = await client.post("/api/players", json={"name": "Aurelia", "prompt_text": "Bid high."})
    assert resp.status_code == 409


async def test_create_player_validates_fields(client: AsyncClient) -> None:
    blank = await client.post("/api/players", json={"name": "   ", "prompt_text": "Bid high."})
    short = await client.post("/api/players", json={"name": "A", "prompt_text": "x"})
    assert (blank.status_code, short.status_code) == (422, 422)


async def test_add_version_increments_and_becomes_current(client: AsyncClient) -> None:
    player = await _create(client)
    resp = await client.post(f"/api/players/{player['id']}/versions", json={"prompt_text": "Bid low."})
    assert resp.status_code == 201
    assert resp.json()["version"] == 2
    detail = (await client.get(f"/api/players/{player['id']}")).json()
    assert detail["current_version"]["version"] == 2
    assert [v["version"] for v in detail["versions"]] == [2, 1]


async def test_add_version_to_unknown_player_is_404(client: AsyncClient) -> None:
    resp = await client.post(
        "/api/players/64b000000000000000000000/versions", json={"prompt_text": "Bid low."}
    )
    assert resp.status_code == 404


async def test_add_version_retries_on_duplicate_version(
    client: AsyncClient, mock_db: AsyncIOMotorDatabase, monkeypatch
) -> None:
    player = await _create(client)
    cls = type(mock_db.prompts)
    original = cls.insert_one
    calls = {"n": 0}

    async def flaky(self, *args, **kwargs):
        calls["n"] += 1
        if calls["n"] == 1:
            raise DuplicateKeyError("dup")
        return await original(self, *args, **kwargs)

    monkeypatch.setattr(cls, "insert_one", flaky)
    resp = await client.post(f"/api/players/{player['id']}/versions", json={"prompt_text": "Bid low."})
    assert resp.status_code == 201
    assert resp.json()["version"] == 2
    assert calls["n"] == 2


async def test_add_version_gives_up_after_three_duplicates(
    client: AsyncClient, mock_db: AsyncIOMotorDatabase, monkeypatch
) -> None:
    player = await _create(client)

    async def always_dup(self, *args, **kwargs):
        raise DuplicateKeyError("dup")

    monkeypatch.setattr(type(mock_db.prompts), "insert_one", always_dup)
    resp = await client.post(f"/api/players/{player['id']}/versions", json={"prompt_text": "Bid low."})
    assert resp.status_code == 409


async def test_rename_keeps_old_name_in_former_name_keys(
    client: AsyncClient, mock_db: AsyncIOMotorDatabase
) -> None:
    player = await _create(client)
    resp = await client.patch(f"/api/players/{player['id']}", json={"name": "Aurora"})
    assert resp.status_code == 200
    assert resp.json()["name"] == "Aurora"
    doc = await mock_db.players.find_one({})
    assert doc is not None
    assert doc["former_name_keys"] == ["aurelia"]
    assert doc["name_key"] == "aurora"
    version = await mock_db.prompts.find_one({"player_ref": player["id"]})
    assert version is not None
    assert version["player_id"] == "Aurelia"


async def test_rename_to_own_former_name_and_email_changes(
    client: AsyncClient, mock_db: AsyncIOMotorDatabase
) -> None:
    player = await _create(client)
    await client.patch(f"/api/players/{player['id']}", json={"name": "Aurora"})
    resp = await client.patch(f"/api/players/{player['id']}", json={"name": "AURELIA", "email": "new@x.pl"})
    assert resp.status_code == 200
    doc = await mock_db.players.find_one({})
    assert doc is not None
    assert doc["name_key"] == "aurelia"
    assert doc["former_name_keys"] == ["aurora"]
    assert doc["email_key"] == "new@x.pl"
    cleared = await client.patch(f"/api/players/{player['id']}", json={"email": " "})
    assert cleared.json()["email"] is None
    doc = await mock_db.players.find_one({})
    assert doc is not None
    assert "email_key" not in doc
    assert "email" not in doc


async def test_rename_rejects_name_held_by_other_player_now_or_formerly(client: AsyncClient) -> None:
    first = await _create(client, "Aurelia", "a@x.pl")
    second = await _create(client, "Brutus", "b@x.pl")
    assert (await client.patch(f"/api/players/{second['id']}", json={"name": "aurelia"})).status_code == 409
    await client.patch(f"/api/players/{first['id']}", json={"name": "Aurora"})
    assert (await client.patch(f"/api/players/{second['id']}", json={"name": "Aurelia"})).status_code == 409


async def test_update_rejects_email_of_other_player(client: AsyncClient) -> None:
    await _create(client, "Aurelia", "a@x.pl")
    second = await _create(client, "Brutus", "b@x.pl")
    resp = await client.patch(f"/api/players/{second['id']}", json={"email": "A@x.pl"})
    assert resp.status_code == 409


async def test_update_unknown_player_is_404(client: AsyncClient) -> None:
    resp = await client.patch("/api/players/64b000000000000000000000", json={"name": "X"})
    assert resp.status_code == 404


async def test_list_players_sorted_by_name_with_pending_count(
    client: AsyncClient, mock_db: AsyncIOMotorDatabase
) -> None:
    brutus = await _create(client, "brutus", "b@x.pl")
    await _create(client, "Aurelia", "a@x.pl")
    player = await mock_db.players.find_one({"name": "brutus"})
    assert player is not None
    await add_version(
        mock_db, player, "Pending idea", status="pending", source="webhook", name_at_version="brutus"
    )
    resp = await client.get("/api/players")
    assert resp.status_code == 200
    body = resp.json()
    assert [p["name"] for p in body] == ["Aurelia", "brutus"]
    assert body[0]["pending_versions"] == 0
    assert body[1]["pending_versions"] == 1
    assert body[1]["id"] == brutus["id"]
    assert body[1]["current_version"]["version"] == 1


async def test_non_accepted_version_does_not_change_current(
    client: AsyncClient, mock_db: AsyncIOMotorDatabase
) -> None:
    player = await _create(client)
    doc = await mock_db.players.find_one({})
    assert doc is not None
    version = await add_version(
        mock_db,
        doc,
        "Maybe",
        status="pending",
        source="google_forms",
        name_at_version="Aurelia",
        email="z@y.pl",
        form_response_id="r9",
        identity_warning="email_mismatch",
    )
    assert version["version"] == 2
    detail = (await client.get(f"/api/players/{player['id']}")).json()
    assert detail["current_version"]["version"] == 1
    assert detail["versions"][0]["identity_warning"] == "email_mismatch"
    assert detail["versions"][0]["email"] == "z@y.pl"


async def test_delete_player_removes_versions_and_tombstones_form_responses(
    client: AsyncClient, mock_db: AsyncIOMotorDatabase
) -> None:
    player = await _create(client)
    doc = await mock_db.players.find_one({})
    assert doc is not None
    await add_version(
        mock_db,
        doc,
        "From form",
        status="pending",
        source="google_forms",
        name_at_version="Aurelia",
        form_response_id="r1",
    )
    resp = await client.delete(f"/api/players/{player['id']}")
    assert resp.status_code == 204
    assert await mock_db.prompts.count_documents({"player_ref": player["id"]}) == 0
    assert await mock_db.players.count_documents({}) == 0
    tomb = await mock_db.ignored_form_responses.find_one({"_id": "r1"})
    assert tomb is not None
    assert tomb["player_name"] == "Aurelia"


async def test_delete_player_in_unfinished_session_is_409(
    client: AsyncClient, mock_db: AsyncIOMotorDatabase
) -> None:
    player = await _create(client)
    await mock_db.game_sessions.insert_one(
        {"status": "pending", "roster": [{"player_ref": player["id"], "name": "Aurelia"}]}
    )
    assert (await client.delete(f"/api/players/{player['id']}")).status_code == 409
    assert (await client.get(f"/api/players/{player['id']}")).status_code == 200


async def test_delete_player_in_completed_session_is_allowed(
    client: AsyncClient, mock_db: AsyncIOMotorDatabase
) -> None:
    player = await _create(client)
    await mock_db.game_sessions.insert_one(
        {"status": "completed", "roster": [{"player_ref": player["id"], "name": "Aurelia"}]}
    )
    assert (await client.delete(f"/api/players/{player['id']}")).status_code == 204


async def test_delete_unknown_player_is_404(client: AsyncClient) -> None:
    assert (await client.delete("/api/players/64b000000000000000000000")).status_code == 404


async def test_malformed_player_id_is_404(client: AsyncClient) -> None:
    assert (await client.get("/api/players/abc")).status_code == 404
    assert (await client.get("/api/players/64b000000000000000000000")).status_code == 404


async def test_players_endpoints_503_without_db(client_no_db: AsyncClient) -> None:
    pid = "64b000000000000000000000"
    body = {"name": "A", "prompt_text": "Bid high."}
    responses = [
        await client_no_db.post("/api/players", json=body),
        await client_no_db.get("/api/players"),
        await client_no_db.get(f"/api/players/{pid}"),
        await client_no_db.patch(f"/api/players/{pid}", json={"name": "B"}),
        await client_no_db.delete(f"/api/players/{pid}"),
        await client_no_db.post(f"/api/players/{pid}/versions", json={"prompt_text": "Bid low."}),
    ]
    assert [r.status_code for r in responses] == [503] * 6


def test_parse_object_id() -> None:
    import pytest
    from fastapi import HTTPException

    from app.core.ids import parse_object_id

    assert str(parse_object_id("64b000000000000000000000")) == "64b000000000000000000000"
    with pytest.raises(HTTPException) as exc:
        parse_object_id("nope", "Player not found")
    assert exc.value.status_code == 404
    assert exc.value.detail == "Player not found"
