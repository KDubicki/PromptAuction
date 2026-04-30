# PromptAuction Monorepo

PromptAuction is an AI-driven auction game where players submit strategic prompts and blindly bid on unique items. This monorepo contains both the frontend dashboard and backend API, plus local infrastructure for development.

## Project Structure

```text
/home/runner/work/PromptAuction/PromptAuction
├── frontend/                # React + Vite + TypeScript + MUI dashboard
├── backend/                 # FastAPI + Motor + Pydantic backend
└── docker-compose.yml       # Frontend + Backend + MongoDB orchestration
```

## Backend (`/backend`)

### Stack
- Python 3.11+
- FastAPI
- Pydantic Settings (`BaseSettings`) for environment-driven config
- Motor (async MongoDB client)

### Key Design
- RESTful routers:
  - `/api/users` CRUD
  - `/api/game-sessions` CRUD
  - `/api/prompts/webhook` for prompt submissions (Google Forms-style webhook)
  - `/api/prompts` list + status updates (`accepted`/`rejected`/`pending`)
- Service layer:
  - `app/services/game_engine.py` asynchronous game loop placeholder
  - `app/services/llm_service.py` LLM integration placeholder
- MongoDB collections used:
  - `users`
  - `game_sessions`
  - `prompts`
  - `player_bids`

### Environment Configuration
Copy `backend/.env.example` to `backend/.env` and set values:

```env
APP_NAME=PromptAuction API
MONGODB_URL=mongodb://mongo:27017
MONGODB_DB_NAME=promptauction
GAME_ROUNDS=50
GAME_ITERATIONS_PER_ROUND=45
GAME_ENGINE_SLEEP_SECONDS=1
```

> `GAME_ROUNDS` and `GAME_ITERATIONS_PER_ROUND` are strictly environment-driven and loaded via `BaseSettings` in `app/core/config.py`.

### Sample Data Models
- `GameSession`: name, status, accepted prompt IDs, current round/iteration
- `PlayerBid`: player ID, item name, bid amount, won flag

## Frontend (`/frontend`)

### Stack
- Vite + React + TypeScript
- Material UI (MUI)
- Axios + React Query for API/data access

### Views & Components
- Dark mode toggle
- Live Game Dashboard:
  - Status header (`Round x/y, Iteration x/y`)
  - Action Arena (current item + live LLM bid feed placeholder)
  - Leaderboard & Inventory
  - Player inventories
  - Bidding history table
- Protected Admin Panel:
  - List pending prompts
  - Accept/reject prompt actions
  - Placeholder initialize game button

Set optional frontend API URL via `.env`:

```env
VITE_API_BASE_URL=http://localhost:8000/api
```

## Run the Full Stack with Podman

### 1. Install Podman

On macOS, install Podman and the compose helper:

```bash
brew install podman podman-compose
```

### 2. Start the Podman machine

Podman on macOS runs containers inside a Linux VM:

```bash
podman machine init --now
```

If the machine already exists, start it with:

```bash
podman machine start
```

### 3. Start the app

From repo root:

```bash
podman compose up --build
```

If your Podman installation does not support `podman compose`, use:

```bash
podman-compose up --build
```

### 4. Open the app

Services:
- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:8000/api`
- MongoDB: `mongodb://localhost:27017`

To stop everything:

```bash
podman compose down
```

## Local Development (Without Docker)

### Backend
```bash
cd /home/runner/work/PromptAuction/PromptAuction/backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload
```

### Frontend
```bash
cd /home/runner/work/PromptAuction/PromptAuction/frontend
npm install
npm run dev
```

## Container Files
- `backend/Dockerfile` + `backend/.dockerignore`
- `frontend/Dockerfile` + `frontend/.dockerignore`
- Root `docker-compose.yml`
