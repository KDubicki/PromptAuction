# PromptAuction Frontend — Frontend Engineer Guide

## Description

The PromptAuction frontend is a Single Page Application (SPA) — a dashboard for managing an AI auction game. It displays live game status, an admin panel for prompt management, and bidding history.

## Tech Stack

| Library              | Version | Role                                   |
|----------------------|---------|----------------------------------------|
| React                | 19.x   | UI framework                           |
| TypeScript           | 6.x    | Static typing                          |
| Vite                 | 8.x    | Build tool + dev server                |
| MUI (Material UI)    | 9.x    | Component library + theming            |
| @emotion/react       | 11.x   | CSS-in-JS (required by MUI)            |
| TanStack React Query | 5.x    | Async state management, caching        |
| Axios                | 1.x    | HTTP client                            |
| ESLint               | 9.x    | Linting (flat config)                  |

## Getting Started

```bash
cd frontend
npm ci
npm run dev          # dev server at http://localhost:5173
npm run build        # production build → dist/
npm run preview      # preview production build
npm run lint         # ESLint
```

## Environment Variables

File `frontend/.env` (optional):

```env
VITE_API_BASE_URL=http://localhost:8000/api
```

By default the API client points to `http://localhost:8000/api`.

## Directory Structure

```text
frontend/src/
├── main.tsx                    # Entry point, renders <App />
├── App.tsx                     # QueryClientProvider + RouterProvider
├── router.tsx                  # Route table (createBrowserRouter)
├── index.css                   # Font imports + reset
├── types.ts                    # Shared TypeScript types
├── liveGame.ts                 # Session picking, call descriptions for the live view
├── replay.ts                   # Round states, roster at a lot, agent diary for replays
├── api/
│   ├── client.ts               # Axios instance configuration
│   └── hooks.ts                # React Query hooks
├── theme/
│   ├── tokens.ts               # Palette, type faces, radii
│   ├── index.ts                # buildTheme(mode) — MUI theme + overrides
│   └── useColorMode.ts         # OS-following mode with persisted override
├── layouts/
│   └── RootLayout.tsx          # App bar + responsive drawer nav
├── pages/                      # One per route
└── components/
    ├── Panel.tsx                # Shared surface: title, mono slug, action
    ├── Figure.tsx               # Labelled mono figure
    ├── DataTable.tsx            # Table that stacks into cards below `sm`
    ├── LiveIndicator.tsx        # Engine heartbeat (live while any session runs)
    ├── live/                    # Live game page: Rostrum (live lot + sold stamp), ReplayStage (round chart + playback),
    │                            #   LotStrip (lot navigator), AgentSeats (follow an agent), AgentDiary (one agent's calls
    │                            #   lot by lot), RoomTranscript, LotBoard, WinnerStage
    ├── AdminPanel.tsx           # Admin page: sessions, roster, players, review queue, form source
    ├── SessionsPanel.tsx        # Create/list game sessions, pick the selected one
    ├── SessionRoster.tsx        # Roster of the selected session: add/remove players, start
    ├── SessionStandings.tsx     # Standings table (rank, required items, quality, budget) under the roster
    ├── SessionSettingsFields.tsx + sessionSettings.ts # Budget / Items / Rounds-per-item inputs shared by create and pending-session edit
    ├── PlayersPanel.tsx         # Players with prompt versions: create, edit, history, delete
    ├── GoogleFormSourcePanel.tsx # Connect the Google Form players submit through
    └── DarkModeToggle.tsx       # Dark/light mode toggle
```

## Application Architecture

### API Layer (`src/api/`)

**`client.ts`** — Axios instance singleton:
```typescript
export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api',
  timeout: 5000,
})
```

**`hooks.ts`** — React Query hooks:
- `usePrompts(statusFilter?)` — list prompts (with mock data fallback)
- `useUpdatePromptStatus()` — prompt status mutation; invalidates `prompts`, `players` and `game-sessions`
- `useGameSessions()` — list game sessions (no fallback; errors surface in `SessionsPanel`)

**Important:** `usePrompts` falls back to mock data when the API is unavailable. `useGameSessions` does not: a fake session would invite Start/Add calls that fail.

### Types Layer (`src/types.ts`)

```typescript
type PromptStatus = 'pending' | 'accepted' | 'rejected'

interface PromptSubmission {
  id: string; player_id: string; prompt_text: string; status: PromptStatus
}

interface PlayerBid {
  player_id: string; item_name: string; bid_amount: number; won: boolean
}

interface GameSession {
  id: string; name: string; status: string; current_round: number; current_iteration: number
}

interface LeaderboardEntry {
  playerId: string; winRate: number; items: string[]
}
```

