# Executive Snapshot API Report

Target: EXECUTIVE_SNAPSHOT_API_READY

Implemented:

- Added `GET /api/executive/snapshot`.
- Added `GET /api/executive/intent?message=...`.
- Snapshot sections include today summary, tasks, approvals, work orders, blockers, projects, Gmail, Calendar, Drive, Health, Finance/QB, websites, dashboard, connectors, burn-in, graph, and memory.
- Every section includes `source`, `last_synced_at`, `freshness`, `stale`, `confidence`, `error`, `owner`, `evidence_links`, and `last_updated_at`.

Smoke evidence with local runtime data:

- `work_orders`: 8
- `finance_qb.status`: `needs_dev1_action`
- `connectors`: 13
- `action_required`: 9

Primary files:

- `server/src/executive/executive-snapshot.ts`
- `server/src/routes/executive.ts`
- `server/src/index.ts`
- `ui/index.html`

Executive UI bridge:

- `ui/index.html` now fetches `/api/executive/snapshot` through `getExec()`.
- Home KPIs, Work Orders, approvals, Gmail, Calendar, QB, and connector truth use the executive snapshot where applicable.

Verification:

- `npm run build` passed in `server`.
- Embedded dashboard script parses with Node.
