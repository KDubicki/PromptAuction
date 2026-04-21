import asyncio

from app.core.config import settings
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
        while True:
            db = mongo_manager.db
            if db is None:
                await asyncio.sleep(settings.game_engine_sleep_seconds)
                continue

            active_sessions = db.game_sessions.find({"status": "running"})
            async for session in active_sessions:
                await self._run_iteration(session)

            await asyncio.sleep(settings.game_engine_sleep_seconds)

    async def _run_iteration(self, session: dict) -> None:
        db = mongo_manager.db
        if db is None:
            return

        current_round = int(session.get("current_round", 0))
        current_iteration = int(session.get("current_iteration", 0))

        if current_round >= settings.game_rounds:
            await db.game_sessions.update_one(
                {"_id": session["_id"]}, {"$set": {"status": "completed"}}
            )
            return

        next_iteration = current_iteration + 1
        next_round = current_round
        if next_iteration > settings.game_iterations_per_round:
            next_iteration = 1
            next_round += 1

        accepted_prompts = await db.prompts.find({"status": "accepted"}).to_list(length=500)
        current_item = f"Unique Item R{next_round}-I{next_iteration}"

        context = {
            "accepted_prompts": accepted_prompts,
            "current_item": current_item,
            "inventories": [],
            "session_id": str(session["_id"]),
        }
        bids = await llm_service.generate_bids(context=context)
        if bids:
            await db.player_bids.insert_many(
                [
                    {
                        "player_id": bid["player_id"],
                        "item_name": current_item,
                        "bid_amount": bid["bid_amount"],
                        "won": False,
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
