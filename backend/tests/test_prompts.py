from __future__ import annotations

from httpx import AsyncClient
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.config import settings


async def test_webhook_creates_prompt(client: AsyncClient) -> None:
    resp = await client.post(
        "/api/prompts/webhook",
        json={"player_id": "p1", "prompt_text": "Bid low on shiny items.", "email": "p1@example.com"},
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["player_id"] == "p1"
    assert body["status"] == "pending"


async def test_webhook_idempotent_on_form_response_id(client: AsyncClient) -> None:
    payload = {"player_id": "p1", "prompt_text": "Bid low.", "form_response_id": "form-abc"}
    first = await client.post("/api/prompts/webhook", json=payload)
    second = await client.post("/api/prompts/webhook", json=payload)

    assert first.status_code == 201
    assert second.status_code == 201
    assert first.json()["id"] == second.json()["id"]

    resp = await client.get("/api/prompts")
    assert len(resp.json()) == 1


async def test_webhook_rejects_invalid_token(client: AsyncClient, monkeypatch) -> None:
    monkeypatch.setattr(settings, "webhook_secret", "s3cr3t")
    resp = await client.post(
        "/api/prompts/webhook",
        json={"player_id": "p1", "prompt_text": "Bid low."},
        headers={"X-Webhook-Token": "wrong"},
    )
    assert resp.status_code == 401


async def test_webhook_accepts_valid_token(client: AsyncClient, monkeypatch) -> None:
    monkeypatch.setattr(settings, "webhook_secret", "s3cr3t")
    resp = await client.post(
        "/api/prompts/webhook",
        json={"player_id": "p1", "prompt_text": "Bid low."},
        headers={"X-Webhook-Token": "s3cr3t"},
    )
    assert resp.status_code == 201


async def test_webhook_no_secret_configured_allows_missing_token(client: AsyncClient) -> None:
    resp = await client.post(
        "/api/prompts/webhook",
        json={"player_id": "p1", "prompt_text": "Bid low."},
    )
    assert resp.status_code == 201


async def test_list_prompts_with_status_filter(client: AsyncClient) -> None:
    created = await client.post(
        "/api/prompts/webhook", json={"player_id": "p1", "prompt_text": "Bid low."}
    )
    prompt_id = created.json()["id"]
    await client.patch(f"/api/prompts/{prompt_id}/status", json={"status": "accepted"})

    await client.post("/api/prompts/webhook", json={"player_id": "p2", "prompt_text": "Bid high."})

    accepted = await client.get("/api/prompts", params={"status_filter": "accepted"})
    assert [p["player_id"] for p in accepted.json()] == ["p1"]

    pending = await client.get("/api/prompts", params={"status_filter": "pending"})
    assert [p["player_id"] for p in pending.json()] == ["p2"]

    all_prompts = await client.get("/api/prompts")
    assert len(all_prompts.json()) == 2


async def test_update_prompt_status_not_found(client: AsyncClient) -> None:
    resp = await client.patch(
        "/api/prompts/64b64b64b64b64b64b64b64b/status", json={"status": "accepted"}
    )
    assert resp.status_code == 404


async def test_prompts_endpoints_503_when_db_not_connected(client_no_db: AsyncClient) -> None:
    oid = "64b64b64b64b64b64b64b64b"
    assert (
        await client_no_db.post(
            "/api/prompts/webhook", json={"player_id": "p1", "prompt_text": "Bid low."}
        )
    ).status_code == 503
    assert (await client_no_db.get("/api/prompts")).status_code == 503
    assert (
        await client_no_db.patch(f"/api/prompts/{oid}/status", json={"status": "accepted"})
    ).status_code == 503


async def test_webhook_accepts_many_submissions_without_form_response_id(
    client: AsyncClient, mock_db: AsyncIOMotorDatabase
) -> None:
    # Mirrors the production index: unique + sparse only skips documents where the field is absent.
    await mock_db.prompts.create_index("form_response_id", unique=True, sparse=True)
    for player in ("p1", "p2"):
        payload = {"player_id": player, "prompt_text": "Bid low."}
        resp = await client.post("/api/prompts/webhook", json=payload)
        assert resp.status_code == 201
    assert await mock_db.prompts.count_documents({"form_response_id": {"$exists": True}}) == 0
