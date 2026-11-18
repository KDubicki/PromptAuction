# Players, Prompt Versions and Session Rosters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admins create game sessions, add players to them (from a Google Form, by hand, or both); every player owns a versioned prompt and plays a session with the version pinned at start.

**Architecture:** New `players` collection; the existing `prompts` collection becomes the version history (one document = one version, linked by `player_ref`). Sessions get a `roster`; `POST /start` copies each player's current accepted version into the roster and the game engine reads only that. Outside submissions (Google Form, webhook) go through one `submit_from_outside` function that matches or creates the player.

**Tech Stack:** FastAPI, Motor/MongoDB (no ODM), Pydantic v2, pytest + mongomock-motor; React 19, MUI 9, TanStack Query 5, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-18-players-prompt-versions-sessions-design.md` (Polish). Read it before any task; this plan only adds file layout, names and tests.

## Global Constraints

- Backend coverage `fail_under = 90`; frontend Vitest thresholds 90 (lines/statements/functions/branches). CI runs `ruff check app tests`, `mypy` (strict defs in `app`), `npm run lint`, `npm run typecheck`.
- `prompt_text`: 3–2000 chars. `name`: 1–100 chars. `email`: max 320 chars.
- Keys: `name_key = name.strip().casefold()`, `email_key = email.strip().casefold()`; never store `email_key: null` — omit the field (a unique *sparse* index still indexes nulls; see `4c91a7d`).
- Unique indexes that must ignore legacy docs use `partialFilterExpression` with `$type: "string"`, never `sparse`.
- Errors: `404` unknown id **including malformed ObjectIds**, `409` rule violations, `503` DB not connected (existing convention).
- Session start needs ≥ 2 players, each with a current accepted version.
- Allowed `PATCH` status transitions: `running→paused`, `paused→running`, `running→completed`, `paused→completed`; same-status is a no-op; anything else `409`.
- Frontend conventions in `frontend/AGENTS.md`: brass (`primary`) only for "won"/primary action, figures mono, `DataTable` for tables, sentence-case labels, counts in `Panel`'s `slug`. UI copy is English.
- Tests on mongomock run without production indexes: a test that relies on a unique index creates it itself.

## Review Focus

- A nick differing only in case/whitespace (`" aurelia"` vs `"Aurelia"`) is the same player: `409` on create, and an outside submission lands on the existing player. → Task 1, Task 2.
- A malformed id in any path (`/api/players/abc`, `/api/game-sessions/abc/start`) returns `404`, not `500`. → Task 1, Task 3.
- Two Start clicks in a row: the second gets `409`, the roster is pinned once. → Task 3.
- Accepting an older pending version after a newer one was accepted keeps the newer one current; rejecting the current one falls back to the previous accepted. → Task 2.
- Two versions written for one player at the same moment both get distinct numbers (retry on `DuplicateKeyError`). → Task 1.

---

## File Structure

Backend (`backend/app/`):
- `core/ids.py` — `parse_object_id(value: str, not_found: str) -> ObjectId` raising `HTTPException(404)`.
- `schemas/players.py` — player/version request and response models.
- `services/players.py` — all player + version rules, `submit_from_outside`, `PlayerError`.
- `routers/players.py` — `/api/players` endpoints.
- `services/game_sessions.py` — roster, start, status transitions, `session_to_out`.
- `routers/game_sessions.py` — thin; delegates to the service.
- `services/migrations.py` — `migrate_prompts_to_players`.
- Modified: `db/mongo.py` (indexes), `schemas/game.py`, `schemas/prompts.py`, `routers/prompts.py`, `services/google_forms.py`, `services/game_engine.py`, `main.py`.

Frontend (`frontend/src/`):
- `types.ts`, `api/hooks.ts` — new types and hooks.
- `components/PlayersPanel.tsx`, `components/PlayerDialog.tsx`, `components/PlayerHistoryDialog.tsx`.
- `components/SessionsPanel.tsx`, `components/SessionRoster.tsx`, `components/AddPlayersDialog.tsx`.
- Modified: `components/AdminPanel.tsx` (composition + review-row meta).

---

### Task 1: Players and admin-written versions

**Files:**
- Create: `backend/app/core/ids.py`, `backend/app/schemas/players.py`, `backend/app/services/players.py`, `backend/app/routers/players.py`, `backend/tests/test_players.py`
- Modify: `backend/app/db/mongo.py` (`_ensure_indexes`), `backend/app/main.py` (include router), `AGENTS.md` (API + collections tables; note "`users` is not used by the game — players are in `players`")

**Interfaces:**
- Produces (`app/core/ids.py`): `parse_object_id(value: str, not_found: str = "Not found") -> ObjectId`
- Produces (`app/schemas/players.py`):
  - `PromptSource = Literal["admin", "google_forms", "webhook", "migration"]`
  - `PlayerCreate(name: str, email: str | None = None, prompt_text: str)`
  - `PlayerUpdate(name: str | None = None, email: str | None = None)`
  - `PromptVersionCreate(prompt_text: str)`
  - `PromptVersionOut(id: str, version: int, prompt_text: str, status: PromptStatus, source: PromptSource, player_name: str, identity_warning: str | None, email: str | None, created_at: datetime | None)`
  - `PlayerOut(id: str, name: str, email: str | None, current_version: PromptVersionOut | None, pending_versions: int, created_at: datetime | None)`
  - `PlayerDetailOut(PlayerOut)` + `versions: list[PromptVersionOut]` (newest first)
- Produces (`app/services/players.py`):
  - `class PlayerError(Exception)` with `status_code: int`, `message: str`; subclasses `PlayerNotFoundError` (404), `PlayerConflictError` (409)
  - `name_key(name: str) -> str`, `email_key(email: str | None) -> str | None`
  - `async def create_player(db, name: str, email: str | None, prompt_text: str) -> dict` — returns the player doc
  - `async def add_version(db, player: dict, prompt_text: str, *, status: PromptStatus, source: PromptSource, name_at_version: str, email: str | None = None, form_response_id: str | None = None, identity_warning: str | None = None, submitted_at: datetime | None = None) -> dict` — returns the inserted version doc; assigns `version = max + 1` with up to 3 retries on `DuplicateKeyError`; calls `recompute_current_version` when `status == "accepted"`
  - `async def recompute_current_version(db, player_ref: str) -> str | None` — sets `players.current_version_id` to the accepted version with the highest number (or `None`)
  - `async def update_player(db, player_id: str, name: str | None, email: str | None) -> dict`
  - `async def delete_player(db, player_id: str) -> None`
  - `async def player_out(db, player: dict) -> PlayerOut`, `async def player_detail_out(db, player: dict) -> PlayerDetailOut`
- Version docs keep legacy fields: `player_id` = `name_at_version`, plus `player_ref`, `version`, `source`, `status`, `prompt_text`, `email` (omit when None), `form_response_id` (omit when None), `identity_warning` (omit when None), `created_at`, `updated_at`.

- [ ] **Step 1: Write failing API tests in `backend/tests/test_players.py`**
  - `test_create_player_creates_accepted_v1` — `POST /api/players {"name":"Aurelia","email":"A@x.pl","prompt_text":"Bid high."}` → 201; body `name == "Aurelia"`, `current_version.version == 1`, `current_version.status == "accepted"`, `current_version.source == "admin"`, `pending_versions == 0`.
  - `test_create_player_rejects_same_name_ignoring_case` — create `"Aurelia"`, then `" aurelia "` → 409. (Create the `name_key` unique index in the test, or rely on an explicit pre-check in the service; the service must pre-check so mongomock without indexes also returns 409.)
  - `test_create_player_rejects_taken_email` → 409 for a second player with `"a@X.pl"`.
  - `test_add_version_increments_and_becomes_current` — `POST /api/players/{id}/versions {"prompt_text":"Bid low."}` → 201 version 2; `GET /api/players/{id}` → `current_version.version == 2`, `versions` == `[2, 1]` by `version`.
  - `test_add_version_retries_on_duplicate_version` — monkeypatch the prompts collection class `insert_one` to raise `DuplicateKeyError` once, then call through → 201, `version == 2`.
  - `test_rename_keeps_old_name_in_former_name_keys` — `PATCH {"name":"Aurora"}` → 200; DB doc has `former_name_keys == ["aurelia"]`; old version still has `player_id == "Aurelia"`.
  - `test_rename_rejects_name_held_by_other_player_now_or_formerly` → 409 in both cases.
  - `test_list_players_sorted_by_name_with_pending_count`.
  - `test_delete_player_removes_versions_and_tombstones_form_responses` — insert a version with `form_response_id="r1"` via `add_version(...)`, `DELETE` → 204; `prompts` empty for that player; `ignored_form_responses` has `{_id: "r1"}`.
  - `test_delete_player_in_unfinished_session_is_409` — insert `game_sessions` doc `{status: "pending", roster: [{"player_ref": id, "name": "Aurelia"}]}` → 409.
  - `test_malformed_player_id_is_404` — `GET /api/players/abc` → 404.
  - `test_players_endpoints_503_without_db` (use `client_no_db`).

- [ ] **Step 2: Run** `cd backend && .venv/bin/python -m pytest tests/test_players.py -q` — Expected: FAIL (404 / import errors).

- [ ] **Step 3: Implement** `core/ids.py`, `schemas/players.py`, `services/players.py`, `routers/players.py` (prefix `/players`, map `PlayerError` → `HTTPException(e.status_code, e.message)`), register in `main.py`. Uniqueness is checked in the service (`find_one` on `name_key` / `former_name_keys` / `email_key`) *and* backed by indexes. Add to `_ensure_indexes`:
  - `players`: `name_key` unique; `email_key` unique with `partialFilterExpression={"email_key": {"$type": "string"}}`; `former_name_keys`.
  - `prompts`: `player_ref`; `(player_ref, version)` unique with `partialFilterExpression={"player_ref": {"$type": "string"}}`.
  - `game_sessions`: `roster.player_ref`.

- [ ] **Step 4: Run** the same command — Expected: PASS. Then `.venv/bin/ruff check app tests && .venv/bin/mypy` — clean.

- [ ] **Step 5: Commit** — `git commit -m "feat(backend): players with versioned prompts"`

---

### Task 2: Outside submissions, review and current-version rules

**Files:**
- Modify: `backend/app/services/players.py`, `backend/app/routers/prompts.py`, `backend/app/schemas/prompts.py`, `backend/app/services/google_forms.py` (`_import_responses`)
- Test: `backend/tests/test_player_submissions.py`; update `backend/tests/test_prompts.py`, `backend/tests/test_google_forms.py` where assertions change

**Interfaces:**
- Consumes: Task 1 `add_version`, `create_player`-style insert, `name_key`, `email_key`, `recompute_current_version`.
- Produces: `async def submit_from_outside(db, *, name: str, email: str | None, prompt_text: str, form_response_id: str | None, source: PromptSource, submitted_at: datetime | None = None) -> SubmissionResult` where `SubmissionResult = NamedTuple(version: dict | None, created: bool, ignored: bool)`.
  - Order exactly as spec §"Formularz Google i webhook" steps 1–6: existing `form_response_id` → return it (`created=False`); in `ignored_form_responses` → `ignored=True`; match by `email_key`, then `name_key`, then `former_name_keys`; unknown → create player (no version current) + v1 `pending`; known → vN+1 `pending`, fill missing email, never overwrite an existing one; `identity_warning="email_mismatch"` when matched **not** by email and the player has an email that differs from the submission's (including submission without email).
- Produces: `PromptSubmissionOut` gains `player_ref: str | None`, `version: int | None`, `source: str | None`, `identity_warning: str | None` (defaults `None` so legacy docs still serialize).
- `PATCH /api/prompts/{id}/status` additionally calls `recompute_current_version(db, doc["player_ref"])` when the doc has `player_ref`; malformed id → 404.
- `POST /api/prompts/webhook`: same request schema; response 201 with the version when created, 200 with the existing version when duplicate, 200 `{"ignored": true}`-shaped response when tombstoned — keep `response_model=PromptSubmissionOut` for the first two and return `JSONResponse({"ignored": True, "form_response_id": ...}, 200)` for the third.
- Google import: `_import_responses` calls `submit_from_outside(..., source="google_forms")` per response instead of inserting directly; `skipped` still counts invalid responses; `imported` counts `created=True`.

- [ ] **Step 1: Write failing tests in `backend/tests/test_player_submissions.py`**
  - `test_new_nick_creates_player_with_pending_v1` — webhook `{"player_id":"Morrow","prompt_text":"Shadow."}` → 201; `GET /api/players` shows Morrow with `current_version is None`, `pending_versions == 1`.
  - `test_known_nick_adds_pending_version_case_insensitive` — admin-created "Aurelia" (no email); webhook `"player_id":" AURELIA "` → version 2 pending, no `identity_warning`.
  - `test_email_wins_over_nick` — players A(email a@x) and B; webhook nick "B" + email "a@x" → version lands on A, `player_id` on the version is "B".
  - `test_nick_match_with_different_email_sets_warning` — Aurelia has `a@x`; webhook nick "Aurelia" email `k@y` → `identity_warning == "email_mismatch"`; same with no email.
  - `test_missing_email_is_filled_not_overwritten`.
  - `test_former_nick_routes_to_renamed_player`.
  - `test_tombstoned_response_is_ignored` — insert `ignored_form_responses {_id:"r9"}`; webhook with `form_response_id:"r9"` → 200 `{"ignored": true, ...}`; no player created.
  - `test_accepting_older_version_keeps_newer_current` — v2 accepted (admin), v1 pending from webhook accepted later → current stays 2.
  - `test_rejecting_current_falls_back_to_previous_accepted`.
  - `test_status_update_malformed_id_is_404`.
  - In `test_google_forms.py`, `test_connect_imports_existing_responses`: assert two players exist (`Alice`, `Bob`) with pending v1, and prompts have `source == "google_forms"`, `version == 1`.

- [ ] **Step 2: Run** `.venv/bin/python -m pytest tests/test_player_submissions.py tests/test_prompts.py tests/test_google_forms.py -q` — Expected: new tests FAIL.

- [ ] **Step 3: Implement** `submit_from_outside`, route the webhook and Google import through it, extend `PromptSubmissionOut` and `_prompt_doc_to_out`, add the recompute to the status route.

- [ ] **Step 4: Run** the full backend suite `.venv/bin/python -m pytest -q --cov=app` — Expected: PASS, total ≥ 90%. Ruff + mypy clean.

- [ ] **Step 5: Commit** — `git commit -m "feat(backend): route form and webhook submissions to players"`

---

### Task 3: Session rosters, start and status transitions

**Files:**
- Create: `backend/app/services/game_sessions.py`, `backend/tests/test_session_roster.py`
- Modify: `backend/app/schemas/game.py`, `backend/app/routers/game_sessions.py`, `backend/app/models/game.py` (drop `accepted_prompt_ids`), `backend/tests/test_game_sessions.py` (`test_update_game_session` must now go `pending → start → paused`), `AGENTS.md` (endpoints)

**Interfaces:**
- Consumes: Task 1 `parse_object_id`, players collection fields.
- Produces (`schemas/game.py`):
  - `RosterEntryOut(player_ref: str, name: str, current_version: int | None, version_id: str | None, version: int | None, prompt_text: str | None)` — `current_version` is the player's live current version number (read at response time, only meaningful while `pending`); pinned fields are `None` until start.
  - `GameSessionOut` drops `accepted_prompt_ids`, adds `roster: list[RosterEntryOut]`, `started_at: datetime | None`, `start_blockers: list[str]` (human-readable; empty when startable; only computed for `pending`).
  - `RosterAdd(player_id: str)`
- Produces (`services/game_sessions.py`): `SessionError(Exception)` (`status_code`, `message`); `async def session_to_out(db, doc: dict) -> GameSessionOut`; `async def add_to_roster(db, session_id: str, player_id: str) -> dict`; `async def remove_from_roster(db, session_id: str, player_id: str) -> dict`; `async def start_session(db, session_id: str) -> dict`; `def check_transition(current: GameStatus, new: GameStatus) -> None`.
- Start-blocker copy (exact): `"Add at least 2 players"`; `"{name} has no accepted prompt yet"` (one line per player).
- Start is one `update_one({"_id": oid, "status": "pending"}, {"$set": {...}})`; `matched_count == 0` → re-read: missing → 404, else 409 `"Session has already started"`.
- Routes: `POST /game-sessions/{id}/players` (201, returns `GameSessionOut`), `DELETE /game-sessions/{id}/players/{player_id}` (200, `GameSessionOut`), `POST /game-sessions/{id}/start` (200, `GameSessionOut`). `DELETE /game-sessions/{id}` on `running` → 409. All malformed ids → 404.

- [ ] **Step 1: Write failing tests in `backend/tests/test_session_roster.py`**
  - `test_add_and_remove_roster_while_pending` — roster entry has `name`, `current_version == 1`, pinned fields `None`.
  - `test_add_same_player_twice_is_409`; `test_add_unknown_player_is_404`; `test_roster_locked_after_start_is_409` (add and remove).
  - `test_start_blockers_listed` — one player → `start_blockers == ["Add at least 2 players"]`; add a webhook-created player without accepted version → contains `"Morrow has no accepted prompt yet"`; `POST /start` → 409.
  - `test_start_pins_current_versions` — two players (v1 each), start → 200, `status == "running"`, roster `version == 1`, `prompt_text` equals v1 text, `started_at` set; then add v2 to a player → `GET` session still shows pinned v1.
  - `test_second_start_is_409_and_pins_once`.
  - `test_patch_cannot_jump_pending_to_running` → 409; `test_patch_allowed_transitions` (`running→paused→running→completed`).
  - `test_delete_running_session_is_409`; `test_malformed_session_id_is_404` for GET, PATCH, DELETE, start.

- [ ] **Step 2: Run** `.venv/bin/python -m pytest tests/test_session_roster.py tests/test_game_sessions.py -q` — Expected: FAIL.

- [ ] **Step 3: Implement** the service and slim the router to delegate (keep the 503-without-DB checks).

- [ ] **Step 4: Run** the full backend suite + ruff + mypy — Expected: PASS.

- [ ] **Step 5: Commit** — `git commit -m "feat(backend): session rosters with versions pinned at start"`

---

### Task 4: Game engine plays the pinned roster

**Files:**
- Modify: `backend/app/services/game_engine.py` (`_run_iteration`), `backend/tests/test_game_engine.py` (`_make_session` gets a pinned roster)

**Interfaces:**
- Consumes: session doc `roster` entries with `name`, `player_ref`, `prompt_text` (Task 3).
- `context["accepted_prompts"] = [{"player_id": r["name"], "prompt_text": r["prompt_text"]} for r in roster if r.get("prompt_text")]`. No `db.prompts` query.
- Each inserted `player_bids` doc gains `player_ref` looked up by `name` from the roster (`None` if the LLM returned an unknown name).

- [ ] **Step 1: Write failing tests** in `test_game_engine.py`:
  - `test_run_iteration_uses_only_pinned_roster` — insert an accepted prompt doc for "Outsider" in `prompts`; session roster pins Aurelia; spy on `llm_service.generate_bids` and assert `context["accepted_prompts"] == [{"player_id": "Aurelia", "prompt_text": "Bid high."}]`.
  - `test_bids_carry_player_ref` — LLM returns Aurelia and "Ghost" → bids have `player_ref == <id>` and `None`.

- [ ] **Step 2: Run** `.venv/bin/python -m pytest tests/test_game_engine.py -q` — Expected: FAIL.
- [ ] **Step 3: Implement** in `_run_iteration`.
- [ ] **Step 4: Run** full backend suite — Expected: PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat(backend): engine bids with the session's pinned prompts"`

