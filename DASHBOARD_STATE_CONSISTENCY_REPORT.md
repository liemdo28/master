# Dashboard State Consistency Report

Generated: 2026-06-14

Target: `DASHBOARD_STATE_CERTIFIED`

## Result

Status: `DASHBOARD_STATE_CERTIFIED`

The mismatch was caused by a stale Dashboard source path in the visibility connector default and root `.env.example`.

Failing path:

- `E:/Project/Master/dashboard.bakudanramen.com`

Actual source path:

- `E:/Project/Master/Bakudan/dashboard.bakudanramen.com`

## Evidence

Runtime state:

- QuickBooks Runtime: `healthy`, `certified=true`
- Last QB sync: `2026-06-14T15:04:32.890153+00:00`
- Latest QB cache: `E:/Project/Master/.local-agent-global/visibility/quickbooks/data.json`

Dashboard state before fix:

- `SYNC_FAILED`
- Error cache: `E:/Project/Master/.local-agent-global/visibility/dashboard/errors.json`
- Error: `Dashboard path not found`

Dashboard state after fix:

- Source path: `E:/Project/Master/Bakudan/dashboard.bakudanramen.com`
- PHP files: `1179`
- JS files: `50`
- Modules: `28`
- Scanned at: `2026-06-14T15:29:40.521Z`
- Registry health: `healthy`

## Source Verification

| Source | Result |
| --- | --- |
| API source | `http://dashboard.bakudanramen.com`; runtime local source now resolves |
| Cache source | `E:/Project/Master/.local-agent-global/visibility/dashboard/data.json` |
| DB source | QB DB remains healthy at `E:/Project/Master/mi-core/data/qb-agent.db` |
| Monitor source | `/api/visibility/connectors/health` reports `dashboard-bakudan=healthy` |

## Fix Applied

Updated:

- `server/src/visibility/connectors/dashboard.ts`
- `server/src/visibility/connector-registry.ts`
- `.env.example`

The Dashboard connector now resolves configured paths plus known fallbacks and no longer fails when only the old default path is missing.

## Certification

`DASHBOARD_STATE_CERTIFIED`
