from __future__ import annotations

import pytest
from mongomock_motor import AsyncMongoMockClient

import app.db.mongo as mongo_module
from app.db.mongo import MongoManager


@pytest.fixture(autouse=True)
def _patch_motor_client(monkeypatch: pytest.MonkeyPatch) -> None:
    """MongoManager.connect() constructs a real AsyncIOMotorClient; swap it for mongomock."""
    monkeypatch.setattr(mongo_module, "AsyncIOMotorClient", AsyncMongoMockClient)


async def test_connect_sets_client_and_db_and_creates_indexes() -> None:
    manager = MongoManager()
    await manager.connect()

    assert manager.client is not None
    assert manager.db is not None

    index_info = await manager.db.users.index_information()
    assert any(idx != "_id_" for idx in index_info)


async def test_disconnect_resets_client_and_db() -> None:
    manager = MongoManager()
    await manager.connect()

    await manager.disconnect()

    assert manager.client is None
    assert manager.db is None


async def test_disconnect_when_never_connected_is_noop() -> None:
    manager = MongoManager()
    await manager.disconnect()
    assert manager.client is None
    assert manager.db is None


async def test_ensure_indexes_noop_when_db_none() -> None:
    manager = MongoManager()
    manager.db = None
    await manager._ensure_indexes()
    assert manager.db is None