---

### Task 5: Migrate existing prompts to players

**Files:**
- Create: `backend/app/services/migrations.py`, `backend/tests/test_migrations.py`
- Modify: `backend/app/main.py` (lifespan: after `mongo_manager.connect()`, `if mongo_manager.db is not None: await migrate_prompts_to_players(mongo_manager.db)`), `backend/tests/test_main_lifespan.py` (stub/assert it is called)

**Interfaces:**
- Produces: `async def migrate_prompts_to_players(db) -> int` — returns the number of prompt docs updated; algorithm exactly spec §"Migracja istniejących danych" (sort by `created_at`, group by `player_id.strip().casefold()`, find-or-create player with name from the newest prompt and email from the newest prompt that has one unless taken, number versions, set `player_ref`, keep existing `source` else `"migration"`, recompute current). Idempotent: only prompts without `player_ref`; a group whose player already exists continues numbering after its max version.

- [ ] **Step 1: Write failing tests**
  - `test_migration_groups_by_nick_and_numbers_versions` — three legacy prompts: "Aurelia" (accepted, t1), "aurelia" (pending, t2), "Kestrel" (rejected) → 2 players; Aurelia versions 1 (accepted) and 2 (pending), current = v1; Kestrel current `None`; return value 3.
  - `test_migration_is_idempotent` — second run returns 0, no new players.
  - `test_migration_keeps_google_source_and_skips_taken_email`.
  - `test_lifespan_runs_migration_when_db_connected` (in `test_main_lifespan.py`).
