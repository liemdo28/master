# Phase 5E — Command Center architecture

See `PHASE5E_UI_COMPONENT_AUDIT.md` for why a new frontend exists and the auth-bridge
decision. This document covers the frontend's own architecture.

## Stack

React 19 + TypeScript + Vite 8 + Tailwind CSS v4 (CSS-first, no `tailwind.config.js`) +
TanStack Query (server state) + TanStack Table/Virtual (large lists) + React Router 7 +
Vitest + Testing Library (component tests) + Playwright (E2E). Lives at
`command-center/`, sibling to `server/`, `ui/`, `client/` — nothing outside this
directory (plus the additive backend bridge in `server/src/index.ts`) is touched.

## Directory layout

```
command-center/
  src/
    lib/            api-client.ts, auth.tsx, types.ts, format.ts, sanitize.ts, queryClient.ts
    components/     Layout, StatusBadge, CategoryList, EvidenceDrawer, CommandPalette,
                     States (Loading/Empty/Error/Unauthorized/NotConfigured), LoginScreen
    routes/         one file per screen (TodayPage.tsx, PlanPage.tsx, ... SettingsPage.tsx)
  test/             Vitest component + security tests
  e2e/              Playwright E2E spec + fixture-seeding backend script
```

## Data flow

Every screen is a thin composition of: a TanStack Query hook calling the typed `api`
client, a `DataBoundary` wrapper (loading/error/empty/unauthorized states — never
fabricated placeholder data), and presentational JSX. No screen calls `fetch()`
directly, and no screen re-derives planner/brief/review logic that already exists on
the backend (Phase 5A–5D-3) — every "Generate" or "Refresh" button is a thin `api.post`
call into an existing, already-tested backend endpoint.

## Auth

PIN → session-token flow, reusing `server/src/remote/remote-auth.ts` unmodified (see
`PHASE5E_UI_SECURITY.md`). The token lives in `sessionStorage` (not `localStorage`),
attached as `Authorization: Bearer <token>` by the one shared `api-client.ts`. A 401
from any request locks the app back to the PIN screen via a single `onUnauthorized`
callback wired once in `App.tsx`.

## State management (§29)

Server state (everything from the backend) lives entirely in TanStack Query's cache —
no screen keeps a parallel copy of backend truth in `useState`. UI-only state (which
tab is selected, search box contents, command palette open/closed) uses local
`useState`. Nothing is duplicated between the two.

## Truth categories (§UX principles, §4)

`CategoryList` renders FACTS / SUGGESTIONS / UNKNOWNS as visually distinct sections
(color, icon, and a text label — never color alone) everywhere the backend already
separates them (`DailyOperatingBrief.facts/suggestions/unknowns`,
`EndOfDayReview`/`WeeklyOperatingReview` likewise). Approvals are always their own
category (`PendingApprovalItem`), never folded into facts or suggestions.

## Evidence UX (§20)

`EvidenceDrawer`/`EvidenceButton` provide a consistent "Why?" affordance. Callers pass
only already-safe entries (evidence references like `task:<id>`/`doc:<id>`, ids,
timestamps, counts) — the drawer itself never receives or renders raw tokens, stack
traces, or absolute paths, because no caller in this codebase constructs an evidence
entry from those sources.

## Real-time updates (§21)

Not implemented in this phase. The existing `/ws` WebSocket endpoint (used by the
static dashboards) was evaluated and is the natural fit for a future live-update layer,
but every screen here already reads from cheap, idempotent GET endpoints, and manual
refresh/regenerate buttons cover the direct requirement from the directive without
adding a second real-time transport. This is a deliberate scope cut, not an oversight —
see `PHASE5E_ACCEPTANCE.md`.

## Build and deploy (§35)

`npm run build` produces `command-center/dist/`, served by the existing `mi-core`
Express server via one additive `express.static` mount at `/command-center`, with a
`GET /command-center/*` SPA fallback so client-side routes survive a reload. No new
server process, no reverse proxy, no container — matches the directive's "simple and
reversible" requirement exactly the way `ui/`'s static files are already served.
