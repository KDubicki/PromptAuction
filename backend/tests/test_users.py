from __future__ import annotations

from httpx import AsyncClient


async def test_create_and_get_user(client: AsyncClient) -> None:
    resp = await client.post("/api/users", json={"username": "alice", "email": "alice@example.com"})
    assert resp.status_code == 201
    body = resp.json()
    assert body["username"] == "alice"
    assert body["email"] == "alice@example.com"
    user_id = body["id"]

    resp = await client.get(f"/api/users/{user_id}")
    assert resp.status_code == 200
    assert resp.json()["username"] == "alice"


async def test_list_users(client: AsyncClient) -> None:
    await client.post("/api/users", json={"username": "bob", "email": "bob@example.com"})
    await client.post("/api/users", json={"username": "carol", "email": "carol@example.com"})

    resp = await client.get("/api/users")
    assert resp.status_code == 200
    names = {u["username"] for u in resp.json()}
    assert names == {"bob", "carol"}


async def test_get_user_not_found(client: AsyncClient) -> None:
    resp = await client.get("/api/users/64b64b64b64b64b64b64b64b")
    assert resp.status_code == 404


async def test_update_user(client: AsyncClient) -> None:
    created = await client.post("/api/users", json={"username": "dave", "email": "dave@example.com"})
    user_id = created.json()["id"]

    resp = await client.patch(f"/api/users/{user_id}", json={"username": "dave2"})
    assert resp.status_code == 200
    assert resp.json()["username"] == "dave2"
    assert resp.json()["email"] == "dave@example.com"


async def test_update_user_no_fields_is_noop(client: AsyncClient) -> None:
    created = await client.post("/api/users", json={"username": "erin", "email": "erin@example.com"})
    user_id = created.json()["id"]

    resp = await client.patch(f"/api/users/{user_id}", json={})
    assert resp.status_code == 200
    assert resp.json()["username"] == "erin"


async def test_update_user_not_found(client: AsyncClient) -> None:
    resp = await client.patch("/api/users/64b64b64b64b64b64b64b64b", json={"username": "ghost"})
    assert resp.status_code == 404


async def test_delete_user(client: AsyncClient) -> None:
    created = await client.post("/api/users", json={"username": "frank", "email": "frank@example.com"})
    user_id = created.json()["id"]

    resp = await client.delete(f"/api/users/{user_id}")
    assert resp.status_code == 204

    resp = await client.get(f"/api/users/{user_id}")
    assert resp.status_code == 404


async def test_delete_user_not_found(client: AsyncClient) -> None:
    resp = await client.delete("/api/users/64b64b64b64b64b64b64b64b")
    assert resp.status_code == 404


async def test_users_endpoints_503_when_db_not_connected(client_no_db: AsyncClient) -> None:
    oid = "64b64b64b64b64b64b64b64b"
    payload = {"username": "xx", "email": "x@x.com"}
    assert (await client_no_db.post("/api/users", json=payload)).status_code == 503
    assert (await client_no_db.get("/api/users")).status_code == 503
    assert (await client_no_db.get(f"/api/users/{oid}")).status_code == 503
    assert (await client_no_db.patch(f"/api/users/{oid}", json={})).status_code == 503
    assert (await client_no_db.delete(f"/api/users/{oid}")).status_code == 503
