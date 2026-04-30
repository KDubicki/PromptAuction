from __future__ import annotations

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from pymongo import ASCENDING, IndexModel

from app.core.config import settings


class MongoManager:
    client: AsyncIOMotorClient | None = None
    db: AsyncIOMotorDatabase | None = None

    async def connect(self) -> None:
        self.client = AsyncIOMotorClient(settings.mongodb_url)
        self.db = self.client[settings.mongodb_db_name]
        await self._ensure_indexes()

    async def disconnect(self) -> None:
        if self.client:
            self.client.close()
            self.client = None
            self.db = None

    async def _ensure_indexes(self) -> None:
        if self.db is None:
            return

        await self.db.prompts.create_indexes([
            IndexModel([("player_id", ASCENDING)]),
            IndexModel([("status", ASCENDING)]),
            IndexModel([("created_at", ASCENDING)]),
            IndexModel([("form_response_id", ASCENDING)], unique=True, sparse=True),
        ])

        await self.db.game_sessions.create_indexes([
            IndexModel([("status", ASCENDING)]),
            IndexModel([("created_at", ASCENDING)]),
        ])

        await self.db.player_bids.create_indexes([
            IndexModel([("session_id", ASCENDING)]),
            IndexModel([("player_id", ASCENDING)]),
            IndexModel([("created_at", ASCENDING)]),
        ])

        await self.db.users.create_indexes([
            IndexModel([("email", ASCENDING)], unique=True, sparse=True),
        ])


mongo_manager = MongoManager()
