# Daily Runtime Health Report

Generated: 2026-06-14

Target: `BURN_IN_SUPPORT_READY`

## Result

Status: `BURN_IN_SUPPORT_READY`

## Burn-In Support Checklist

| Track | Status | Evidence |
| --- | --- | --- |
| Connector uptime | healthy | `/api/visibility/connectors/health` all normalized |
| Sync failures | clear | Data freshness error count `0` |
| Stale data | clear | Data freshness stale count `0` |
| Token refresh | monitor | Google and Asana auth are connected |
| Website sync | healthy | Bakudan and Raw website synced at `2026-06-14T15:29Z` |
| QB sync | healthy | QB certified, last sync `2026-06-14T15:04:32.890153+00:00` |
| Health import | healthy | Huawei/OpenHuman health cache ready |

## Connector State

- Dashboard: `healthy`
- Asana: `healthy`
- Gmail: `healthy`
- Calendar: `healthy`
- Drive: `healthy`
- Sheets: `healthy`
- Health: `healthy`
- QuickBooks: `healthy`
- Website Bakudan: `healthy`
- Website Raw: `healthy`
- Work Orders: `fresh`

## Daily Action For Dev3 Burn-In

1. Check `/api/visibility/freshness`.
2. Check `/api/visibility/connectors/health`.
3. Confirm Dashboard is not `SYNC_FAILED`.
4. Confirm Asana is not `unknown`.
5. Confirm website connectors are not `never synced`.
6. Confirm QB status remains `healthy`.
7. Confirm health import remains current.

## Certification

`BURN_IN_SUPPORT_READY`
