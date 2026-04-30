# PromptAuction Backend — Backend Engineer Guide

## Description

The PromptAuction backend is an asynchronous REST API built with FastAPI. It handles user management, game sessions, prompts, and includes a game engine running as a background task with LLM integration.

## Tech Stack

| Library           | Version | Role                                         |
|-------------------|---------|----------------------------------------------|
| FastAPI           | 0.136   | Web framework (async, OpenAPI auto-docs)     |
| Uvicorn           | 0.45    | ASGI server                                  |
| Pydantic Settings | 2.14    | Configuration from env vars                  |
| Motor             | 3.7     | Async MongoDB driver (PyMongo wrapper)       |
| python-dotenv     | 1.1     | `.env` file loading                          |
| Python            | 3.11+   | Runtime                                      |

## Getting Started

```bash
cd backend

# Create virtual environment
python -m venv .venv
source .venv/bin/activate   # macOS/Linux
# .venv\Scripts\activate    # Windows

# Install dependencies
pip install -r requirements.txt

# Configure .env
cp .env.example .env
# Edit .env if needed (e.g., change MONGODB_URL)

# Run server (with hot-reload)
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Required:** MongoDB must be accessible (default: `localhost:27017`).

Quick MongoDB start:
```bash
# Docker/Podman
docker run -d --name mongo -p 27017:27017 mongo:7
```

## Environment Variables

File `backend/.env` (loaded by Pydantic Settings):

| Variable                      | Type   | Default                   | Description                   |
|-------------------------------|--------|---------------------------|-------------------------------|
| `APP_NAME`                    | str    | PromptAuction API         | App name (Swagger title)      |
| `MONGODB_URL`                 | str    | mongodb://localhost:27017 | MongoDB connection string     |
| `MONGODB_DB_NAME`             | str    | promptauction             | Database name                 |
| `GAME_ROUNDS`                 | int    | 50                        | Max rounds per session        |
| `GAME_ITERATIONS_PER_ROUND`   | int    | 45                        | Iterations per round          |
| `GAME_ENGINE_SLEEP_SECONDS`   | float  | 1.0                       | Game engine loop interval     |

Configuration is **immutable** after startup — sourced from `app/core/config.py` (singleton `settings`).

## Directory Structure

```text
backend/
├── Dockerfile
├── requirements.txt
├── .env.example
└── app/
    ├── __init__.py
    ├── main.py                  # FastAPI app, lifespan, routing
    ├── core/
    │   └── config.py            # Pydantic BaseSettings
    ├── db/
    │   └── mongo.py             # MongoManager (connect/disconnect)
    ├── models/
    │   └── game.py              # Domain models (placeholder)
    ├── routers/
    │   ├── users.py             # CRUD /api/users
    │   ├── game_sessions.py     # CRUD /api/game-sessions
    │   └── prompts.py           # Webhook + management /api/prompts
    ├── schemas/
    │   ├── common.py            # Shared Pydantic models
    │   ├── game.py              # GameSession schemas
    │   ├── prompts.py           # Prompt schemas
    │   └── users.py             # User schemas
    └── services/
        ├── game_engine.py       # Async game loop (background task)
        └── llm_service.py       # LLM integration (placeholder)
```

## Architecture

### Lifespan (main.py)

```python
@asynccontextmanager
async def lifespan(_: FastAPI):
    await mongo_manager.connect()      # Connect to MongoDB
    game_engine_service.start()         # Start background task
    yield
    await game_engine_service.stop()   # Graceful shutdown
    await mongo_manager.disconnect()
