from __future__ import annotations

import asyncio
import logging
import time
from datetime import UTC, datetime
from typing import Any

from app.db.mongo import mongo_manager
from app.services.auction.decision import Decision, parse_decision
from app.services.auction.prompt import SYSTEM_PROMPT, build_state, build_user_message
from app.services.auction.rules import Answer, RoundResult, compute_standings, resolve_round
from app.services.llm_service import llm_service

logger = logging.getLogger(__name__)

VOID_ROUNDS_LIMIT = 3
RAW_RESPONSE_MAX_LENGTH = 2000
FALLBACK_SLEEP_SECONDS = 1.0
VOID_PAUSE_REASON = "LLM provider failed 3 rounds in a row"


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
            sleep = FALLBACK_SLEEP_SECONDS
            try:
                sleep = config_service.get_cached().game_engine_sleep_seconds

                db = mongo_manager.db
                if db is not None:
                    async for session in db.game_sessions.find({"status": "running"}):
                        try:
                            await self._run_iteration(session)
                        except Exception:
                            logger.exception("Auction round failed for session %s", session.get("_id"))
            except Exception:
                logger.exception("Game engine tick failed")

            await asyncio.sleep(sleep)

    async def _run_iteration(self, session: dict) -> None:
        db = mongo_manager.db
        if db is None:
            return

        auction = session.get("auction")
        if not auction:
            logger.warning("Skipping running session %s: it has no auction state", session.get("_id"))
            return
        roster: list[dict] = session.get("roster") or []
        if not roster:
            logger.warning("Skipping running session %s: its roster is empty", session.get("_id"))
            return

        answers = list(await asyncio.gather(*(self._ask(session, entry) for entry in roster)))
        result = resolve_round(session, answers)

        now = datetime.now(UTC)
        updates: dict[str, Any] = {
            "auction": result.auction,
            "lots": result.lots,
            "roster": result.roster,
            "standings": compute_standings(result.roster),
            "updated_at": now,
        }
        if result.finished:
            updates["status"] = "completed"
        elif result.auction is not None and result.auction["void_rounds"] >= VOID_ROUNDS_LIMIT:
            updates["status"] = "paused"
            updates["pause_reason"] = VOID_PAUSE_REASON

        # Guarding on the pre-round state means a stale or overlapping step cannot settle a round twice.
        settled = await db.game_sessions.update_one(
            {
                "_id": session["_id"],
                "status": "running",
                "auction.lot_number": auction["lot_number"],
                "auction.current_round": auction["current_round"],
                "auction.void_rounds": auction.get("void_rounds", 0),
            },
            {"$set": updates},
        )
        if settled.matched_count == 0:
            logger.info("Round for session %s was already settled or the session stopped", session["_id"])
            return

        await self._store_bids(db, session, answers, result, now)

    async def _ask(self, session: dict, entry: dict) -> Answer:
        started = time.monotonic()
        response_ms: float | None = None
        decision: Decision | None = None
        text: str | None = None
        try:
            state = build_state(session, entry["player_ref"])
            user = build_user_message(entry.get("prompt_text") or "", state)
            text, response_ms = await llm_service.ask_player(system=SYSTEM_PROMPT, user=user)
            decision = parse_decision(text) if text else None
        except Exception as e:
            logger.warning("No answer from %s: %s", entry.get("name"), str(e) or type(e).__name__)
            decision = None
        if response_ms is None:
            response_ms = (time.monotonic() - started) * 1000
        failure = None
        if decision is None:
            failure = "unreadable" if text else "no_reply"
        return Answer(
            player_ref=entry.get("player_ref", ""),
            name=entry.get("name", ""),
            decision=decision,
            response_ms=response_ms,
            raw_response=text[:RAW_RESPONSE_MAX_LENGTH] if text else None,
            failure=failure,
        )

    async def _store_bids(
        self, db: Any, session: dict, answers: list[Answer], result: RoundResult, now: datetime
    ) -> None:
        auction = session["auction"]
        session_id = str(session["_id"])
        lot_number = auction["lot_number"]
        item = next((lot["item"] for lot in session["lots"] if lot["number"] == lot_number), "")
        buyer_ref = result.sale["buyer_ref"] if result.sale else None
        bought_this_round = buyer_ref is not None and result.outcomes.get(buyer_ref) == "leading"

        docs = [
            {
                "session_id": session_id,
                "lot_number": lot_number,
                "item": item,
                "round": auction["current_round"],
                "player_id": answer.name,
                "player_ref": answer.player_ref,
                "bid": answer.decision.bid if answer.decision else None,
                "reason": answer.decision.reason if answer.decision else None,
                "response_ms": answer.response_ms,
                "raw_response": answer.raw_response,
                "failure": answer.failure,
                "outcome": result.outcomes[answer.player_ref],
                "won": bought_this_round and answer.player_ref == buyer_ref,
                "created_at": now,
            }
            for answer in answers
        ]
        await db.player_bids.insert_many(docs)

        if buyer_ref is not None and not bought_this_round:
            winning = await db.player_bids.find_one(
                {
                    "session_id": session_id,
                    "lot_number": lot_number,
                    "player_ref": buyer_ref,
                    "outcome": "leading",
                },
                sort=[("round", -1), ("created_at", -1)],
            )
            if winning is None:
                logger.warning(
                    "No leading bid found for the sale of lot %s in session %s", lot_number, session_id
                )
                return
            await db.player_bids.update_one({"_id": winning["_id"]}, {"$set": {"won": True}})


game_engine_service = GameEngineService()
