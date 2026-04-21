from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from app.core.config import settings


class MongoManager:
    client: AsyncIOMotorClient | None = None
    db: AsyncIOMotorDatabase | None = None

    async def connect(self) -> None:
        self.client = AsyncIOMotorClient(settings.mongodb_url)
        self.db = self.client[settings.mongodb_db_name]

    async def disconnect(self) -> None:
        if self.client:
            self.client.close()
            self.client = None
            self.db = None


mongo_manager = MongoManager()
