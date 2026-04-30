# PromptAuction — Development Plan

## Vision

PromptAuction is a competitive AI auction game where players craft strategic prompts that guide LLM agents to bid on unique items. The game combines prompt engineering skill with auction theory, creating an engaging spectator experience and a showcase of modern full-stack + AI engineering.

> **Detailed sub-plans:**
> - Backend: [`backend/DEVELOPMENT_PLAN.md`](backend/DEVELOPMENT_PLAN.md)
> - Frontend: [`frontend/DEVELOPMENT_PLAN.md`](frontend/DEVELOPMENT_PLAN.md)

---

## Phase 1: Core Infrastructure & Google Forms Integration

### Backend → [backend/DEVELOPMENT_PLAN.md](backend/DEVELOPMENT_PLAN.md)
- BE-1: Google Forms Webhook Integration
- BE-2: LLM Provider Abstraction Layer
- BE-3: Dynamic Configuration Service
- BE-4: Database Schema Hardening

### Frontend → [frontend/DEVELOPMENT_PLAN.md](frontend/DEVELOPMENT_PLAN.md)
- FE-1: Route Separation & Navigation
- FE-2: Google Forms Integration
- FE-3: Game Viewer (Spectator Mode)

---

## Phase 2: Real-Time Engine & WebSocket

### Backend
- BE-5: WebSocket Gateway
- BE-6: Enhanced Game Engine
- BE-7: Event Sourcing

### Frontend
- FE-4: WebSocket Integration
- FE-5: Animated Auction UI
- FE-6: Admin Panel — Prompt Review
- FE-7: Admin Panel — Game Configuration

---

## Phase 3: Analytics, Leaderboard & Polish

### Backend
- BE-8: Analytics Service
- BE-9: Prompt Analysis
- BE-10: Authentication & Authorization
- BE-11: Caching Layer

### Frontend
- FE-8: Leaderboard & Statistics
- FE-9: Game Replay Mode
- FE-10: Authentication UI
- FE-11: Error Handling & UX
- FE-12: Responsive Design & Accessibility

---

## Phase 4: DevOps, Testing & Production Readiness

### Backend
- BE-12: Testing Suite
- BE-13: CI/CD Pipeline
- BE-14: Observability
- BE-15: Security Hardening

### Frontend
- FE-13: Testing
- FE-14: Build & Deploy

---

## Phase 5: Advanced Features (Stretch Goals)

### Backend & Frontend
- [ ] **Multi-Language Prompt Support** — players can submit prompts in any language, LLM translates internally
- [ ] **Tournament Mode** — bracket-style elimination across multiple sessions
- [ ] **Prompt Marketplace** — players can trade/sell proven prompts (in-game currency)
- [ ] **AI Commentator** — LLM generates live play-by-play commentary of the auction (BE-9 extension + FE-15)
- [ ] **Spectator Voting** — audience can vote on "best bid" for bonus points
- [ ] **Plugin System** — custom item generators, scoring rules, bid strategies as plugins
- [ ] **API SDK** — published npm/pip package for programmatic game interaction
- [ ] **Twitch/Discord Integration** — stream overlay, bot commands for live audience interaction

---

## LLM Provider Architecture

```text
┌─────────────────────────────────────────────────┐
│                 Game Engine                       │
│         game_engine.py → generate_bids()         │
└─────────────────────┬───────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────┐
│              LLM Service Layer                    │
│  ┌───────────────────────────────────────────┐  │
│  │         LLMProvider (Protocol)             │  │
│  │  - generate_bids(context) → list[Bid]     │  │
│  │  - health_check() → bool                  │  │
│  │  - model_info() → ModelMetadata           │  │
│  └───────────────────────────────────────────┘  │
│                      │                           │
│       ┌──────────────┼──────────────┐           │
│       ▼              ▼              ▼           │
│  ┌─────────┐  ┌───────────┐  ┌──────────┐     │
│  │ OpenAI  │  │ Anthropic │  │  Ollama   │     │
│  │Provider │  │ Provider  │  │ Provider  │     │
│  └─────────┘  └───────────┘  └──────────┘     │
│                                                  │
│  Factory: LLMProviderFactory.create(config)      │
│  Hot-swap: PATCH /api/admin/llm-provider         │
└─────────────────────────────────────────────────┘
```

### Switching Models

