# DEV2 BURN-IN SUPPORT REPORT

Generated: 2026-06-14

## Verdict

Status: DEV2_BURN_IN_SUPPORT_READY

Scope: 7-day Dev3 burn-in connector/data support.

## Runtime Uptime

PM2 status after maintenance:

- mi-core: online
- mi-ai-service: online
- mi-node-agent: online
- whatsapp-ai-gateway: online
- agent-engine: online

## Connector Uptime

| Connector | Auth | Health | Last sync |
|---|---|---|---|
| Gmail | connected | healthy | `2026-06-14T14:03:57.278Z` |
| Google Calendar | connected | healthy | `2026-06-14T14:17:26.353Z` |
| Google Drive | connected | healthy | `2026-06-14T14:17:27.134Z` |
| Google Sheets | connected | healthy | `2026-06-14T14:43:38.741Z` |
| Huawei Health | connected | healthy | `2026-06-14T14:29:30.696Z` |
| bakudanramen.com | connected | healthy | `2026-06-14T14:43:33.904Z` |
| rawsushibar.com | connected | healthy | `2026-06-14T14:43:34.701Z` |
| QuickBooks Runtime | connected | healthy | `2026-06-14T15:15:00.935Z` |

## Active Alerts

- Work Orders are stale. Latest observed work order cache timestamp: `2026-06-13T05:33:59.840Z`.

## Google Token Refresh Status

- Google OAuth token exists
- Refresh token exists
- Sheets scope exists
- Gmail/Calendar/Drive/SHEETS connectors are connected

## Health Import Status

- Huawei/Health export connector: healthy
- Last import: `2026-06-14T14:29:30.696Z`

## Website Sync Status

- bakudanramen.com: synced from local source + GitHub metadata + production domain
- rawsushibar.com: synced from local source + GitHub metadata + production domain

## QB Sync Status

- checksum mismatch recovery applied
- Dev1 laptop1 evidence imported
- current status: healthy / certified
- latest successful sync: `2026-06-14T15:04:32.890153+00:00`
- transactions_synced: 2
- errors_json: `[]`

## Daily Burn-In Output

For each day of Dev3 burn-in, Dev2 should rerun:

- `POST /api/visibility/sync/google-sheets`
- `POST /api/visibility/sync/website-bakudan`
- `POST /api/visibility/sync/website-raw`
- `POST /api/visibility/sync/quickbooks-runtime`
- `GET /api/visibility/freshness`

Final status: READY FOR DAILY MAINTENANCE
