from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from app.schemas.config import GameConfig, GameConfigOut, GameConfigUpdate

logger = logging.getLogger(__name__)

_CONFIG_DOC_ID = "active"
_CONFIG_COLLECTION = "game_config"
_CONFIG_HISTORY_COLLECTION = "game_config_history"
_CACHE_TTL_SECONDS = 30.0


class ConfigService:
    """
    Manages runtime game configuration stored in MongoDB.

    - Serves as single source of truth for all game parameters.
    - In-memory cache with TTL to avoid a DB hit on every game engine iteration.
    - Full version history: every PATCH is stored in game_config_history.
    - Falls back to env-var defaults if no DB config exists yet.
    """

    def __init__(self) -> None:
        self._cache: GameConfigOut | None = None
        self._cache_at: float = 0.0

    async def get(self) -> GameConfigOut:
        import time

        if self._cache is not None and (time.monotonic() - self._cache_at) < _CACHE_TTL_SECONDS:
            return self._cache

        return await self._load_from_db()

    async def _load_from_db(self) -> GameConfigOut:
        import time

        from app.db.mongo import mongo_manager

        db = mongo_manager.db
        if db is None:
            logger.warning("DB not connected — returning default config")
            return GameConfigOut()

        doc = await db[_CONFIG_COLLECTION].find_one({"_id": _CONFIG_DOC_ID})
        if doc is None:
            config = GameConfigOut()
        else:
            doc.pop("_id", None)
            config = GameConfigOut(**doc)

        self._cache = config
        self._cache_at = time.monotonic()
        return config

    def _invalidate_cache(self) -> None:
        self._cache = None
        self._cache_at = 0.0

    async def update(self, payload: GameConfigUpdate, updated_by: str = "admin") -> GameConfigOut:
        from app.db.mongo import mongo_manager

        db = mongo_manager.db
        if db is None:
            raise RuntimeError("Database not connected")

        current = await self._load_from_db()

        # Merge update into current config
        patches = payload.model_dump(exclude_none=True, exclude_unset=True)
        updated_data = current.model_dump()
        updated_data.update(patches)

        now = datetime.now(timezone.utc)
        new_version = current.version + 1

        new_config = GameConfigOut(
            **{k: v for k, v in updated_data.items() if k not in ("version", "updated_by", "updated_at")},
            version=new_version,
            updated_by=updated_by,
            updated_at=now,
        )

        # Persist snapshot in history before overwriting
        history_doc: dict[str, Any] = current.model_dump()
        history_doc["config_id"] = _CONFIG_DOC_ID
        history_doc["archived_at"] = now
        await db[_CONFIG_HISTORY_COLLECTION].insert_one(history_doc)

        # Upsert active config
        save_doc: dict[str, Any] = new_config.model_dump()
        save_doc["_id"] = _CONFIG_DOC_ID
        await db[_CONFIG_COLLECTION].replace_one(
            {"_id": _CONFIG_DOC_ID}, save_doc, upsert=True
        )

        self._invalidate_cache()
        logger.info("Game config updated to v%d by %s: %s", new_version, updated_by, patches)
        return new_config

    async def get_history(self, limit: int = 20) -> list[GameConfigOut]:
        from app.db.mongo import mongo_manager

        db = mongo_manager.db
        if db is None:
            return []

        docs = (
            await db[_CONFIG_HISTORY_COLLECTION]
            .find({"config_id": _CONFIG_DOC_ID})
            .sort("version", -1)
            .limit(limit)
            .to_list(length=limit)
        )
        result = []
        for doc in docs:
            doc.pop("_id", None)
            doc.pop("config_id", None)
            doc.pop("archived_at", None)
            result.append(GameConfigOut(**doc))
        return result

    async def reset_to_defaults(self, updated_by: str = "admin") -> GameConfigOut:
        """Replace active config with factory defaults and archive the old one."""
        payload = GameConfigUpdate(
            game_rounds=50,
            game_iterations_per_round=45,
            game_engine_sleep_seconds=1.0,
            bid_min=1.0,
            bid_max=100.0,
            starting_budget=1000.0,
            game_mode="classic",
            blitz_round_seconds=30,
            item_theme="fantasy",
            item_categories=["Art", "Technology", "Magic", "Nature"],
            llm_temperature=None,
        )
        return await self.update(payload, updated_by=updated_by)

    def get_cached(self) -> GameConfig:
        """Sync accessor for game engine — returns cached or default config."""
        if self._cache is not None:
            return self._cache
        return GameConfig()


config_service = ConfigService()