- [ ] **Step 2: Run** `.venv/bin/python -m pytest tests/test_migrations.py tests/test_main_lifespan.py -q` — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** full backend suite + ruff + mypy — Expected: PASS, coverage ≥ 90%.
- [ ] **Step 5: Commit** — `git commit -m "feat(backend): migrate legacy prompts into players"`

---

### Task 6: Frontend types and hooks

**Files:**
- Modify: `frontend/src/types.ts`, `frontend/src/api/hooks.ts`, `frontend/src/api/hooks.test.tsx`

**Interfaces:**
- Types (mirror Task 1–3 schemas, snake_case fields as the API returns them): `PromptSource`, `PromptVersion`, `Player`, `PlayerDetail`, `RosterEntry`, `GameStatus = 'pending' | 'running' | 'paused' | 'completed'`; `GameSession` gains `status: GameStatus`, `roster: RosterEntry[]`, `started_at: string | null`, `start_blockers: string[]`; `PromptSubmission` gains optional `player_ref`, `version`, `source`, `identity_warning`, `email`.
- Hooks (all mutations invalidate `['players']`, `['game-sessions']`, `['prompts']`; query keys exactly these):
  - `usePlayers()` → `GET /players` (no mock fallback; errors surface)
  - `usePlayer(id: string | null)` → `GET /players/{id}`, `enabled: id !== null`, key `['players', id]`
  - `useCreatePlayer()` (`{name, email?, prompt_text}`), `useUpdatePlayer()` (`{id, name?, email?}`), `useAddPromptVersion()` (`{id, prompt_text}`), `useDeletePlayer()` (`id`)
  - `useCreateGameSession()` (`name`), `useAddToRoster()` (`{sessionId, playerId}`), `useRemoveFromRoster()` (`{sessionId, playerId}`), `useStartGameSession()` (`sessionId`)
  - `useGameSessions()` keeps its fallback; update `fallbackSessions` to the new shape (`roster: []`, `started_at: null`, `start_blockers: []`).

- [ ] **Step 1: Write failing hook tests** — one per hook asserting the exact `apiClient` call (`get('/players')`, `post('/players', body)`, `patch('/players/p1', {name})`, `post('/players/p1/versions', {prompt_text})`, `delete('/players/p1')`, `post('/game-sessions', {name})`, `post('/game-sessions/s1/players', {player_id: 'p1'})`, `delete('/game-sessions/s1/players/p1')`, `post('/game-sessions/s1/start')`), plus `usePlayer(null)` does not call the API.
- [ ] **Step 2: Run** `cd frontend && npx vitest run src/api/hooks.test.tsx` — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npx vitest run src/api && npm run -s typecheck` — Expected: PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat(frontend): player and roster API hooks"`

---

### Task 7: Players panel with add, edit and history

**Files:**
- Create: `frontend/src/components/PlayersPanel.tsx`, `PlayerDialog.tsx`, `PlayerHistoryDialog.tsx` and a `.test.tsx` for each

**Interfaces:**
- Consumes: Task 6 hooks and types; `apiErrorMessage`.
- `PlayersPanel()` — `Panel title="Players" slug={`${n} players`}` with action button **Add player**; rows: name (600), `v{n}` mono + current prompt text (secondary, one line clamp 2), or *"No accepted prompt yet"*; row actions **Edit**, **History**, **Delete** (Delete asks `window.confirm("Delete {name} and all prompt versions?")`).
- `PlayerDialog({ open, player, onClose })` — `player === null` → create mode (fields *Nick*, *Email (optional)*, *Prompt*; submit **Add player**); edit mode pre-fills nick, email, prompt from `current_version`; submit **Save**. On save: call `useUpdatePlayer` only if nick/email changed, `useAddPromptVersion` only if prompt text changed (trimmed); nothing changed → close. Helper text under prompt in edit mode: *"Saving a changed prompt creates version {n+1}."* Errors via `apiErrorMessage` in an `Alert`.
- `PlayerHistoryDialog({ playerId, onClose })` — uses `usePlayer`; list newest first: `v{n}`, status, source (`admin`→"Added by admin", `google_forms`→"Google Form", `webhook`→"Webhook", `migration`→"Imported"), date (`toLocaleString`), full text; current version marked *"Current"*.

