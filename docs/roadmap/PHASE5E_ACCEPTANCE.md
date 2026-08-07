# Phase 5E — acceptance evidence

## Component tests (§30)

`npm run test:command-center` — 13/13 passing, one per primary screen (Today, Plan,
Approvals, Goals, Projects, Tasks, Knowledge, Memory, Calendar, Inbox, Coding, Health,
Reviews), each asserting real rendered content against a mocked API client plus a
screen-specific safety property (Plan shows the "does not execute tasks" banner,
Approvals shows no approve button for a Task Runtime item, Tasks shows no execute
button, Coding shows no run/deploy button, Calendar/Inbox honestly show
NOT_CONFIGURED rather than fabricated data).

## Security tests (§31)

`npm run test:command-center-security` — 17/17 passing: XSS from malicious document/
email/Markdown content (`sanitizeHtml` strips all markup, including inline event
handlers and encoded script tags), `javascript:`/`data:`/`vbscript:`/`ftp:` link
rejection, email masking, session token confined to `sessionStorage` (never
`localStorage`), bounded/non-leaking `ApiError` messages, unauthenticated state never
renders the app shell, and Calendar/Inbox structurally never expose a mutation control.

## E2E test (§32)

`npm run test:command-center-e2e` (Playwright) — 2/2 passing, against a fully isolated,
disposable fixture backend (`e2e/seed-and-serve.cjs`: its own temp SQLite databases,
its own PIN, its own port, seeded via the real compiled `DailyOperatingLoop`/
`TaskEngine`/`KnowledgeDocumentService` — no mocked business logic). Covers the full
17-step flow from the directive: login → Today/Morning Brief → Daily Plan → approve
plan → verify the underlying task's status is unchanged → Approvals → Goal detail →
Project detail → Knowledge search → open citation → Calendar (honest NOT_CONFIGURED) →
Inbox (honest NOT_CONFIGURED) → Health → generate End-of-Day Review → reload → verify
persistence. A second test independently confirms, via a direct API call, that the
fixture's WAITING_APPROVAL task is still WAITING_APPROVAL after the full flow — no
external write occurred anywhere in the run.

## Real backend acceptance (§33)

Run manually against a **read-only SQLite online-backup copy** of the actual live
production databases (personal-os, task-runtime, project-registry) plus the real,
read-only Google token — never the live database files or the live PM2 process
directly (same isolation methodology Phase 5D-3 established). Confirmed real data
renders correctly on every screen: Today (real goals, real WAITING_APPROVAL tasks,
real service health, real Gmail-derived deadlines), Daily Plan (real APPROVED status
carried over from Phase 5D-3's own live acceptance), Approvals (10 real pending Task
Runtime approvals), Goals, Projects (real map status `FRESH`, real ATTENTION health),
Tasks (virtualized list of dozens of real tasks), Knowledge (real indexed document),
Memory, Calendar/Inbox (real Google connector `READY`, real follow-up candidates from
actual Gmail alerts), Coding (real Ollama model list and engine registry), Health (real
schema v6, real service probes), Reviews (real End-of-Day review with real failure
counts).

**Four real bugs were found and fixed during this pass** (all in frontend response-shape
assumptions, none in the backend):
1. `CodingPage.tsx` assumed the wrong `/coding/engines`/`/coding/model-roles`/
   `/coding/model-health` response shapes (real shapes use `label`/`status`/`modelRoles`
   as an object, not the guessed `name`/`available`/array-of-models shape).
2. `HealthPage.tsx` rendered the full list of raw granted OAuth scope URLs — a privacy
   violation of §23; fixed to show a count only.
3. `SettingsPage.tsx` assumed `/api/remote/audit`'s field was named `audit`; the real
   field is `log`, causing a crash (`Cannot read properties of undefined`).
4. `GoalDetailPage.tsx` assumed `GET /goals/:id` wrapped its response as `{goal:
   ...}`; it returns the raw object directly, causing the whole detail view to render
   blank.

A fifth issue, found the same way, was the route-shadowing auth bug documented in
`PHASE5E_UI_SECURITY.md` — not a frontend bug, but discovered because Command Center's
own login flow was the first thing to exercise `/api/remote/login` end-to-end.

## Performance (§34)

Measured against the isolated real-backend copy on localhost:

| metric | measured | target |
|---|---|---|
| Today screen API call | 27ms | — |
| JS/CSS asset load (cached) | 6ms each | — |
| Production bundle | 392KB JS (113KB gzip), 25KB CSS (5KB gzip) | no giant bundle without justification |
| Large task list (dozens of real tasks) | virtualized via `@tanstack/react-virtual`, smooth scroll | virtualize large lists |

Usable-first-screen and navigation-latency targets (<2s, <300ms) are comfortably met
on localhost; both are dominated by network/backend latency, which this phase does not
control, rather than frontend render cost.

## Build (§35 / §38)

`npm ci && npx tsc -b && npm run build` — clean, zero errors, zero warnings after
fixing the initial Tailwind/Vitest config warnings. Backend: `npm ci && npm run build
&& npx tsc --noEmit` — clean.

## What was not attempted

Real-time updates via WebSocket (§21) — deliberately deferred; see
`PHASE5E_COMMAND_CENTER.md#real-time-updates-21`. Gmail/Calendar writes, voice, desktop
control, autonomous task execution, autonomous push/merge/deploy, financial actions,
multi-agent orchestration, and Phase 5F are all NOT STARTED — no code path for any of
them exists anywhere in this phase's diff.
