# QB Revenue Recovery Proof — Phase 34C
Date: 2026-06-25

## Component Status

| Component | Location | Status |
|-----------|----------|--------|
| QB ops agent (QBWC SOAP server) | Laptop1, Tailscale 100.111.97.25:3457 | RUNNING (0 syncs yet) |
| mi-accounting engine | services/accounting-engine, port 8844 | CONFIGURED in PM2 |
| qb-financial routes | server/src/routes/qb-financial.ts | LIVE — 5 endpoints |
| QB Online Watcher | server/src/jarvis/qb-online-watcher.ts | RUNNING at mi-core start |
| PM2 mi-accounting | ecosystem.config.js | REGISTERED |

## Endpoints Live

- `GET /api/qb/status` — proxy to QB ops agent `/api/status`
- `GET /api/qb/financial` — full financial data (accounts, receipts, invoices)
- `GET /api/qb/financial/summary` — CEO revenue/expense summary
- `GET /api/qb/financial/accounts` — chart of accounts
- `GET /api/qb/financial/receipts` — receipts list
- `GET /api/qb/health-check` — **NEW** stale-sync alert (Phase 34C)

## Health-Check Endpoint — /api/qb/health-check

Returns:
```json
{
  "qb_status": "QB_NEVER_SYNCED | QB_STALE | QB_LIVE | QB_AGENT_UNREACHABLE",
  "last_sync": "<ISO timestamp or null>",
  "stale": true,
  "requests_received": 0,
  "agent_url": "http://100.111.97.25:3457",
  "next_action": "Open QuickBooks Desktop on Laptop1..."
}
```

Stale threshold: last_sync null OR > 2 hours ago.

## What Is Live vs Blocked

### LIVE
- mi-core proxy routes (`/api/qb/*`) — fully operational
- QB ops agent process on Laptop1 (Tailscale reachable)
- accounting-engine service exists and is registered in PM2
- Health-check route added, compiles cleanly

### BLOCKED / PENDING
- `requests_received: 0` — QBWC has never synced
- **CEO action required:** Open QuickBooks Desktop on Laptop1 → File → Update Web Services → Update Now
- Once QBWC runs one sync cycle, `last_sync` will be populated and `/api/qb/financial/*` endpoints will return real data

## Final Status

**QB_REVENUE_PARTIAL**

Infrastructure is fully wired. Data flow is blocked only by the missing QB Desktop QBWC trigger (manual step). One sync from QB Desktop will move status to QB_REVENUE_LIVE.
