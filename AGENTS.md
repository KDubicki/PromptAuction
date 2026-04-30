# PromptAuction — Software Engineer Guide

## Project Description

PromptAuction is an AI-driven auction game where players submit strategic prompts and blindly bid on unique items. The project is a monorepo containing a frontend (React dashboard) and backend (FastAPI API) with a MongoDB database.

## Architecture

```text
PromptAuction/
├── frontend/          # React + Vite + TypeScript + MUI
├── backend/           # FastAPI + Motor (async MongoDB) + Pydantic
├── docker-compose.yml # Orchestration: Frontend + Backend + MongoDB
└── AGENTS.md          # This file
```

### Data Flow

```
[Player] → Google Forms/Webhook → POST /api/prompts/webhook
                                        ↓
                              MongoDB (collection: prompts)
                                        ↓
                    Admin Panel → PATCH /api/prompts/{id}/status (accept/reject)
                                        ↓
                              Game Engine (asyncio task)
                                        ↓
                         LLM Service → generates player bids
                                        ↓
                              MongoDB (collection: player_bids)
                                        ↓
                    Frontend Dashboard ← GET /api/game-sessions
```

## Tech Stack

| Layer       | Technologies                                             |
|-------------|----------------------------------------------------------|
| Frontend    | Vite 8, React 19, TypeScript 6, MUI 9, TanStack Query 5, Axios |
| Backend     | Python 3.11+, FastAPI, Pydantic Settings, Motor 3.7, Uvicorn |
| Database    | MongoDB 7                                                |
| Containers  | Docker / Podman + docker-compose                         |

## Local Setup

### Requirements

- Docker/Podman + Compose
- Node.js 20+ (for frontend development)
- Python 3.11+ (for backend development)

### Full stack (docker-compose)

```bash
# Podman
podman-compose up --build

# Docker
docker compose up --build
```

**Ports:**
- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- MongoDB: localhost:27017

### Backend only (development)

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # edit if needed
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend only (development)

```bash
cd frontend
npm ci
npm run dev
```

Frontend dev server: http://localhost:5173

## Environment Variables

### Backend (`backend/.env`)

| Variable                      | Default                    | Description                             |
|-------------------------------|----------------------------|-----------------------------------------|
| `APP_NAME`                    | PromptAuction API          | App name (Swagger title)                |
| `MONGODB_URL`                 | mongodb://localhost:27017  | MongoDB connection string               |
| `MONGODB_DB_NAME`             | promptauction              | Database name                           |
| `GAME_ROUNDS`                 | 50                         | Number of rounds per game session       |
| `GAME_ITERATIONS_PER_ROUND`   | 45                         | Number of iterations per round          |
| `GAME_ENGINE_SLEEP_SECONDS`   | 1                          | Game engine loop interval (seconds)     |

### Frontend (`frontend/.env`)

| Variable             | Default                        | Description         |
|----------------------|--------------------------------|---------------------|
| `VITE_API_BASE_URL`  | http://localhost:8000/api      | Base API URL        |

## API Endpoints

| Method  | Endpoint                        | Description                       |
|---------|----------------------------------|-----------------------------------|
| GET     | `/api/health`                   | Health check                      |
| POST    | `/api/users`                    | Create user                       |
| GET     | `/api/users`                    | List users                        |
| GET     | `/api/users/{id}`               | Get user                          |
| PATCH   | `/api/users/{id}`               | Update user                       |
| POST    | `/api/game-sessions`            | Create game session               |
| GET     | `/api/game-sessions`            | List game sessions                |
| GET     | `/api/game-sessions/{id}`       | Get game session                  |
| PATCH   | `/api/game-sessions/{id}`       | Update game session               |
| POST    | `/api/prompts/webhook`          | Webhook – submit prompt           |
| GET     | `/api/prompts`                  | List prompts (filter by status)   |
| PATCH   | `/api/prompts/{id}/status`      | Update prompt status              |

## MongoDB Collections

| Collection      | Description                                       |
|-----------------|---------------------------------------------------|
| `users`         | Player data (username, email)                     |
| `game_sessions` | Game sessions (status, round, iteration, prompts) |
| `prompts`       | Submitted prompts (player_id, text, status)       |
| `player_bids`   | Bid history (player_id, item, amount, won)        |

## Code Structure — Key Files

### Backend

| Path                                  | Role                                           |
|---------------------------------------|------------------------------------------------|
| `backend/app/main.py`                 | Entry point, lifespan, routing                 |
| `backend/app/core/config.py`          | Pydantic Settings (env-driven config)          |
| `backend/app/db/mongo.py`             | MongoManager – connect/disconnect              |
| `backend/app/routers/users.py`        | Users CRUD                                     |
| `backend/app/routers/game_sessions.py`| Game sessions CRUD                             |
| `backend/app/routers/prompts.py`      | Webhook + prompt management                    |
| `backend/app/schemas/`                | Pydantic models (request/response)             |
| `backend/app/services/game_engine.py` | Async game engine (asyncio task)               |
| `backend/app/services/llm_service.py` | LLM integration placeholder                   |

### Frontend

| Path                                      | Role                                       |
|-------------------------------------------|--------------------------------------------|
| `frontend/src/App.tsx`                    | Main layout, tab routing, theming          |
| `frontend/src/api/client.ts`             | Axios configuration                        |
| `frontend/src/api/hooks.ts`              | React Query hooks (prompts, sessions)      |
| `frontend/src/types.ts`                  | TypeScript types                           |
| `frontend/src/components/AdminPanel.tsx`  | Admin panel (accept/reject prompts)        |
| `frontend/src/components/ActionArena.tsx` | Auction arena (live bids)                  |
| `frontend/src/components/StatusHeader.tsx`| Round/iteration header                     |

## Coding Conventions

### General
- Code and comments in English
- Variable naming: snake_case (Python), camelCase (TypeScript)
- No inline comments unless logic is non-obvious
- Every endpoint has type-hinted return + response_model

### Git Workflow
- Branch naming: `feat/`, `fix/`, `refactor/`, `docs/`
- Commit messages in English, conventional commits convention

## Pending Implementation (Placeholders)

1. **LLM Service** (`backend/app/services/llm_service.py`) – real LLM API integration
2. **Authentication** – no auth; admin panel is unprotected
3. **WebSocket** – live updates from game engine to frontend
4. **Tests** – no unit/integration tests
5. **CI/CD** – no pipeline

## Swagger / OpenAPI

After starting the backend, API documentation is available at:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc
