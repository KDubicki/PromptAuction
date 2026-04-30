# PromptAuction Backend — Development Plan

## Overview

Backend development plan for the PromptAuction API. Each section is referenced by the main [DEVELOPMENT_PLAN.md](../DEVELOPMENT_PLAN.md) milestones.

---

## BE-1: Google Forms Webhook Integration

- [ ] Extend `POST /api/prompts/webhook` to accept Google Forms payload structure
- [ ] Parse form fields: `player_id`, `email`, `prompt_text`, `form_response_id`
- [ ] Idempotency: reject duplicate `form_response_id` (unique index in MongoDB)
- [ ] Add `email` and `form_response_id` fields to `prompts` collection schema
- [ ] Webhook token verification (`X-Webhook-Token` header, configurable secret)
- [ ] Rate limiting middleware: sliding window per IP (10 req/min) and per player (3 req/min)
- [ ] Return structured error responses for validation failures
- [ ] Update `PromptSubmissionCreate` schema with optional `email` and `form_response_id`

---

## BE-2: LLM Provider Abstraction Layer

- [ ] Define `LLMProvider` Protocol:
  ```python
  class LLMProvider(Protocol):
      async def generate_bids(self, context: BidContext) -> list[PlayerBid]: ...
      async def health_check(self) -> bool: ...
      def model_info(self) -> ModelMetadata: ...
  ```
- [ ] Implement `OpenAIProvider` (GPT-4o, GPT-4o-mini)
- [ ] Implement `AnthropicProvider` (Claude Sonnet, Haiku)
- [ ] Implement `OllamaProvider` (local models — Llama, Mistral)
- [ ] `LLMProviderFactory` — creates provider instance from config
- [ ] Fallback chain: ordered list of providers, auto-switch on failure
- [ ] Token usage tracking: store per-request token counts in `llm_usage` collection
- [ ] Structured prompt templates (Jinja2 or f-string based) for bid generation
- [ ] Response parsing with validation (ensure bids are within valid range)
- [ ] Environment variables: `LLM_PROVIDER`, `LLM_MODEL`, `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_TEMPERATURE`
- [ ] Admin endpoint: `PATCH /api/admin/llm-provider` for runtime model switching

---

## BE-3: Dynamic Configuration Service

- [ ] `game_config` MongoDB collection for runtime settings
- [ ] Config schema: rounds, iterations, bid range (min/max), item themes, LLM params
- [ ] CRUD endpoints: `GET/PATCH /api/admin/config`
- [ ] Configuration versioning: store previous versions with `updated_by` and `updated_at`
- [ ] Merge strategy: env vars as defaults, DB config as overrides
- [ ] Cache config in memory with TTL (avoid DB hit per iteration)

---

## BE-4: Database Schema Hardening

- [ ] Add indexes: `prompts.player_id`, `prompts.status`, `player_bids.session_id`, `game_events.session_id+timestamp`
- [ ] Replace `str` status fields with `Literal["pending", "accepted", "rejected"]` in schemas
- [ ] Add `created_at` / `updated_at` to all documents (auto-set on insert/update)
- [ ] Unique index on `prompts.form_response_id` (sparse, for idempotency)
- [ ] Index on `player_bids.created_at` for time-series queries
- [ ] Startup script to ensure indexes exist (idempotent `create_index`)

---

## BE-5: WebSocket Gateway

- [ ] `WebSocket /ws/game/{session_id}` endpoint
- [ ] `ConnectionManager` class: join/leave room, broadcast to session
- [ ] Event types:
  - `game_started` — session transitions to running
  - `round_started` — new round begins, item revealed
  - `bid_placed` — individual bid result
  - `round_ended` — round winner announced
  - `game_completed` — final results
- [ ] Heartbeat: server sends ping every 30s, disconnect on missed pong
- [ ] Event buffer: store last 50 events per session for reconnection replay
- [ ] Authentication: optional token in WebSocket handshake query param
- [ ] Broadcast from game engine: emit events as game state changes

---

## BE-6: Enhanced Game Engine

- [ ] Game modes enum: `classic`, `blitz`, `elimination`
  - Classic: fixed rounds, all players participate every round
  - Blitz: time-limited (X seconds per round), faster iterations
  - Elimination: lowest bidder eliminated each round
- [ ] Player budget system:
  - Starting balance (configurable)
  - Deduct bid amount on placement
  - Refund on loss, deduct on win (pay what you bid)
  - Track balance in `player_budgets` collection
- [ ] Item generation via LLM:
  - Generate unique item name + description + rarity tier
  - Rarity tiers: Common, Rare, Epic, Legendary (affects scoring)
  - Item categories: Art, Technology, Magic, Nature, etc.
- [ ] Bid validation:
  - Cannot exceed remaining budget
  - Must be within configured min/max range
  - Cannot bid on same item twice
