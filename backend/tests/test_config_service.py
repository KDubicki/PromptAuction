from __future__ import annotations

from app.schemas.config import GameConfig, GameConfigUpdate
from app.services.config_service import ConfigService


async def test_get_returns_defaults_when_db_not_connected() -> None:
    service = ConfigService()
    config = await service.get()
    assert config.game_rounds == 50
    assert config.version == 1


async def test_get_uses_cache_within_ttl(mock_db) -> None:
    service = ConfigService()
    first = await service.get()
    # Mutate the DB directly; a cached call should NOT see this change.
    await mock_db["game_config"].update_one({"_id": "active"}, {"$set": {"game_rounds": 999}}, upsert=True)
    second = await service.get()
    assert second is first
    assert second.game_rounds != 999


async def test_update_persists_and_increments_version(mock_db) -> None:
    service = ConfigService()
    updated = await service.update(GameConfigUpdate(game_rounds=7), updated_by="tester")
    assert updated.game_rounds == 7
    assert updated.version == 2
    assert updated.updated_by == "tester"

    history = await service.get_history()
    assert len(history) == 1
    assert history[0].game_rounds == 50  # snapshot of the config *before* this update


async def test_update_raises_runtime_error_without_db() -> None:
    service = ConfigService()
    try:
        await service.update(GameConfigUpdate(game_rounds=7))
        raise AssertionError("expected RuntimeError")
    except RuntimeError:
        pass


async def test_get_history_empty_without_db() -> None:
    service = ConfigService()
    assert await service.get_history() == []


async def test_reset_to_defaults(mock_db) -> None:
    service = ConfigService()
    await service.update(GameConfigUpdate(game_rounds=3))
    reset = await service.reset_to_defaults(updated_by="tester")
    assert reset.game_rounds == 50
    assert reset.version == 3


def test_get_cached_returns_default_when_never_loaded() -> None:
    service = ConfigService()
    assert service.get_cached() == GameConfig()


async def test_get_cached_returns_cached_value_after_get(mock_db) -> None:
    service = ConfigService()
    await service.update(GameConfigUpdate(game_rounds=12))
    # update() invalidates the cache, so get_cached() reflects defaults until get() reloads it.
    assert service.get_cached().game_rounds == 50
    await service.get()
    assert service.get_cached().game_rounds == 12
