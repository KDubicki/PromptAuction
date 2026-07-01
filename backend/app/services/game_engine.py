from __future__ import annotations

import asyncio
from datetime import UTC

from app.db.mongo import mongo_manager
from app.services.llm_service import llm_service


class GameEngineService:
    _task: asyncio.Task | None = None

    def start(self) -> None:
        if self._task is None or self._task.done():
            self._task = asyncio.create_task(self.run())

    async def stop(self) -> None:
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass

    async def run(self) -> None:
        from app.services.config_service import config_service

        while True:
            cfg = config_service.get_cached()
            sleep = cfg.game_engine_sleep_seconds

            db = mongo_manager.db
            if db is None:
                await asyncio.sleep(sleep)
                continue

            active_sessions = db.game_sessions.find({"status": "running"})
            async for session in active_sessions:
                await self._run_iteration(session)

            await asyncio.sleep(sleep)

    async def _run_iteration(self, session: dict) -> None:
        from app.services.config_service import config_service

        db = mongo_manager.db
        if db is None:
            return

        cfg = config_service.get_cached()

        current_round = int(session.get("current_round", 0))
        current_iteration = int(session.get("current_iteration", 0))

        if current_round >= cfg.game_rounds:
            await db.game_sessions.update_one(
                {"_id": session["_id"]}, {"$set": {"status": "completed"}}
            )
            return

        next_iteration = current_iteration + 1
        next_round = current_round
        if next_iteration > cfg.game_iterations_per_round:
            next_iteration = 1
            next_round += 1

        accepted_prompts = await db.prompts.find({"status": "accepted"}).to_list(length=500)
        current_item = f"Unique Item R{next_round}-I{next_iteration}"

        context = {
            "accepted_prompts": accepted_prompts,
            "current_item": current_item,
            "inventories": [],
            "session_id": str(session["_id"]),
            "bid_min": cfg.bid_min,
            "bid_max": cfg.bid_max,
            "game_mode": cfg.game_mode,
        }
        bids = await llm_service.generate_bids(context=context)
        if bids:
            from datetime import datetime

            now = datetime.now(UTC)
            await db.player_bids.insert_many(
                [
                    {
                        "player_id": bid["player_id"],
                        "item_name": current_item,
                        "bid_amount": max(cfg.bid_min, min(cfg.bid_max, float(bid["bid_amount"]))),
                        "won": False,
                        "session_id": str(session["_id"]),
                        "created_at": now,
                    }
                    for bid in bids
                ]
            )

        await db.game_sessions.update_one(
            {"_id": session["_id"]},
            {
                "$set": {
                    "current_round": next_round,
                    "current_iteration": next_iteration,
                }
            },
        )


game_engine_service = GameEngineService()
