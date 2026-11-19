# Ascending Auction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn each game session into an English (ascending) auction: per-session budget, lot count and max rounds; generated lots with quality and a `required` flag; one LLM request per player per round; buyers pay from their budget; standings by unique required items, then quality.

**Architecture:** All game state lives in the `game_sessions` document (`settings`, `lots`, `auction`, per-player `budget`/`items` in `roster`, `standings`). Pure functions in `app/services/auction/` (catalog, prompt, decision parsing, rules) do the logic without I/O; the engine orchestrates one round per tick and persists it with one guarded `update_one`. Providers gain a minimal `complete_json(system, user) -> str`.

**Tech Stack:** FastAPI, Motor/MongoDB, Pydantic v2, pytest + mongomock-motor; React 19, MUI 9, TanStack Query 5, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-19-ascending-auction-design.md` (Polish) and the prompt it pins, `docs/llm-bid-prompt.md`. Read both before any task.

## Global Constraints

- `settings.budget` int 1–1 000 000 (default 1000); `settings.lots_count` int 1–500 (default 12); `settings.max_rounds` int 1–100 (default 10). Settings editable only while `pending` (else 409).
- Lot quality: integer 1–10. Type pool `k = max(1, ceil(lots_count * 0.6))`; required types `max(1, round(k * 0.7))`; the first `k` lots are one copy of each type, the rest random types; shuffle, number from 1.
- The system prompt is the exact text in `docs/llm-bid-prompt.md` §1 — **no goal, no scoring, no meaning of `required`**. The user message is exactly §2's shape: `Your player's instructions:\n<<<\n{prompt}\n>>>\n\nGame state:\n```json\n{state}\n```` with JSON keys exactly as in the example (`lot`, `auction.current_round`, `auction.max_rounds`, `auction.highest_bid`, `auction.leader`, `you`, `required_items`, `players[].name/budget/items`, `remaining_lots`), no `category`.
- Bid validity: `0` → `pass`; `bid <= highest_bid` → `not_higher`; `bid > budget` → `over_budget`; else valid. Fractional bids floored; `reason` cut to 100 chars. Outcomes: `leading`, `outbid`, `pass`, `not_higher`, `over_budget`, `no_answer`.
- Round tie → smallest `response_ms`. No valid bid + leader → sold to leader at `highest_bid`; no valid bid, no leader → `unsold`. Valid bids on `current_round == max_rounds` → sold to the round winner. The leader may outbid themselves.
- Per-request timeout 30 s. All players `no_answer` → round void (state unchanged, `auction.void_rounds += 1`); 3 in a row → `status = "paused"`, `pause_reason = "LLM provider failed 3 rounds in a row"`; `PATCH status: running` resets both.
- Standings: `unique_required` desc, `quality` (sum of best quality per required type) desc, `budget` desc, `name` asc; equal in all three → same `rank`.
- Running sessions without `auction` are skipped with a warning; never auto-completed. `/bids` returns only docs with `lot_number`.
- Backend coverage ≥ 90, `ruff` + `mypy` clean; frontend coverage ≥ 90, `lint` + `typecheck` + `build` clean. UI copy English, conventions in `frontend/AGENTS.md` (brass only for the #1 standing / primary actions).

## Review Focus

- A bid exactly equal to the player's remaining budget is valid; one point over is `over_budget`. → Task 4.
- The current leader raising their own bid keeps the lot open and moves the price up (no sale that round). → Task 4.
- Model replies with prose around the JSON, a numeric string (`"120"`), a negative number or a non-number → JSON extracted / `120` accepted / negative and non-number become `no_answer`. → Task 3.
- Two engine ticks for the same round (overlapping loop or slow DB) must not settle the round twice. → Task 6.
- Duplicate copies of a required item count once, with the higher quality. → Task 4.

---

## File Structure

Backend (`backend/app/`):
- Create `services/auction/__init__.py`, `catalog.py` (lot generation + `ITEM_NAMES`), `prompt.py` (`SYSTEM_PROMPT`, state + message builders), `decision.py` (`Decision`, `parse_decision`), `rules.py` (pure round/sale/standings logic).
- Modify `services/llm/protocol.py` + the four providers + `manager.py` (`complete_json`), `schemas/game.py`, `services/game_sessions.py`, `routers/game_sessions.py`, `services/game_engine.py`, `services/llm_service.py`.

Frontend (`frontend/src/`):
- Modify `types.ts`, `api/hooks.ts`, `components/SessionsPanel.tsx`, `SessionRoster.tsx`, `PlayerDialog.tsx`, `pages/SubmitPromptPage.tsx`; create `components/SessionStandings.tsx`.

---

### Task 1: `complete_json` on every LLM provider

**Files:** Modify `backend/app/services/llm/protocol.py`, `openai_provider.py`, `anthropic_provider.py`, `ollama_provider.py`, `gemini_provider.py`, `manager.py`. Tests: the four `tests/test_llm_*_provider.py`, `tests/test_llm_manager.py`.

**Interfaces:**
- Produces: `LLMProvider.complete_json(self, system: str, user: str) -> str` (raw text; raises on API errors). `LLMServiceManager.complete_json(self, system: str, user: str) -> str` — primary; on exception **or** empty/whitespace text, the fallback if configured; raises `RuntimeError("No LLM provider configured")` when none.
- Provider specifics: OpenAI `chat.completions.create(model, temperature, response_format={"type": "json_object"}, messages=[system, user])` → `choices[0].message.content or ""`; Anthropic `messages.create(model, max_tokens=1024, system=system, messages=[user])` (no temperature) → first `TextBlock.text`, else raise `ValueError`; Ollama POST `/api/chat` with `"format": "json"`, `"stream": false`, messages `[system, user]`, `options.temperature` → `message.content`; Gemini `aio.models.generate_content(model, contents=user, config=GenerateContentConfig(system_instruction=system, temperature, response_mime_type="application/json"))` → `response.text or ""`.
- Keep `generate_bids` for now (Task 6 removes it).

- [ ] **Step 1: Failing tests** — per provider `test_complete_json_sends_system_and_user_and_returns_text` (assert the exact kwargs above, e.g. Gemini `config.system_instruction == "S"`, Anthropic kwargs have no `temperature`), `test_complete_json_propagates_api_errors`; manager: `test_complete_json_uses_fallback_on_error_or_empty_text`, `test_complete_json_without_provider_raises`.
- [ ] **Step 2: Run** `cd backend && .venv/bin/python -m pytest -q tests/test_llm_*` — FAIL (no attribute).
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** full backend suite + ruff + mypy — PASS.
- [ ] **Step 5: Commit** `feat(backend): complete_json on LLM providers`

---

### Task 2: Lot catalog

**Files:** Create `backend/app/services/auction/__init__.py`, `catalog.py`; test `backend/tests/test_auction_catalog.py`.

**Interfaces:**
- Produces: `ITEM_NAMES: tuple[str, ...]` (≥ 60 unique fantasy item names, no categories); `generate_lots(lots_count: int, seed: int) -> tuple[list[dict], list[str]]`. Each lot: `{"number": int, "item": str, "quality": int, "required": bool, "status": "pending", "sold_to": None, "sold_to_name": None, "price": None, "sold_in_round": None}`. Second value: sorted required type names. When `k > len(ITEM_NAMES)`, extra types are `"<name> II"`, `"<name> III"`, … Use `random.Random(seed)` only.

- [ ] **Step 1: Failing tests** — `test_lot_count_numbering_and_quality_range` (lots_count 12: numbers 1..12, quality in 1..10); `test_every_type_appears_and_pool_size` (12 → 8 distinct types, each ≥ 1 lot); `test_required_share` (8 types → 6 required; lots_count 1 → 1 type, required); `test_required_items_sorted_and_match_lots`; `test_same_seed_same_lots_different_seed_differs`; `test_more_types_than_names_get_suffixes` (lots_count 200 → 120 types, all unique, some end with " II").
- [ ] **Step 2: Run** `.venv/bin/python -m pytest -q tests/test_auction_catalog.py` — FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — PASS; ruff + mypy clean.
- [ ] **Step 5: Commit** `feat(backend): generate auction lots with quality and required types`

---

### Task 3: Prompt building and decision parsing

**Files:** Create `backend/app/services/auction/prompt.py`, `decision.py`; tests `backend/tests/test_auction_prompt.py`, `test_auction_decision.py`.

**Interfaces:**
- Produces (`prompt.py`): `SYSTEM_PROMPT: str` — byte-for-byte the §1 block of `docs/llm-bid-prompt.md`; `build_state(session: dict, player_ref: str) -> dict` — keys exactly as the doc example (`lot` without status/sold fields, `auction.leader` = leader name or `None`, `you`, `required_items`, `players` in roster order with `items: [{"item","quality","required"}]`, `remaining_lots` = lots after the current one); `build_user_message(instructions: str, state: dict) -> str` — §2 shape, JSON via `json.dumps(state, indent=2, ensure_ascii=False)`.
- Produces (`decision.py`): `@dataclass(frozen=True) class Decision: bid: int; reason: str`; `parse_decision(text: str) -> Decision | None` — first `{...}` object in the text; `bid` int/float/numeric string, floored; negative, missing or non-numeric → `None`; `reason` str (missing → `""`), cut to 100 chars.

- [ ] **Step 1: Failing tests** — `test_system_prompt_matches_doc` (read `../docs/llm-bid-prompt.md`, extract the first ```text block, compare); `test_system_prompt_has_no_goal_or_required_semantics` (`"required" not in SYSTEM_PROMPT`, `"GOAL" not in SYSTEM_PROMPT`); `test_build_state_matches_doc_example` (session fixture reproducing the doc's numbers → dict equal to the doc's JSON); `test_user_message_shape`; decision: `test_parses_plain_json`, `test_extracts_json_from_prose`, `test_numeric_string_and_float_are_floored` (`"120"`→120, `125.9`→125), `test_negative_or_non_numeric_bid_is_none`, `test_reason_cut_to_100`, `test_invalid_json_is_none`.
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat(backend): auction prompt and decision parsing`

---

### Task 4: Round, sale and standings rules (pure)

**Files:** Create `backend/app/services/auction/rules.py`; test `backend/tests/test_auction_rules.py`.

**Interfaces:**
- Consumes: `Decision` (Task 3).
- Produces:
  - `@dataclass(frozen=True) class Answer: player_ref: str; name: str; decision: Decision | None; response_ms: float`
  - `classify(decision: Decision | None, highest_bid: int, budget: int) -> str` (outcome per Global Constraints; `None` → `"no_answer"`).
  - `@dataclass class RoundResult: outcomes: dict[str, str]; void: bool; sale: dict | None; unsold: bool; auction: dict | None; lots: list[dict]; roster: list[dict]; finished: bool` — `sale = {"buyer_ref","buyer_name","price","round"}`; `auction` is the next state (same lot next round, next lot round 1, or `None` when the game ends); `lots`/`roster` are updated copies (sale applied: lot sold fields, buyer `budget -= price`, buyer `items += {"item","quality","required","lot_number","price"}`).
  - `resolve_round(session: dict, answers: list[Answer]) -> RoundResult` — uses `session["auction"]`, `session["lots"]`, `session["roster"]`, `session["settings"]["max_rounds"]`; implements spec §Runda steps 3–7 and §Awaria (void when every answer is `no_answer`: `auction` same with `void_rounds + 1`, nothing else changes). A non-void round resets `void_rounds` to 0.
  - `compute_standings(roster: list[dict]) -> list[dict]` — `{"rank","player_ref","name","unique_required","quality","budget"}`.

- [ ] **Step 1: Failing tests** — `test_classify_bid_equal_to_budget_is_valid_and_one_over_is_over_budget`; `test_classify_pass_and_not_higher`; `test_highest_valid_bid_leads_and_round_advances`; `test_tie_goes_to_faster_answer`; `test_no_new_bid_sells_to_leader_and_charges_budget`; `test_leader_outbidding_self_keeps_lot_open`; `test_last_round_sells_to_round_winner`; `test_no_bids_without_leader_is_unsold_and_moves_on`; `test_last_lot_sale_finishes_game` (`auction is None`, `finished`); `test_all_no_answer_is_void_and_increments_counter`; `test_answer_after_void_resets_counter`; `test_standings_duplicates_count_once_with_best_quality`; `test_standings_tiebreak_quality_then_budget_and_shared_rank`; `test_not_required_items_do_not_score`.
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement** (no I/O, no randomness, inputs not mutated).
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat(backend): ascending auction rules and standings`

---

### Task 5: Session settings, start and API shape

**Files:** Modify `backend/app/schemas/game.py`, `services/game_sessions.py`, `routers/game_sessions.py`; tests `backend/tests/test_session_roster.py`, `test_game_sessions.py`, new `test_session_auction_api.py`; `AGENTS.md` endpoints.

**Interfaces:**
- Consumes: `generate_lots` (Task 2), `compute_standings` (Task 4).
- Produces (schemas): `SessionSettings(budget: int = 1000, lots_count: int = 12, max_rounds: int = 10)` with the Global ranges; `GameSessionCreate.settings: SessionSettings | None`; `GameSessionUpdate.settings: SessionSettings | None`; `OwnedItemOut{item, quality, required, lot_number, price}`; `RosterEntryOut` + `budget: int | None`, `items: list[OwnedItemOut]`; `LotOut{number, item, quality, required, status, sold_to, sold_to_name, price, sold_in_round}`; `AuctionOut{lot_number, current_round, highest_bid, leader_ref, leader_name, void_rounds}`; `StandingOut{rank, player_ref, name, unique_required, quality, budget}`; `GameSessionOut` + `settings: SessionSettings`, `required_items: list[str]`, `lots: list[LotOut]`, `auction: AuctionOut | None`, `standings: list[StandingOut]`, `pause_reason: str | None`; `BidOut{lot_number, item, round, player_id, player_ref, bid, reason, response_ms, outcome, won, created_at}`.
- Behaviour: create stores `settings` (defaults when omitted); PATCH `settings` only when `pending` (else 409); missing `settings` on read → defaults. `start_session` (existing atomic pinning) additionally sets `seed` (`random.SystemRandom().randrange(2**31)`), `lots`/`required_items` from `generate_lots`, roster `budget`/`items`, `auction = {lot_number: 1, current_round: 1, highest_bid: 0, leader_ref: None, leader_name: None, void_rounds: 0}`, `standings` — all in the same guarded `update_one`. PATCH `paused → running` also resets `auction.void_rounds` to 0 and unsets `pause_reason`. New `GET /api/game-sessions/{id}/bids?lot_number=` → `list[BidOut]` from `player_bids` with `session_id` and `lot_number` present, sorted `lot_number, round, response_ms`; malformed id 404.

- [ ] **Step 1: Failing tests** — `test_create_with_settings_and_defaults`; `test_settings_validation_ranges_422`; `test_patch_settings_only_while_pending`; `test_start_generates_lots_budgets_and_auction` (settings lots_count 5 → 5 lots, every roster budget = settings.budget, auction lot 1 round 1, standings all rank 1); `test_resume_from_paused_resets_void_rounds_and_reason`; `test_bids_endpoint_filters_and_sorts_new_shape_only` (insert one legacy `{item_name, bid_amount}` doc and new docs).
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** full backend suite + ruff + mypy — PASS.
- [ ] **Step 5: Commit** `feat(backend): session auction settings, lot generation at start`

---

### Task 6: Engine plays one auction round per tick

**Files:** Modify `backend/app/services/game_engine.py`, `services/llm_service.py`, `services/llm/protocol.py`, the four providers, `manager.py`; tests `backend/tests/test_game_engine.py`, `test_llm_service.py`, provider tests.

**Interfaces:**
- Consumes: Tasks 1, 3, 4, 5.
- Produces: `LLMService.ask_player(*, system: str, user: str) -> tuple[str | None, float]` — `asyncio.wait_for(llm_manager.complete_json(system, user), 30)`; returns `(text, response_ms)`; any exception or timeout → `(None, elapsed_ms)` with a warning log. `GameEngineService._run_iteration(session)` — skip (warning) when `auction` missing; for every roster entry concurrently: `build_state` → `build_user_message(entry["prompt_text"], state)` → `ask_player(SYSTEM_PROMPT, …)` → `parse_decision`; `resolve_round`; persist with ONE `update_one({"_id", "status": "running", "auction.lot_number": L, "auction.current_round": R}, {"$set": {auction, lots, roster, standings, status, pause_reason?, updated_at}})`; when `matched_count == 0` write nothing else; otherwise `insert_many` one `player_bids` doc per answer (`session_id, lot_number, item, round, player_id, player_ref, bid, reason, response_ms, outcome, won, created_at`; `won=True` on the buyer's winning bid doc of a sale — for a sale caused by "no new bid", that bid is in an earlier round: set it with `update_one` on the latest `outcome: "leading"` doc of the buyer for that lot). Status `completed` when `finished`; `paused` + `pause_reason` when `void_rounds >= 3`.
- Remove: `generate_bids` from protocol/providers/manager, `LLMService.generate_bids` and `generate_bids_per_player`, `BidResult`, and their tests.

- [ ] **Step 1: Failing tests** (patch `llm_service.ask_player`) — `test_round_sends_one_request_per_player_with_own_instructions` (user message contains only that player's prompt; system == `SYSTEM_PROMPT`); `test_round_persists_outcomes_and_advances`; `test_sale_charges_budget_and_marks_winning_bid` (two rounds: leader then all pass); `test_last_lot_completes_session`; `test_three_void_rounds_pause_session`; `test_stale_round_is_not_settled_twice` (call `_run_iteration` twice with the same stale session dict → bids inserted once, round advanced once); `test_legacy_running_session_is_skipped`; `ask_player`: `test_ask_player_times_out_to_none` (patch timeout small via monkeypatching a module constant `REQUEST_TIMEOUT_SECONDS = 30`), `test_ask_player_error_to_none`.
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement**, then delete the removed paths and their tests.
- [ ] **Step 4: Run** full backend suite + ruff + mypy — PASS, coverage ≥ 90.
- [ ] **Step 5: Commit** `feat(backend): engine runs ascending auction rounds`

---

### Task 7: Frontend types and hooks

**Files:** Modify `frontend/src/types.ts`, `api/hooks.ts`, `api/hooks.test.tsx`.

**Interfaces:**
- Types mirroring Task 5 (snake_case): `SessionSettings`, `OwnedItem`, `Lot`, `Auction`, `Standing`, `SessionBid`; `RosterEntry` + `budget: number | null`, `items: OwnedItem[]`; `GameSession` + `settings`, `required_items`, `lots`, `auction`, `standings`, `pause_reason`.
- Hooks: `useCreateGameSession()` now takes `{ name: string; settings?: SessionSettings }`; `useUpdateSessionSettings()` → `PATCH /game-sessions/{id}` `{settings}`; `useSessionBids(sessionId: string | null, lotNumber?: number)` → `GET /game-sessions/{id}/bids` (`params: {lot_number}` when given), key `['session-bids', sessionId, lotNumber]`; `useGameSessions()` gets `refetchInterval: (q) => q.state.data?.some(s => s.status === 'running') ? 3000 : false`.

- [ ] **Step 1: Failing tests** for each hook's exact `apiClient` call and the refetch interval function.
- [ ] **Step 2–4:** RED → implement → `npx vitest run src/api && npm run -s typecheck` GREEN.
- [ ] **Step 5: Commit** `feat(frontend): auction session types and hooks`

---

### Task 8: Admin UI for the auction

**Files:** Modify `frontend/src/components/SessionsPanel.tsx`, `SessionRoster.tsx`, `PlayerDialog.tsx`, `pages/SubmitPromptPage.tsx`; create `components/SessionStandings.tsx`; tests alongside; `frontend/AGENTS.md`.

**Interfaces:**
- `SessionsPanel`: next to *Session name*, number fields *Budget* (default 1000), *Items* (12), *Rounds per item* (10), validated to the Global ranges; **New session** sends `{name, settings}`.
- `SessionRoster`: while `pending`, the same three fields editable (save via `useUpdateSessionSettings`, disabled while saving); while `running`/`paused`/`completed`: a status line `Lot {n} of {lots_count} · {item} · quality {q} · required` / `not required`, `Round {r} of {max_rounds}`, `Highest bid {b} · {leader_name}` (or `No bids yet`); `paused` shows `pause_reason` in a warning `Alert`; roster rows show `{budget} pts` and `{unique required} required items`.
- `SessionStandings({ session })` — `Panel title="Standings"`, `DataTable` columns Rank (mono, brass for rank 1), Player, Required items, Quality, Budget; rendered under the roster once `standings.length > 0`.
- `PlayerDialog`: prompt field label **Agent prompt**, helper `Give your agent a persona and tell it what to check and how to bid.` (keep the version helper after it in edit mode).
- `SubmitPromptPage`: under the intro, `Your prompt is your agent: give it a persona and tell it what to look at and how to bid.`

- [ ] **Step 1: Failing tests** — settings fields send `{name, settings: {budget: 500, lots_count: 3, max_rounds: 4}}`; out-of-range disables **New session**; pending roster saves settings; running roster shows lot/round/highest-bid lines; paused shows the reason; standings table renders rows and brass rank 1; dialog label/helper; submit-page copy.
- [ ] **Step 2–4:** RED → implement → full `npx vitest run --coverage`, lint, typecheck, build GREEN.
- [ ] **Step 5: Manual check** (controller): start a 2-player session with lots_count 3, max_rounds 3 against the running backend, watch it complete, confirm budgets drop by the sold prices and standings match the rules.
- [ ] **Step 6: Commit** `feat(frontend): admin controls and standings for ascending auction`
