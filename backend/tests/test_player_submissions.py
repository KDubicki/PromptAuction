from __future__ import annotations

import pytest
from httpx import AsyncClient
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ASCENDING
from pymongo.errors import DuplicateKeyError

from app.services import players as players_service
from app.services.players import add_version, submit_from_outside


async def _create(client: AsyncClient, name: str = "Aurelia", email: str | None = None) -> dict:
    payload: dict = {"name": name, "prompt_text": "Bid high."}
    if email is not None:
        payload["email"] = email
    resp = await client.post("/api/players", json=payload)
    assert resp.status_code == 201, resp.text
    return resp.json()


async def _webhook(client: AsyncClient, nick: str, email: str | None = None, **extra: str) -> dict:
    payload: dict = {"player_id": nick, "prompt_text": "Shadow.", **extra}
    if email is not None:
        payload["email"] = email
    resp = await client.post("/api/prompts/webhook", json=payload)
    assert resp.status_code in (200, 201), resp.text
    return resp.json()


async def _detail(client: AsyncClient, player_id: str) -> dict:
    return (await client.get(f"/api/players/{player_id}")).json()


async def test_new_nick_creates_player_with_pending_v1(client: AsyncClient) -> None:
    resp = await client.post("/api/prompts/webhook", json={"player_id": "Morrow", "prompt_text": "Shadow."})
    assert resp.status_code == 201
    body = resp.json()
    assert body["version"] == 1
    assert body["source"] == "webhook"
    assert body["status"] == "pending"

    players = (await client.get("/api/players")).json()
    morrow = next(p for p in players if p["name"] == "Morrow")
    assert morrow["current_version"] is None
    assert morrow["pending_versions"] == 1


async def test_known_nick_adds_pending_version_case_insensitive(client: AsyncClient) -> None:
    player = await _create(client)
    body = await _webhook(client, " AURELIA ")
    assert body["version"] == 2
    assert body["status"] == "pending"
    assert body["identity_warning"] is None
    assert body["player_ref"] == player["id"]
    assert body["player_id"] == "AURELIA"


async def test_email_wins_over_nick(client: AsyncClient) -> None:
    a = await _create(client, "A", "a@x")
    b = await _create(client, "B", "b@x")
    body = await _webhook(client, "B", "a@x")
    assert body["player_ref"] == a["id"]
    assert body["player_id"] == "B"
    assert body["identity_warning"] is None
    assert (await _detail(client, b["id"]))["pending_versions"] == 0


async def test_nick_match_with_different_email_sets_warning(client: AsyncClient) -> None:
    await _create(client, "Aurelia", "a@x")
    assert (await _webhook(client, "Aurelia", "k@y"))["identity_warning"] == "email_mismatch"
    assert (await _webhook(client, "Aurelia"))["identity_warning"] == "email_mismatch"


async def test_missing_email_is_filled_not_overwritten(
    client: AsyncClient, mock_db: AsyncIOMotorDatabase
) -> None:
    bare = await _create(client, "Bare")
    await _webhook(client, "Bare", "New@X")
    doc = await mock_db.players.find_one({"name_key": "bare"})
    assert doc is not None
    assert doc["email"] == "New@X"
    assert doc["email_key"] == "new@x"
    assert (await _detail(client, bare["id"]))["email"] == "New@X"

    await _webhook(client, "Bare", "other@x")
    doc = await mock_db.players.find_one({"name_key": "bare"})
    assert doc is not None
    assert doc["email"] == "New@X"


async def test_email_fill_race_is_tolerated(
    client: AsyncClient, mock_db: AsyncIOMotorDatabase, monkeypatch: pytest.MonkeyPatch
) -> None:
    await _create(client, "Bare")

    async def _dup(_self: object, *_args: object, **_kwargs: object) -> None:
        raise DuplicateKeyError("dup")

    monkeypatch.setattr(type(mock_db.players), "update_one", _dup)
    body = await _webhook(client, "Bare", "o@x")
    assert body["version"] == 2


async def test_former_nick_routes_to_renamed_player(client: AsyncClient) -> None:
    player = await _create(client, "Old")
    await client.patch(f"/api/players/{player['id']}", json={"name": "New"})
    body = await _webhook(client, "old")
    assert body["player_ref"] == player["id"]
    assert body["version"] == 2


async def test_tombstoned_response_is_ignored(
    client: AsyncClient, mock_db: AsyncIOMotorDatabase
) -> None:
    await mock_db.ignored_form_responses.insert_one({"_id": "r9"})
    resp = await client.post(
        "/api/prompts/webhook", json={"player_id": "Ghost", "prompt_text": "Boo.", "form_response_id": "r9"}
    )
    assert resp.status_code == 200
    assert resp.json()["ignored"] is True
    assert await mock_db.players.count_documents({}) == 0


async def test_duplicate_form_response_returns_existing(client: AsyncClient) -> None:
    first = await client.post(
        "/api/prompts/webhook", json={"player_id": "Dup", "prompt_text": "Once.", "form_response_id": "f1"}
    )
    second = await client.post(
        "/api/prompts/webhook", json={"player_id": "Dup", "prompt_text": "Once.", "form_response_id": "f1"}
    )
    assert (first.status_code, second.status_code) == (201, 200)
    assert first.json()["id"] == second.json()["id"]