```

### Database Layer (`app/db/mongo.py`)

Singleton `MongoManager`:
- `connect()` — creates `AsyncIOMotorClient` + sets `self.db`
- `disconnect()` — closes the client
- Database access: `mongo_manager.db` (returns `AsyncIOMotorDatabase | None`)

**No ODM** — direct Motor collection operations:
```python
db = mongo_manager.db
await db.users.insert_one(doc)
await db.users.find().to_list(length=500)
await db.users.find_one({"_id": ObjectId(id)})
await db.users.update_one({"_id": ObjectId(id)}, {"$set": updates})
```

### Routers (`app/routers/`)

Each router is an `APIRouter` with prefix and tag:

#### `/api/users` (users.py)
| Method | Path              | Description     | Request Body  | Response        |
|--------|-------------------|-----------------|---------------|-----------------|
| POST   | `/api/users`      | Create user     | `UserCreate`  | `UserOut` (201) |
| GET    | `/api/users`      | List users      | —             | `list[UserOut]` |
| GET    | `/api/users/{id}` | Get user        | —             | `UserOut`       |
| PATCH  | `/api/users/{id}` | Update user     | `UserUpdate`  | `UserOut`       |

#### `/api/game-sessions` (game_sessions.py)
| Method | Path                        | Description       | Request Body         | Response              |
|--------|-----------------------------|-------------------|----------------------|-----------------------|
| POST   | `/api/game-sessions`        | Create session    | `GameSessionCreate`  | `GameSessionOut` (201)|
| GET    | `/api/game-sessions`        | List sessions     | —                    | `list[GameSessionOut]`|
| GET    | `/api/game-sessions/{id}`   | Get session       | —                    | `GameSessionOut`      |
| PATCH  | `/api/game-sessions/{id}`   | Update session    | `GameSessionUpdate`  | `GameSessionOut`      |

#### `/api/prompts` (prompts.py)
| Method | Path                          | Description        | Request Body                  | Response                    |
|--------|-------------------------------|--------------------|-------------------------------|-----------------------------|
| POST   | `/api/prompts/webhook`        | Submit prompt      | `PromptSubmissionCreate`      | `PromptSubmissionOut` (201) |
| GET    | `/api/prompts`                | List (filter)      | query: `status_filter`        | `list[PromptSubmissionOut]` |
| PATCH  | `/api/prompts/{id}/status`    | Update status      | `PromptSubmissionStatusUpdate`| `PromptSubmissionOut`       |

### Schemas (`app/schemas/`)

**Naming convention:**
- `*Create` — request body for POST
- `*Update` — request body for PATCH (optional fields)
- `*Out` — response model (includes `id: str`)

#### Users
```python
class UserCreate(BaseModel):
    username: str = Field(..., min_length=2)
    email: str

class UserOut(BaseModel):
    id: str
    username: str
    email: str
```

#### Game Sessions
```python
class GameSessionCreate(BaseModel):
    name: str

class GameSessionOut(BaseModel):
    id: str; name: str; status: str
    accepted_prompt_ids: list[str]
    current_round: int; current_iteration: int
```

#### Prompts
```python
class PromptSubmissionCreate(BaseModel):
    player_id: str
    prompt_text: str = Field(..., min_length=3)

class PromptSubmissionOut(BaseModel):
    id: str; player_id: str; prompt_text: str; status: str
```

### Game Engine (`app/services/game_engine.py`)

Asynchronous game engine running as an `asyncio.Task`:

**Loop logic:**
1. Every `GAME_ENGINE_SLEEP_SECONDS` seconds, checks for sessions with status `"running"`
2. For each active session, calls `_run_iteration()`
3. `_run_iteration()`:
   - Checks if `current_round >= GAME_ROUNDS` → sets status to `"completed"`
   - Increments iteration (or round when iteration > max)
   - Fetches accepted prompts from database
   - Generates item name: `"Unique Item R{round}-I{iteration}"`
   - Calls `llm_service.generate_bids(context=...)`
   - Saves bids to `player_bids` collection
   - Updates session's `current_round` and `current_iteration`

**Graceful shutdown:** `stop()` cancels the task and awaits `CancelledError`.

### LLM Service (`app/services/llm_service.py`)

**Placeholder** — to be implemented:
```python
class LLMService:
    async def generate_bids(self, *, context: dict) -> Sequence[dict]:
        """Placeholder for real LLM integration."""
        return [{"player_id": "placeholder-player", "bid_amount": 10.0}]