- [ ] **Step 1: Write failing tests** covering: empty state *"No players yet. Add one, or connect the entry form."*; create submits `{name, email: undefined, prompt_text}` when email blank; edit with only prompt changed calls only `useAddPromptVersion`; edit with only nick changed calls only `useUpdatePlayer`; unchanged → no calls; error alert renders; history lists versions newest first and marks current; delete confirms.
- [ ] **Step 2: Run** `npx vitest run src/components/Player` — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** same + `npm run -s lint && npm run -s typecheck` — Expected: PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat(frontend): players panel with prompt versions"`

---

### Task 8: Sessions panel and roster

**Files:**
- Create: `frontend/src/components/SessionsPanel.tsx`, `SessionRoster.tsx`, `AddPlayersDialog.tsx` and tests

**Interfaces:**
- `SessionsPanel({ selectedId, onSelect })` — `Panel title="Sessions"`; inline *Session name* field + **New session** (creates, then selects the new id); list rows: name, status label (`pending`→"Waiting to start", `running`→"Running", `paused`→"Paused", `completed`→"Completed"), `{n} players`; selected row uses `action.selected` background (no brass).
- `SessionRoster({ session })` — `Panel title={session.name}` with actions **Add players** (only `pending`) and **Start session** (`contained`, only `pending`, disabled when `start_blockers.length > 0`). Blockers render as a list under the header. Rows: name + (`pending`: *"Current v{n}"* or *"No accepted prompt yet"* in `error.main`; started: *"Plays v{version}"*) + **Remove** (only `pending`).
- `AddPlayersDialog({ session, open, onClose })` — MUI `Autocomplete multiple` over `usePlayers()` minus roster; **Add** calls `useAddToRoster` per selected player sequentially, then closes.

