from __future__ import annotations

from collections.abc import AsyncIterator, Iterator

import pytest
from httpx import ASGITransport, AsyncClient
from mongomock_motor import AsyncMongoMockClient
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.db.mongo import mongo_manager
from app.main import app
from app.services.config_service import config_service
from app.services.llm.manager import llm_manager


def _reset_all() -> None:
    config_service._cache = None
    config_service._cache_at = 0.0
    llm_manager._primary = None
    llm_manager._fallback = None
    mongo_manager.client = None
    mongo_manager.db = None


@pytest.fixture(autouse=True)
def _reset_singletons() -> Iterator[None]:
    """Module-level singletons (config cache, LLM manager, mongo handle) must not leak between tests."""
    _reset_all()
    yield
    _reset_all()


@pytest.fixture
def mock_db() -> AsyncIOMotorDatabase:
    """Wire an in-memory mongomock database into the mongo_manager singleton."""
    mongo_client = AsyncMongoMockClient()
    mongo_manager.client = mongo_client  # type: ignore[assignment]
    db = mongo_client["test_promptauction"]
    mongo_manager.db = db  # type: ignore[assignment]
    return db


@pytest.fixture
async def client(mock_db: AsyncIOMotorDatabase) -> AsyncIterator[AsyncClient]:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
async def client_no_db() -> AsyncIterator[AsyncClient]:
    """Client with mongo_manager.db left as None, for exercising 503 branches."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