- [ ] Round resolution:
  - Highest unique bid wins (or highest bid, configurable)
  - Tie-breaking rules (first submitted wins)
- [ ] Anti-collusion: flag if multiple players consistently bid same amounts

---

## BE-7: Event Sourcing

- [ ] `game_events` collection (append-only)
- [ ] Event schema:
  ```python
  {
    "session_id": str,
    "round": int,
    "iteration": int,
    "event_type": str,
    "payload": dict,
    "timestamp": datetime,
    "sequence_number": int  # monotonic per session
  }
  ```
- [ ] Write events from game engine at each state transition
- [ ] Replay endpoint: `GET /api/game-sessions/{id}/events?from_seq=N`
- [ ] Aggregate queries for analytics (wins per player, bid averages)

---

## BE-8: Analytics Service

- [ ] Per-player stats endpoint: `GET /api/players/{id}/stats`
  - Win rate, total wins, average bid, ROI, items won by category
- [ ] Per-session analytics: `GET /api/game-sessions/{id}/analytics`
  - Total bids placed, unique bidders, most contested item, highest bid
- [ ] Global leaderboard: `GET /api/leaderboard`
  - ELO-style rating (win = +K, loss = -K, adjusted by opponent strength)
  - Sortable by: rating, wins, win_rate
- [ ] Export: `GET /api/game-sessions/{id}/export?format=csv`

---

## BE-9: Prompt Analysis

- [ ] Prompt quality scoring via LLM (on submission or on-demand)
  - Dimensions: creativity, specificity, strategic depth
  - Score 1-10 per dimension, stored in `prompts` document
- [ ] Similarity detection: cosine similarity of prompt embeddings
  - Flag prompts with >0.9 similarity to existing ones
  - Store embeddings in `prompt_embeddings` collection
- [ ] Best prompts showcase: `GET /api/prompts/showcase` (anonymized, top-scoring)

---

## BE-10: Authentication & Authorization

- [ ] JWT token issuance: `POST /api/auth/login` (Google OAuth2 code exchange)
- [ ] Token validation middleware (FastAPI dependency)
- [ ] Roles: `spectator` (default), `player` (verified email), `admin` (manual assignment)
- [ ] Protect admin endpoints: `/api/admin/*`, `PATCH /api/prompts/{id}/status`
- [ ] API key system for external integrations: `X-API-Key` header
- [ ] Refresh token rotation

---

## BE-11: Caching Layer

- [ ] Redis integration (optional — graceful fallback to in-memory dict)
- [ ] Cache targets: leaderboard (TTL 60s), config (TTL 300s), session state (TTL 10s)
- [ ] Rate limiter backing store (Redis or in-memory)
- [ ] Cache invalidation on write operations

---

## BE-12: Testing Suite

- [ ] Unit tests (pytest):
  - Schema validation (valid/invalid payloads)
  - LLM provider mock responses
  - Game engine state transitions
  - Config merging logic
- [ ] Integration tests (pytest-asyncio + httpx):
  - Full endpoint lifecycle (create → read → update)
  - Webhook flow (submit → review → accept)
  - Game session flow (create → start → iterate → complete)
  - WebSocket connection and event receipt
- [ ] Fixtures: test MongoDB (mongomock or testcontainers)
- [ ] Load tests (Locust): simulate 50 concurrent players, measure P95 latency

---

## BE-13: CI/CD Pipeline

- [ ] GitHub Actions workflow:
  - Trigger on PR to `main`
  - Steps: lint (ruff), type check (mypy), test (pytest with MongoDB service)
  - Build Docker image on merge to `main`
  - Push to container registry (GHCR)
- [ ] Staging deployment (Docker Compose on VPS or Railway)
- [ ] Environment-specific configs (`.env.staging`, `.env.production`)

---

## BE-14: Observability

- [ ] Structured logging: `structlog` with JSON output
- [ ] Correlation ID middleware (inject UUID per request, propagate to logs)
- [ ] Enhanced health endpoint: `GET /api/health` returns `{ mongo: "ok", llm: "ok", engine: "running" }`
- [ ] Prometheus metrics endpoint (`/metrics`):
  - `http_requests_total` (by method, path, status)
  - `game_engine_iterations_total`
  - `llm_tokens_used_total` (by provider)
  - `websocket_connections_active`
- [ ] OpenTelemetry tracing (optional): trace request → DB → LLM → response

---

## BE-15: Security Hardening

- [ ] CORS: restrict `Access-Control-Allow-Origin` to frontend domain in production
- [ ] Request size limits (1MB max body)
- [ ] Input validation audit: ensure all user strings are bounded length
- [ ] Webhook secret rotation support (accept old + new during transition)
- [ ] Docker: run as non-root user, read-only filesystem where possible
- [ ] Dependency scanning (pip-audit in CI)