async def test_accepting_older_version_keeps_newer_current(client: AsyncClient) -> None:
    first = await _webhook(client, "Morrow")
    player_id = first["player_ref"]
    second = await client.post(f"/api/players/{player_id}/versions", json={"prompt_text": "Second."})
    assert second.status_code == 201
    assert (await _detail(client, player_id))["current_version"]["version"] == 2

    resp = await client.patch(f"/api/prompts/{first['id']}/status", json={"status": "accepted"})
    assert resp.status_code == 200
    assert (await _detail(client, player_id))["current_version"]["version"] == 2


async def test_rejecting_current_falls_back_to_previous_accepted(client: AsyncClient) -> None:
    player = await _create(client)
    second = await _webhook(client, "Aurelia")
    await client.patch(f"/api/prompts/{second['id']}/status", json={"status": "accepted"})
    assert (await _detail(client, player["id"]))["current_version"]["version"] == 2

    await client.patch(f"/api/prompts/{second['id']}/status", json={"status": "rejected"})
    assert (await _detail(client, player["id"]))["current_version"]["version"] == 1


async def test_status_update_malformed_id_is_404(client: AsyncClient) -> None:
    resp = await client.patch("/api/prompts/not-an-id/status", json={"status": "accepted"})
    assert resp.status_code == 404


async def test_prompt_list_does_not_expose_player_email(client: AsyncClient) -> None:
    await _create(client, "Secret", "secret@x")
    await _webhook(client, "Secret")
    listed = (await client.get("/api/prompts")).json()
    assert all(item["email"] is None for item in listed)


async def test_legacy_prompt_without_player_ref_still_updates(
    client: AsyncClient, mock_db: AsyncIOMotorDatabase
) -> None:
    res = await mock_db.prompts.insert_one({"player_id": "Old", "prompt_text": "Legacy", "status": "pending"})
    resp = await client.patch(f"/api/prompts/{res.inserted_id}/status", json={"status": "accepted"})
    assert resp.status_code == 200
    assert resp.json()["version"] is None


async def test_status_update_unknown_id_is_404(client: AsyncClient) -> None:
    resp = await client.patch("/api/prompts/64b7f0f0f0f0f0f0f0f0f0f0/status", json={"status": "accepted"})
    assert resp.status_code == 404


async def test_form_response_duplicate_is_not_a_version_race(
    mock_db: AsyncIOMotorDatabase,
) -> None:
    await mock_db.prompts.create_index([("form_response_id", ASCENDING)], unique=True, sparse=True)
    first = await submit_from_outside(
        mock_db, name="Zed", email=None, prompt_text="One.", form_response_id="f9", source="webhook"
    )
    assert first.created is True

    again = await submit_from_outside(
        mock_db, name="Zed", email=None, prompt_text="One.", form_response_id="f9", source="webhook"
    )
    assert again.created is False
    assert again.version is not None
    assert again.version["form_response_id"] == "f9"


async def test_add_version_raises_dedicated_error_for_form_response_duplicate(
    mock_db: AsyncIOMotorDatabase,
) -> None:
    await mock_db.prompts.create_index([("form_response_id", ASCENDING)], unique=True, sparse=True)
    player = {"_id": (await mock_db.players.insert_one({"name": "P", "name_key": "p"})).inserted_id}
    await add_version(
        mock_db, player, "One.", status="pending", source="webhook", name_at_version="P", form_response_id="x"
    )
    with pytest.raises(players_service.DuplicateFormResponseError):
        await add_version(
            mock_db, player, "Two.", status="pending", source="webhook",
            name_at_version="P", form_response_id="x",
        )


async def test_concurrent_player_creation_falls_back_to_the_winner(
    mock_db: AsyncIOMotorDatabase
) -> None:
    mp = pytest.MonkeyPatch()
    real_create = players_service._create_pending_player

    async def _lose_race(db: AsyncIOMotorDatabase, name: str, email: str | None) -> dict:
        await real_create(db, name, email)
        raise DuplicateKeyError("dup")

    mp.setattr(players_service, "_create_pending_player", _lose_race)
    try:
        result = await submit_from_outside(
            mock_db, name="Race", email=None, prompt_text="Go.", form_response_id=None, source="webhook"
        )
    finally:
        mp.undo()
    assert result.created is True
    assert await mock_db.players.count_documents({"name_key": "race"}) == 1


async def test_unresolvable_player_creation_conflict_is_reported(mock_db: AsyncIOMotorDatabase) -> None:
    async def _always_dup(db: AsyncIOMotorDatabase, name: str, email: str | None) -> dict:
        raise DuplicateKeyError("dup")

    mp = pytest.MonkeyPatch()
    mp.setattr(players_service, "_create_pending_player", _always_dup)
    try:
        with pytest.raises(players_service.PlayerConflictError):
            await submit_from_outside(
                mock_db, name="Ghost", email=None, prompt_text="Go.", form_response_id=None, source="webhook"
            )
    finally:
        mp.undo()


async def test_webhook_rejects_bad_nick(client: AsyncClient, mock_db: AsyncIOMotorDatabase) -> None:
    for nick in ("  ", "", "x" * 101):
        resp = await client.post("/api/prompts/webhook", json={"player_id": nick, "prompt_text": "Shadow."})
        assert resp.status_code == 422
    assert await mock_db.players.count_documents({}) == 0
    assert await mock_db.prompts.count_documents({}) == 0
