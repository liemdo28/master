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

## Guardrails

- Personal memory stores only user-visible facts, preferences, summaries, provenance, confidence, and timestamps.
- Secret-like values are rejected.
- Draft child tasks are created in the existing task runtime and parked at `WAITING_APPROVAL`.
- Daily brief separates facts, suggestions, and unknowns.
- No coding task, push, merge, deploy, email, publish, or external action runs automatically.
