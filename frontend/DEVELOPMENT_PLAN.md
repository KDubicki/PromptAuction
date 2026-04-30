# PromptAuction Frontend — Development Plan

## Overview

Frontend development plan for the PromptAuction dashboard. Each section is referenced by the main [DEVELOPMENT_PLAN.md](../DEVELOPMENT_PLAN.md) milestones.

---

## FE-1: Route Separation & Navigation

- [ ] Install React Router (`react-router-dom`)
- [ ] Define route structure:
  - `/` — Landing page (game list, join link)
  - `/game/:sessionId` — Live game viewer (spectator mode)
  - `/admin` — Protected admin panel
  - `/admin/prompts` — Prompt review queue
  - `/admin/config` — Game configuration
  - `/leaderboard` — Global leaderboard
  - `/player/:playerId` — Player profile
- [ ] Persistent layout: AppBar with navigation, dark mode toggle
- [ ] Route guards: admin routes require auth token
- [ ] 404 page for unknown routes
- [ ] Breadcrumb navigation for admin sub-pages

---

## FE-2: Google Forms Integration

- [ ] "Submit Prompt" page (`/submit`)
  - Embedded Google Form via iframe (responsive sizing)
  - Instructions panel explaining prompt strategy
  - Link to standalone Google Form (fallback)
- [ ] Post-submission status checker:
  - Input: player email or ID
  - Polls `GET /api/prompts?player_id=X` to show submission status
  - Real-time status badge: pending → accepted/rejected
- [ ] Pre-fill session ID in Google Form URL via query params

---

## FE-3: Game Viewer (Spectator Mode)

- [ ] Full-screen layout optimized for projection/streaming
- [ ] Components:
  - **ItemCard**: current item display with name, description, rarity badge, category icon
  - **BidTicker**: scrolling feed of incoming bids (WebSocket-driven)
  - **RoundProgress**: visual progress bar (round X/Y, iteration X/Y)
  - **PlayerRoster**: active players with budget remaining
  - **RoundResult**: winner announcement with animation
- [ ] Game state machine UI:
  - `waiting` — "Game starting soon..." with player count
  - `running` — full auction view
  - `paused` — overlay "Game Paused"
  - `completed` — final results summary
- [ ] Responsive: works on desktop (1080p projector) and mobile
- [ ] Optional: theater mode (hides navigation, full viewport)

---

## FE-4: WebSocket Integration

- [ ] Custom hook: `useGameSocket(sessionId)`
  - Auto-connect on mount, disconnect on unmount
  - Reconnection with exponential backoff
  - Event buffer replay on reconnect (request missed events)
  - Returns: `{ events, connectionStatus, lastEvent }`
- [ ] Connection status indicator component (green/yellow/red dot)
- [ ] Event handlers:
  - `game_started` → transition UI to running state
  - `round_started` → update item card, reset bid ticker
  - `bid_placed` → append to bid ticker with animation
  - `round_ended` → show winner, update leaderboard
  - `game_completed` → show final results overlay
- [ ] Optimistic updates: local state updates before server confirmation

---

## FE-5: Animated Auction UI

- [ ] Bid reveal animation:
  - Cards slide in from side, flip to reveal amount
  - Counter rolls up to final bid value
  - Winner card highlighted with glow effect
- [ ] Item rarity visual effects:
  - Common: neutral border
  - Rare: blue shimmer
  - Epic: purple pulse
  - Legendary: gold particle effect (CSS animation)
- [ ] Sound effects (optional, toggle in settings):
  - Bid placed: subtle click
  - Round won: victory chime
  - Game over: fanfare
- [ ] Confetti explosion on round win (canvas-confetti library)
- [ ] Smooth transitions between rounds (fade/slide)

---

## FE-6: Admin Panel — Prompt Review

- [ ] Prompt queue table with columns: player, prompt text, submitted at, status
- [ ] Bulk actions: select multiple → accept all / reject all
- [ ] Prompt detail modal: full text, player history, quality score (if available)
- [ ] Filter/sort: by status, by player, by submission date
- [ ] Search: text search within prompt content
- [ ] Keyboard shortcuts: `a` = accept, `r` = reject, `j/k` = navigate
- [ ] Accepted prompts counter (shows how many are queued for next game)

---

## FE-7: Admin Panel — Game Configuration

- [ ] Game session creator form:
  - Name, game mode (classic/blitz/elimination)
  - Rounds, iterations per round
  - Starting budget, bid range (min/max)
  - Item theme/category filter
  - LLM provider and model selection
- [ ] LLM provider selector:
  - Dropdown with available providers
  - Health status indicator per provider (green checkmark / red X)
  - Model selection (provider-specific list)
  - Temperature slider
  - "Test Provider" button (sends health check)
