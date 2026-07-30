# FINANCE WIDGET DATA SOURCE AUDIT

Status: PASS
Target: DASHBOARD_RUNTIME_STATE_CERTIFIED
Generated: 2026-06-14

## Scope

Audit the finance dashboard mismatch where certification evidence showed QuickBooks healthy, while the dashboard still displayed `SYNC_FAILED since 2026-06-10`.

## Dashboard Data Source Trace

### Previous dashboard source

The dashboard finance widgets in `ui/index.html` contained hardcoded stale QuickBooks failure text:

- Header chip: `QB SYNC_FAILED`
- Home finance card: old checksum mismatch warning
- Finance tab card: `SYNC_FAILED - 15+` from 2026-06-10
- Warning banner builder: hardcoded QB error alert

This meant the dashboard was not using runtime QuickBooks evidence.

### Correct dashboard source

The dashboard now reads QuickBooks runtime state from:

- API endpoint: `GET /api/visibility/quickbooks`
- Route file: `server/src/routes/visibility.ts`
- Runtime provider: `server/src/visibility/visibility-hub.ts`
- Snapshot provider: `server/src/visibility/connectors/qb-runtime-connector.ts`

### Runtime DB path

Current certified QuickBooks runtime DB:

```text
E:\Project\Master\mi-core\data\qb-agent.db
```

Legacy stale path that must not be used as the dashboard source:

```text
E:\Project\Master\mi-core\server\data\qb-agent.db
```

### Cache layer

QuickBooks visibility cache:

```text
E:\Project\Master\.local-agent-global\visibility\quickbooks\data.json
```

Connector registry:

```text
E:\Project\Master\.local-agent-global\visibility\connector-registry.json
```

Freshness monitor source:

```text
GET /api/visibility/freshness
E:\Project\Master\.local-agent-global\visibility\data-freshness.json
```

## Current Runtime Evidence

`GET /api/visibility/quickbooks` returns:

```json
{
  "status": "healthy",
  "certified": true,
  "last_successful_sync": "2026-06-14T22:04:32.890153+07:00",
  "last_sync_status": "completed",
  "company_detected": true,
  "quickbooks_desktop_open": true
}
```

`GET /api/visibility/freshness` returns QuickBooks:

```json
{
  "source": "QuickBooks",
  "status": "fresh",
  "last_synced_at": "2026-06-14T15:15:00.935Z",
  "threshold_minutes": 1440,
  "error": null
}
```

## Fix Applied

- Added `GET /api/visibility/quickbooks`.
- Dashboard home and finance widgets now render from `/api/visibility/quickbooks`.
- Removed hardcoded dashboard `QB SYNC_FAILED` warning.
- Weekly CEO report no longer hardcodes the 2026-06-10 QB blocker when runtime is healthy.
- QuickBooks connector registry points to `E:\Project\Master\mi-core\data\qb-agent.db`.
- Removed stale PM2 orphan process holding port 4001 and restarted `mi-core` cleanly.

## Acceptance Result

PASS.

Dashboard runtime source now matches certification evidence:

- QB: connected
- QB health: healthy
- Last successful sync: 2026-06-14
- No stale dashboard `SYNC_FAILED` warning when runtime is healthy

