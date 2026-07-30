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
    ├── BidLadder.tsx            # Sealed-bid reveal on a value axis
    ├── LiveIndicator.tsx        # Engine heartbeat
    ├── ActionArena.tsx          # Current lot + BidLadder
    ├── AdminPanel.tsx           # Prompt review queue (accept/reject)
    ├── BiddingHistoryTable.tsx  # Bidding history
    ├── DarkModeToggle.tsx       # Dark/light mode toggle
    ├── LeaderboardInventory.tsx # Ranked agents + lots held
    ├── LiveGameStateView.tsx    # Engine state
    ├── PlayerInventories.tsx    # Per-player inventories
    └── StatusHeader.tsx         # Round/iteration/lot/hammer strip
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
- `useUpdatePromptStatus()` — prompt status mutation + cache invalidation
- `useGameSessions()` — list game sessions (with fallback)

**Important:** Hooks have built-in fallback to mock data when the API is unavailable — this allows frontend development without a running backend.

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
- Displays pending prompts
- Accept/Reject buttons call `useUpdatePromptStatus()`
- Placeholder "Initialize Game" button

### `ActionArena.tsx`
- Props: `currentItem: string`, `liveBids: { player: string, bid: number }[]`
- Displays current item + live bids list

### `StatusHeader.tsx`
- Props: `round`, `totalRounds`, `iteration`, `totalIterations`
- Alert showing current round info

### `LiveGameStateView.tsx`
- Props: `state`, `item`
- Card with game status

## Docker Build

Multi-stage Dockerfile:
1. **Stage 1** (node:20-alpine): `npm ci` + `npm run build`
2. **Stage 2** (nginx:1.29-alpine): serves `dist/` on port 80

In docker-compose the frontend is accessible on port **5173** (mapping 5173:80).

## Pending Work

1. **WebSocket integration** — live updates from game engine (replace polling)
2. **Real data** — leaderboard, inventories and bidding history are still
   hardcoded mocks; `BidLadder` needs a real sealed/revealed flag from the engine
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
