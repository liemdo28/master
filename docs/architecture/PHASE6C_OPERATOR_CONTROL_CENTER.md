# Phase 6C Operator Control Center

The Operator Control Center is a read-only cockpit over pending authority, blocked work, active delegated authority, and legacy quarantine state.

## Sources

- Task Runtime tasks in `WAITING_APPROVAL` or `BLOCKED`.
- Personal OS knowledge records in `NEEDS_CONFIRMATION`.
- Controlled Action proposals in `WAITING_APPROVAL`, `FAILED`, `RECOVERY_REQUIRED`, or `EXPIRED`.
- Stored governance decisions, budgets, kill switches, and active policy metadata.
- Governed action plans and steps that wait, block, fail, or require reconciliation.
- Delegated authorities that wait, pause, expire, exhaust, revoke, or approach expiry.
- Phase 6A authority manifest and Phase 6B legacy migration/quarantine state.

## API

All routes are GET-only and authenticated.

- `GET /api/operator/overview`
- `GET /api/operator/pending`
- `GET /api/operator/authority`
- `GET /api/operator/blocked`
- `GET /api/operator/item/:id`
- `GET /api/command-center/operator/*` equivalents

## Authority Rule

The cockpit never evaluates policy from scratch. It derives summaries from canonical stored sources and always marks executable authority as subject to canonical re-checks.

Frozen externally writable actions remain:

- `GMAIL_CREATE_DRAFT`
- `CALENDAR_EVENT_PROPOSAL`
- `CALENDAR_CREATE_EVENT`

`GMAIL_SEND_DRAFT` and generic mutation concepts are never surfaced as executable authority.

## UI

The Command Center route `/command-center/operator` contains:

- Overview
- Waiting on Me
- Active Authority
- Blocked
- Expiring / Needs Attention
- Legacy / Quarantined

Controls are navigation links only. Exact-payload action review remains on the existing Actions screen.
