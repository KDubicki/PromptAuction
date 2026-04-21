from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.core.config import settings
from app.db.mongo import mongo_manager
from app.routers import game_sessions, prompts, users
from app.services.game_engine import game_engine_service


@asynccontextmanager
async def lifespan(_: FastAPI):
    await mongo_manager.connect()
    game_engine_service.start()
    try:
        yield
    finally:
        await game_engine_service.stop()
        await mongo_manager.disconnect()


app = FastAPI(title=settings.app_name, lifespan=lifespan)

app.include_router(users.router, prefix="/api")
app.include_router(game_sessions.router, prefix="/api")
app.include_router(prompts.router, prefix="/api")


@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