```

**Context dict passed to LLM:**
```python
{
    "accepted_prompts": [...],   # list of accepted prompts from DB
    "current_item": str,         # current item name
    "inventories": [],           # placeholder for player inventories
    "session_id": str,           # active session ID
}
```

## MongoDB Collections

| Collection      | Fields                                                     |
|-----------------|-----------------------------------------------------------|
| `users`         | `_id`, `username`, `email`                                 |
| `game_sessions` | `_id`, `name`, `status`, `accepted_prompt_ids`, `current_round`, `current_iteration` |
| `prompts`       | `_id`, `player_id`, `prompt_text`, `status`                |
| `player_bids`   | `_id`, `player_id`, `item_name`, `bid_amount`, `won`, `created_at` |

**Session statuses:** `pending` → `running` → `completed`  
**Prompt statuses:** `pending` → `accepted` / `rejected`

## Coding Conventions

### Style
- Type hints everywhere (parameters, return types)
- `response_model` on every endpoint
- `async def` for all endpoints and DB operations
- No ORM/ODM — direct Motor collection operations
- Handle `db is None` → HTTP 503
- `ObjectId` converted to `str` in responses

### Patterns
- Router → Schema validation → DB operation → Response serialization
- Singleton services (`mongo_manager`, `game_engine_service`, `llm_service`)
- Settings as singleton (`settings` from `config.py`)
- Lifespan instead of deprecated `on_event`

### New Endpoint Template
```python
@router.post("", response_model=MyOut, status_code=status.HTTP_201_CREATED)
async def create_my_resource(payload: MyCreate) -> MyOut:
    db = mongo_manager.db
    if db is None:
        raise HTTPException(status_code=503, detail="Database not connected")
    
    doc = payload.model_dump()
    result = await db.my_collection.insert_one(doc)
    return MyOut(id=str(result.inserted_id), **doc)
```

## Docker

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY app ./app
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

In docker-compose, the backend receives `.env.example` as env_file and depends on the `mongo` service.

## API Documentation (auto-generated)

After starting the server:
- **Swagger UI:** http://localhost:8000/docs
- **ReDoc:** http://localhost:8000/redoc
- **OpenAPI JSON:** http://localhost:8000/openapi.json

## Pending Work

1. **LLM Service** — real integration (OpenAI/Anthropic/local model)
2. **Authentication/Authorization** — JWT/OAuth2 for admin endpoints
3. **WebSocket** — live push game state to frontend
4. **Tests** — pytest + pytest-asyncio + httpx (AsyncClient)
5. **Migrations** — schema versioning for MongoDB (beanie/mongomock)
6. **Rate limiting** — webhook endpoint needs protection
7. **Validation** — stronger `status` validation (Literal types instead of `str`)
8. **Logging** — structured logging (structlog/loguru)
9. **Error handling** — global exception handlers

## Useful Commands

```bash
# Run with hot-reload
uvicorn app.main:app --reload --port 8000

# Check health
curl http://localhost:8000/api/health

# Create user
curl -X POST http://localhost:8000/api/users \
  -H "Content-Type: application/json" \
  -d '{"username": "player1", "email": "p1@example.com"}'

# Submit prompt
curl -X POST http://localhost:8000/api/prompts/webhook \
  -H "Content-Type: application/json" \
  -d '{"player_id": "player1", "prompt_text": "Bid high on rare items"}'

# Create session and set to running
curl -X POST http://localhost:8000/api/game-sessions \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Game"}'

curl -X PATCH http://localhost:8000/api/game-sessions/{SESSION_ID} \
  -H "Content-Type: application/json" \
  -d '{"status": "running"}'

# Add dependency
pip install <package> && pip freeze > requirements.txt
```

## Debugging

### Game Engine not working?
1. Check if session has status `"running"` (not `"pending"`)
2. Check logs — `mongo_manager.db` may be `None`
3. Check `GAME_ENGINE_SLEEP_SECONDS` — too high = slow iterations

### MongoDB connection error?
1. Verify MongoDB is running: `mongosh --eval "db.runCommand({ping:1})"`
2. Check `MONGODB_URL` in `.env`
3. In docker-compose the host is `mongo` (not `localhost`)
