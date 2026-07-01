from __future__ import annotations

from unittest.mock import AsyncMock, patch

from httpx import AsyncClient


async def test_swap_llm_provider_ollama(client: AsyncClient) -> None:
    # ollama's create() never makes a network call at construction time, safe to exercise for real.
    resp = await client.patch(
        "/api/admin/llm-provider",
        json={"provider": "ollama", "model": "llama3", "temperature": 0.5},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["provider"] == "ollama"
    assert body["model"] == "llama3"
    assert body["temperature"] == 0.5


async def test_swap_llm_provider_unknown_provider_400(client: AsyncClient) -> None:
    resp = await client.patch(
        "/api/admin/llm-provider",
        json={"provider": "not-a-provider", "model": "x"},
    )
    assert resp.status_code == 400


async def test_get_llm_provider_info_not_configured_404(client: AsyncClient) -> None:
    resp = await client.get("/api/admin/llm-provider")
    assert resp.status_code == 404


async def test_get_llm_provider_info_after_swap(client: AsyncClient) -> None:
    await client.patch("/api/admin/llm-provider", json={"provider": "ollama", "model": "llama3"})
    resp = await client.get("/api/admin/llm-provider")
    assert resp.status_code == 200
    assert resp.json()["provider"] == "ollama"


async def test_llm_health_check_no_provider(client: AsyncClient) -> None:
    resp = await client.get("/api/admin/llm-provider/health")
    assert resp.status_code == 200
    assert resp.json() == {"primary": None, "fallback": None}


async def test_llm_health_check_with_provider(client: AsyncClient) -> None:
    await client.patch("/api/admin/llm-provider", json={"provider": "ollama", "model": "llama3"})
    target = "app.services.llm.ollama_provider.OllamaProvider.health_check"
    with patch(target, new=AsyncMock(return_value=True)):
        resp = await client.get("/api/admin/llm-provider/health")
    assert resp.status_code == 200
    assert resp.json()["primary"] is True


async def test_get_config_returns_defaults(client: AsyncClient) -> None:
    resp = await client.get("/api/admin/config")
    assert resp.status_code == 200
    body = resp.json()
    assert body["game_rounds"] == 50
    assert body["version"] == 1


async def test_update_config(client: AsyncClient) -> None:
    resp = await client.patch("/api/admin/config", json={"game_rounds": 10, "bid_max": 50})
    assert resp.status_code == 200
    body = resp.json()
    assert body["game_rounds"] == 10
    assert body["bid_max"] == 50
    assert body["version"] == 2
    assert body["updated_by"] == "admin"


async def test_update_config_503_when_db_not_connected(client_no_db: AsyncClient) -> None:
    resp = await client_no_db.patch("/api/admin/config", json={"game_rounds": 10})
    assert resp.status_code == 503


async def test_reset_config(client: AsyncClient) -> None:
    await client.patch("/api/admin/config", json={"game_rounds": 5})
    resp = await client.post("/api/admin/config/reset")
    assert resp.status_code == 200
    assert resp.json()["game_rounds"] == 50


async def test_reset_config_503_when_db_not_connected(client_no_db: AsyncClient) -> None:
    resp = await client_no_db.post("/api/admin/config/reset")
    assert resp.status_code == 503


async def test_config_history(client: AsyncClient) -> None:
    await client.patch("/api/admin/config", json={"game_rounds": 5})
    await client.patch("/api/admin/config", json={"game_rounds": 6})

    resp = await client.get("/api/admin/config/history")
    assert resp.status_code == 200
    versions = [h["version"] for h in resp.json()]
    assert versions == sorted(versions, reverse=True)
    assert len(versions) == 2


async def test_config_history_limit_capped(client: AsyncClient) -> None:
    resp = await client.get("/api/admin/config/history", params={"limit": 1000})
    assert resp.status_code == 200
