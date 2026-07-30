# DASHBOARD WARNING CLASSIFICATION REPORT

Status: PASS
Target: DASHBOARD_RUNTIME_STATE_CERTIFIED
Generated: 2026-06-14

## Scope

Audit warning banners for overdue tasks, Asana connector state, and QuickBooks connector state.

## Severity Rules

| Signal | Severity | Dashboard Behavior |
| --- | --- | --- |
| Connector `healthy` | INFO | No warning banner |
| Connector `degraded` | WARNING | Show warning with connector name and cache/live-sync detail |
| Connector `offline` | CRITICAL | Show critical connector unavailable warning |
| Connector `unknown` with evidence | INFO/WARNING after effective health derivation | Do not show raw `unknown` |
| Overdue Asana tasks > 50 | WARNING | Show overdue workload warning |
| QuickBooks runtime healthy | INFO | No stale QB failure warning |
| QuickBooks runtime unhealthy or no sync | CRITICAL | Show finance/QB action required |
| Burn-in critical finding | CRITICAL | Show burn-in critical warning |
| Burn-in degraded finding | WARNING | Show burn-in warning |

## Current Classification

### QuickBooks

Current:

```json
{
  "auth": "connected",
  "health": "healthy",
  "last_sync": "2026-06-14T15:15:00.935Z"
}
```

Classification: INFO.

Action: no stale `SYNC_FAILED` banner.

### Asana

Current:

```json
{
  "auth": "connected",
  "health": "healthy",
  "last_sync": "2026-06-14T15:21:28.052Z"
}
```

Classification: INFO for connector health.

Workload note: 67 overdue tasks exists in Asana cache.

Overdue task classification: WARNING.

### Dashboard Warning Builder

Hardcoded QB warning removed from `ui/index.html`.

Connector warning logic now classifies:

- `offline` as critical
- `degraded` as warning
- `unknown` as warning only when no effective state can be derived

## PM2 Runtime Stability

An orphan PM2 child process was holding port 4001 and caused restart loops with:

```text
EADDRINUSE: address already in use 127.0.0.1:4001
```

Fix:

- Stopped `mi-core`
- Removed orphan PID holding port 4001
- Restarted `mi-core`

Current:

```text
mi-core online
GET /api/health -> server ok
```

## Acceptance Result

PASS.

Dashboard runtime state is certified:

- QB: connected, healthy, last sync timestamp shown
- Asana: healthy, no `unknown`
- No stale `SYNC_FAILED` warning while runtime is healthy

