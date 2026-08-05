# Phase 5A Architecture

Phase 5A adds a local Personal OS layer without changing the frozen coding engine.

## Canonical Components

- Personal OS store: `server/src/personal-os/store.ts`
- Personal OS service: `server/src/personal-os/service.ts`
- Personal OS router: `server/src/personal-os/router.ts`
- Child task runtime: `server/src/task-runtime`
- Project state source: `server/src/project-registry`

`PersonalOsStore` is the canonical Phase 5A store for preferences, goals, priority items, daily briefs, goal events, and plan-operation state. Task Runtime remains the only child-task runtime. Project Registry remains the only project-state source.

## APIs

Personal APIs are mounted under `/api`:

- `/api/personal/preferences`
- `/api/goals`
- `/api/daily-brief`
- `/api/personal/integrity`

They use the same strict API-key boundary as task-runtime and coding. Localhost alone is not trusted.

## Truth Priority

Phase 5A preference truth is simple:

1. User-stated preferences are active and confirmed.
2. Model-inferred preferences require confirmation.
3. Inferred preferences cannot silently override an active user-stated preference.
4. New explicit user-stated preferences supersede older active records for the same category, key, and scope.

## Goal State Machine

Allowed transitions:

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

Terminal states persist `completedAt`. Every state change writes an audit event.

## Planning

Planning validates registered project IDs and creates a bounded plan with no more than five milestones. It creates child tasks through Task Runtime and parks every child task at `WAITING_APPROVAL`.

Planning is idempotent. A repeated plan call returns the existing plan and child task IDs. Because Personal OS and Task Runtime use separate SQLite databases, plan creation uses a recoverable operation record and child-task dedupe instead of claiming a native cross-database transaction.

## Daily Brief

Daily briefs separate:

- facts
- suggestions
- unknowns

Calendar and email facts stay unknown unless connectors are configured later. Same-date generation returns the existing brief.

## Persistence

Runtime databases are outside source control:

- `.local-agent-global/personal-os/personal-os.db`
- `.local-agent-global/task-runtime/tasks.db`
- `.local-agent-global/project-registry/projects.db`

The stores use SQLite with WAL, migrations where applicable, indexes, integrity checks, and foreign-key checks.

## Limitations

- No semantic personal knowledge memory yet.
- No calendar/email intelligence.
- No voice.
- No unrestricted desktop control.
- No autonomous push/merge/deploy.
- No autonomous external actions.
