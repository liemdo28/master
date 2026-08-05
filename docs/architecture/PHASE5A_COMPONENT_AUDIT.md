# Phase 5A Component Audit

Phase 5A extends the existing Mi runtime rather than creating a second assistant stack.

## Classification

- `server/src/operational-memory`: ADAPT later. Useful incident/execution memory, but not the canonical personal preference or goal store.
- `server/src/memory` and `server/src/memory2`: IGNORE for Phase 5A persistence. They are context/vector-oriented and not inspectable enough for user-editable preference and goal records.
- `server/src/executive-intelligence`: ADAPT later. It contains planning and briefing concepts, but it is broader than Phase 5A and includes unfinished executive-intelligence surfaces.
- `server/src/executive-briefing`: ADAPT as a data source later. Phase 5A daily brief uses a new inspectable local record first.
- `server/src/task-intelligence`: KEEP as a read-side signal source. It is not the canonical goal planner.
- `server/src/coo-v4`: IGNORE for Phase 5A execution. It is too broad and includes agent/operator concepts outside this slice.
- `server/src/jarvis`: ADAPT later for presentation and scheduling only. It must not become the canonical Phase 5A store.
- `server/src/services/owner-profile.ts`: ADAPT later as profile input, not as the durable preference store.
- `server/src/task-runtime`: KEEP. It is the canonical child task runtime.
- `server/src/project-registry`: KEEP. It remains the canonical project state source.

## Decisions

- Canonical personal-context store: `server/src/personal-os/store.ts`.
- Canonical planning entry point: `PersonalOsService.planGoal`.
- Canonical APIs: `/api/personal/preferences`, `/api/goals`, `/api/daily-brief`.
- Canonical CLI: `npm run personal-os`.
- Canonical child-task runtime: existing `server/src/task-runtime`.
- Canonical project source: existing `server/src/project-registry`.

## Store And Schema

The Phase 5A store is a local SQLite database outside source control. It enables WAL, foreign keys, schema migration records, indexes for IDs/statuses/dates/parent relationships, and durable audit records for goal state changes.

Durable records include preferences, goals, goal plans, priority items, daily briefs, goal events, and plan operation state. Hidden chain-of-thought is not stored.

## Truth Priority

`USER_STATED` preferences are active and confirmed. `MODEL_INFERRED` preferences require confirmation and cannot silently replace an active user-stated preference. A newer explicit user preference supersedes the prior active explicit record for the same category/key.

Secret-like input is rejected at write time. Read-side summaries also sanitize untrusted instruction-like text and redact credential-shaped values before daily brief storage.

## Goal State Machine

Allowed transitions are:

- `DRAFT -> ACTIVE`
- `DRAFT -> CANCELLED`
- `ACTIVE -> PAUSED`
- `ACTIVE -> BLOCKED`
- `ACTIVE -> COMPLETED`
- `ACTIVE -> CANCELLED`
- `PAUSED -> ACTIVE`
- `PAUSED -> CANCELLED`
- `BLOCKED -> ACTIVE`
- `BLOCKED -> CANCELLED`

Terminal states set `completedAt`, and every status change appends a durable goal event. Invalid transitions are rejected.

## Planning Boundary

Goal planning validates registered project IDs and returns the existing active plan plus child task IDs on repeat calls. It does not create duplicate child tasks silently.

Personal OS and Task Runtime use separate SQLite databases, so planning is handled as a recoverable operation rather than claimed as one native cross-database transaction. The plan operation records staged child task IDs and failure state. Retries reuse existing child tasks by parent goal and bounded task title before activating the plan.

Goal activation also validates registered project IDs. Activation never executes child tasks.

## Guardrails

- Personal memory stores only user-visible facts, preferences, summaries, provenance, confidence, and timestamps.
- Secret-like values are rejected.
- Draft child tasks are created in the existing task runtime and parked at `WAITING_APPROVAL`.
- Daily brief separates facts, suggestions, and unknowns.
- No coding task, push, merge, deploy, email, publish, or external action runs automatically.
- Personal APIs use the existing strict API-key boundary used by task-runtime/coding, including localhost.
- JSON body parsing uses a 1 MB limit and controlled parse errors.

## Known Limitations

- Calendar and email data are unknown unless connectors are explicitly configured later.
- Phase 5A creates local planning records and approval-gated child tasks only.
- Multi-agent planning, voice, desktop control, external notifications, and autonomous external actions are intentionally out of scope.