- [ ] **Step 1: Write failing tests**: create selects the new session; status labels; Start disabled with blockers shown; Start calls `useStartGameSession('s1')`; after start no Add/Remove/Start and rows read "Plays v2"; dialog excludes players already in roster and adds the chosen ones.
- [ ] **Step 2: Run** `npx vitest run src/components/Session src/components/AddPlayers` — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** same + lint + typecheck — Expected: PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat(frontend): game sessions with player rosters"`

---

### Task 9: Admin page composition and review-queue context

**Files:**
- Modify: `frontend/src/components/AdminPanel.tsx`, `AdminPanel.test.tsx`, `pages/AdminPage.test.tsx`, `router.test.tsx` (mock the new panels like `GoogleFormSourcePanel`), `frontend/AGENTS.md` (components list, hooks table)

**Interfaces:**
- Consumes: Tasks 7–8 components.
- Order on the page: heading → `SessionsPanel` → `SessionRoster` for the selected session (defaults to the newest `pending`, else the newest) → `PlayersPanel` → *Review queue* → `GoogleFormSourcePanel`. Selection is local `useState<string | null>`.
- Review row meta line (body2, secondary) before the prompt: `version === 1 ? "New player" : "Version {version}"` + source (`"from Google Form"` / `"via webhook"`; nothing for admin). When `identity_warning === "email_mismatch"`: `Alert severity="warning"` *"Email differs from this player's. Submitted with {email ?? "no email"}."*

- [ ] **Step 1: Write failing tests**: meta line for v1 vs v4; warning renders only with `identity_warning`; selected-session default picks the newest pending.
- [ ] **Step 2: Run** `npx vitest run src/components/AdminPanel.test.tsx src/pages src/router.test.tsx` — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** full `npx vitest run --coverage`, `npm run -s lint`, `npm run -s typecheck`, `npm run -s build` — Expected: all PASS, coverage ≥ 90.
- [ ] **Step 5: Manual check** — run the stack (Mongo + uvicorn + `npm run dev`), at 1280 px light and 390 px dark: create session, add player by hand, edit prompt (v2), add both to session, see blocker with one player, start, confirm "Plays v2", then edit prompt again and confirm the session still says v2.
- [ ] **Step 6: Commit** — `git commit -m "feat(frontend): admin flow for sessions, players and versions"`