### Theming

Tokens live in `src/theme/tokens.ts`; `buildTheme(mode)` in `src/theme/index.ts`
turns them into the MUI theme, including component overrides. `RootLayout`
builds the theme and provides it.

```typescript
const { mode, toggle } = useColorMode()
const theme = useMemo(() => buildTheme(mode), [mode])
```

Conventions worth keeping:

- **Brass (`primary`) means "won".** Hammer price, winning bid, rank 01, the
  active nav rail. Nothing decorative uses it.
- **Every figure is mono and tabular.** Use `Figure`, `caption`/`overline`
  variants, or `DataTable`'s `figure: true` so numbers align down a column.
- **Fonts are bundled** via `@fontsource` imports in `index.css` — no CDN, so
  the container works offline. Adding a weight means adding an import.
- **Contrast**: text tokens are chosen to clear 4.5:1 against `rostrum` in both
  modes. Re-check if you change them.
- **Tables use `DataTable`**, which stacks into labelled cards below `sm`.
  Do not add a raw `<Table>` that scrolls horizontally on a phone.
- **Labels are sentence case.** `overline` is mono but not uppercased; a
  panel's count or position goes in `Panel`'s `slug`, in the header's right
  corner, never as an eyebrow above the title.

`useColorMode` follows `prefers-color-scheme` and only persists an explicit
toggle, so the app keeps tracking the OS until the operator overrides it.

## Coding Conventions

### Code Style
- Functional components (no class components)
- Named exports for components
- Custom hooks in `src/api/hooks.ts`
- No default exports (except Vite config)
- Destructured props in parameters

### Naming
- Components: PascalCase (`ActionArena.tsx`)
- Hooks: camelCase with `use` prefix (`usePrompts`)
- Types/interfaces: PascalCase (`GameSession`)
- Component files: PascalCase
- Utility files: camelCase

### ESLint
Flat config (`eslint.config.js`):
- `@eslint/js` recommended
- `typescript-eslint` recommended
- `react-hooks` flat recommended
- `react-refresh` Vite rules
- Ignored directory: `dist/`

## Components — Details

### `App.tsx`
- Root component wrapped in `QueryClientProvider` and `ThemeProvider`
- Tabs: "Live Dashboard" and "Admin Panel"
- "Enable/Disable Admin" button (auth placeholder)
- Grid layout with MUI Grid v2 (`size` prop)

### `AdminPanel.tsx`
- Order: `SessionsPanel`, `SessionRoster` for the selected session (newest pending, else newest), `PlayersPanel`, review queue, `GoogleFormSourcePanel`
- Review queue rows: player, version/source meta line, prompt, optional email-mismatch warning, Accept/Reject calling `useUpdatePromptStatus()`

### Live game (`pages/GamePage.tsx`)
- Shows a running session live, or replays a finished one. URL params: `session`, `lot`, `agent`
- `lot` picks a closed lot to replay (round scrubber + Play through the game); the live lot shows `Rostrum`
- `agent` follows one agent: its calls stand out and `AgentDiary` lists everything it answered

## Docker Build

Multi-stage Dockerfile:
1. **Stage 1** (node:20-alpine): `npm ci` + `npm run build`
2. **Stage 2** (nginx:1.29-alpine): serves `dist/` on port 80

In docker-compose the frontend is accessible on port **5173** (mapping 5173:80).

## Pending Work

1. **WebSocket integration** — live updates from game engine (replace polling)
2. **Real data** — the Leaderboard page is still a hardcoded mock
3. **Authentication** — protect Admin Panel
4. **SPA fallback** — nginx 404s on deep links (`/admin` etc.); the image needs
   `try_files $uri $uri/ /index.html;`
5. **Error boundaries** — component-level error handling
7. **Storybook** — isolated component development (optional)

## Backend Interaction

The frontend communicates with the backend via REST API:

| Hook                     | Endpoint                       | Method  |
|--------------------------|--------------------------------|---------|
| `usePrompts()`           | `GET /api/prompts`             | GET     |
| `useUpdatePromptStatus()`| `PATCH /api/prompts/{id}/status`| PATCH  |
| `useGameSessions()`      | `GET /api/game-sessions`       | GET     |

### Development Without Backend

Hooks have built-in fallback to mock data — the frontend works standalone without the API. Just run `npm run dev`.

## Useful Commands

```bash
# New component
touch src/components/MyComponent.tsx

# Add dependency
npm install <package>

# Type check (without building)
npx tsc --noEmit

# Production build
npm run build

# Preview build
npm run preview
```