```python
# Environment-based (startup)
LLM_PROVIDER=openai          # or: anthropic, ollama
LLM_MODEL=gpt-4o             # provider-specific model name
LLM_API_KEY=sk-...           # provider API key
LLM_BASE_URL=                # optional: custom endpoint (Ollama, Azure)

# Runtime switch (admin API)
PATCH /api/admin/llm-provider
{
  "provider": "anthropic",
  "model": "claude-sonnet-4-20250514",
  "temperature": 0.7
}
```

---

## Google Forms Integration Flow

```text
┌──────────────┐     ┌─────────────────┐     ┌──────────────────┐
│ Google Form  │────▶│  Apps Script     │────▶│ POST /api/prompts│
│ (Player fills│     │  (onFormSubmit)  │     │    /webhook      │
│  out prompt) │     │  sends HTTP POST │     │                  │
└──────────────┘     └─────────────────┘     └────────┬─────────┘
                                                       │
                                                       ▼
                                              ┌──────────────────┐
                                              │  MongoDB: prompts │
                                              │  status: pending  │
                                              └────────┬─────────┘
                                                       │
                                                       ▼
                                              ┌──────────────────┐
                                              │  Admin Panel      │
                                              │  Review & Accept  │
                                              └──────────────────┘
```

### Google Apps Script (Webhook Sender)

```javascript
function onFormSubmit(e) {
  const response = e.response;
  const items = response.getItemResponses();
  
  const payload = {
    player_id: items[0].getResponse(),    // Player name/ID
    email: items[1].getResponse(),         // Email
    prompt_text: items[2].getResponse(),   // Strategy prompt
    form_response_id: response.getId()     // Idempotency key
  };

  UrlFetchApp.fetch('https://your-api.com/api/prompts/webhook', {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload)
  });
}
```

---

## Priority Matrix

| Feature                        | Impact | Effort | Priority |
|--------------------------------|--------|--------|----------|
| LLM Provider Abstraction       | High   | Medium | P0       |
| Google Forms Webhook           | High   | Low    | P0       |
| WebSocket Real-Time Updates    | High   | Medium | P0       |
| Admin Panel (Config + Review)  | High   | Medium | P0       |
| Game Viewer (Spectator Mode)   | High   | Medium | P1       |
| Authentication (JWT + OAuth)   | Medium | Medium | P1       |
| Analytics & Leaderboard        | Medium | Medium | P1       |
| Event Sourcing                 | Medium | Low    | P1       |
| Testing Suite                  | High   | High   | P2       |
| CI/CD Pipeline                 | Medium | Medium | P2       |
| Game Replay                    | Medium | High   | P2       |
| AI Commentator                 | High   | Medium | P3       |
| Tournament Mode                | Medium | High   | P3       |
| Twitch/Discord Integration     | Medium | High   | P3       |

---

## Technical Decisions

| Decision                  | Choice                          | Rationale                                      |
|---------------------------|---------------------------------|------------------------------------------------|
| Real-time transport       | WebSocket (native FastAPI)      | Low latency, bidirectional, built-in support   |
| LLM abstraction           | Protocol + Factory pattern      | Easy to add providers, testable with mocks     |
| State management (FE)     | TanStack Query + WebSocket      | Cache + real-time hybrid, minimal boilerplate  |
| Auth                      | JWT + Google OAuth2             | Ties to Google Forms identity, industry std    |
| Game event storage        | Event sourcing (append-only)    | Replay, audit, analytics from single source    |
| Caching                   | Redis (optional, in-memory fallback) | Production-ready but dev-friendly        |
| Testing                   | pytest + Vitest + Playwright    | Full pyramid: unit → integration → E2E        |
| Deployment                | Docker + GitHub Actions         | Reproducible builds, automated pipeline        |

---

## Milestones

| Milestone | Deliverable                                         | Requires (BE + FE)                |
|-----------|-----------------------------------------------------|-----------------------------------|
| M1        | Google Forms → Webhook → Admin Review working       | BE-1, BE-4, FE-1, FE-2, FE-6     |
| M2        | LLM abstraction + working game loop                 | BE-2, BE-3, BE-6                  |
| M3        | WebSocket + live game viewer                         | BE-5, BE-7, FE-3, FE-4, FE-5     |
| M4        | Admin panel: full config, prompt review, controls    | FE-6, FE-7, BE-3                  |
| M5        | Analytics, leaderboard, player profiles              | BE-8, BE-9, FE-8, FE-9           |
| M6        | Auth, testing, CI/CD, production deployment          | BE-10–BE-15, FE-10, FE-13, FE-14 |
| M7        | Advanced features (replay, commentator, tournament)  | Phase 5 items, FE-15             |
