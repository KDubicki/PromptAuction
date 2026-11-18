import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.db.mongo import mongo_manager
from app.routers import admin, game_sessions, google_forms, players, prompts, users
from app.services.config_service import config_service
from app.services.game_engine import game_engine_service
from app.services.google_forms import google_forms_service
from app.services.llm.manager import llm_manager
from app.services.migrations import migrate_prompts_to_players

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    await mongo_manager.connect()
    if mongo_manager.db is not None:
        await migrate_prompts_to_players(mongo_manager.db)

    # Load game config from DB into cache (or use defaults if none stored yet)
    await config_service.get()
    logger.info("Game config loaded")

    if settings.llm_api_key or settings.llm_provider == "ollama":
        llm_manager.configure(
            provider_name=settings.llm_provider,
            api_key=settings.llm_api_key,
            model=settings.llm_model,
            temperature=settings.llm_temperature,
            base_url=settings.llm_base_url,
            fallback_provider=settings.llm_fallback_provider,
        )
        logger.info("LLM provider configured: %s / %s", settings.llm_provider, settings.llm_model)
    else:
        logger.warning("No LLM_API_KEY set — LLM provider not configured")

    game_engine_service.start()
    google_forms_service.start()
    try:
        yield
    finally:
        await google_forms_service.stop()
        await game_engine_service.stop()
        await mongo_manager.disconnect()


app = FastAPI(title=settings.app_name, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",") if o.strip()],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(users.router, prefix="/api")
app.include_router(game_sessions.router, prefix="/api")
app.include_router(players.router, prefix="/api")
app.include_router(prompts.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(google_forms.router, prefix="/api")


@app.get("/api/health")
async def health() -> dict[str, str]:
    llm_status = "configured" if llm_manager.is_configured else "not_configured"
    return {"status": "ok", "llm": llm_status}