- [ ] Active game controls:
  - Start / Pause / Resume / Force-End buttons
  - Real-time session status display
  - Player list with kick/ban option
- [ ] Configuration presets: save/load common game configurations

---

## FE-8: Leaderboard & Statistics

- [ ] Global leaderboard page:
  - Table: rank, player name, ELO rating, wins, win rate, total earnings
  - Sorting by any column
  - Pagination or virtual scroll for large lists
- [ ] Player profile page (`/player/:id`):
  - Stats card: total games, wins, ELO, favorite categories
  - Match history: list of sessions with result (W/L) and items won
  - Win rate chart over time (line chart)
  - Bid distribution histogram
- [ ] Session history page:
  - List of past sessions with date, players, winner
  - Click to view replay or detailed results

---

## FE-9: Game Replay Mode

- [ ] Replay page (`/replay/:sessionId`):
  - Loads events from `GET /api/game-sessions/{id}/events`
  - Step-through controls: play, pause, next event, previous event
  - Playback speed: 1x, 2x, 4x, 8x
  - Timeline scrubber (click to jump to specific round)
- [ ] Reuses game viewer components (ItemCard, BidTicker, etc.)
- [ ] Highlight reel: auto-jump to key moments (biggest bid, upset wins)
- [ ] Share link: generate URL with specific timestamp

---

## FE-10: Authentication UI

- [ ] Login page with Google OAuth2 button
- [ ] Auth context provider (`useAuth` hook):
  - Stores JWT in memory (not localStorage for security)
  - Refresh token in httpOnly cookie (if supported) or localStorage
  - Auto-refresh before expiry
- [ ] Protected route wrapper: redirects to login if unauthenticated
- [ ] User menu (top-right): avatar, name, role badge, logout
- [ ] Role-based UI: hide admin nav items for non-admin users

---

## FE-11: Error Handling & UX

- [ ] Global error boundary with friendly fallback UI
- [ ] Toast notification system (MUI Snackbar):
  - Success: prompt accepted, game started
  - Error: connection lost, action failed
  - Info: new round started, player joined
- [ ] Skeleton loading states for all data-dependent components
- [ ] Empty states: "No games yet", "No prompts to review"
- [ ] Offline indicator banner: "Connection lost — retrying..."
- [ ] Optimistic UI with rollback on error

---

## FE-12: Responsive Design & Accessibility

- [ ] Mobile breakpoints for game viewer (stack layout on small screens)
- [ ] Touch-friendly bid ticker (swipe to dismiss)
- [ ] Dark/light theme persistence in localStorage
- [ ] Keyboard navigation: all interactive elements focusable
- [ ] ARIA labels for dynamic content (bid announcements as live regions)
- [ ] Reduced motion: respect `prefers-reduced-motion` (disable animations)
- [ ] Font scaling: rem-based sizing throughout

---

## FE-13: Testing

- [ ] Component tests (Vitest + React Testing Library):
  - AdminPanel: render prompts, accept/reject actions
  - GameViewer: state transitions, event handling
  - Leaderboard: sorting, pagination
- [ ] Hook tests (`renderHook`):
  - `useGameSocket`: connection lifecycle, event buffering
  - `useAuth`: token management, refresh flow
  - `usePrompts`: data fetching, cache invalidation
- [ ] E2E tests (Playwright):
  - Submit prompt → visible in admin panel → accept → appears in game
  - Start game → see live bids → round completes → leaderboard updates
  - Login → access admin → configure game → start
- [ ] Visual regression tests (optional): Chromatic or Percy

---

## FE-14: Build & Deploy

- [ ] Vite config optimization:
  - Code splitting by route (lazy loading)
  - Manual chunks: vendor (MUI, React), game (viewer components), admin
  - Asset optimization (image compression, SVG inline)
- [ ] Environment-specific builds:
  - `.env.development`, `.env.staging`, `.env.production`
  - API URL, WebSocket URL, feature flags
- [ ] CDN deployment target: Vercel or Cloudflare Pages
- [ ] Bundle size budget: < 200KB initial JS (gzipped)
- [ ] Lighthouse CI: performance score > 90

---

## FE-15: Advanced UI Features

- [ ] **AI Commentator Panel**: live LLM-generated commentary stream alongside game
- [ ] **Spectator Chat**: lightweight chat for viewers (WebSocket-based)
- [ ] **Picture-in-Picture**: pop-out game viewer while browsing other pages
- [ ] **Notifications**: browser notifications for game events (with permission)
- [ ] **Internationalization** (i18n): English + Polish at minimum
- [ ] **Theming**: custom themes per game session (host picks colors/branding)
