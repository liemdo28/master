# DATA FRESHNESS MONITOR REPORT

Generated: 2026-06-14

## Verdict

Status: DATA_FRESHNESS_MONITOR_READY

Monitor endpoint:

- `GET /api/visibility/freshness`

Cache:

- `E:/Project/Master/.local-agent-global/visibility/data-freshness.json`

## Current Freshness Snapshot

Overall status: stale

Reason:

- Work Orders are stale

Counts:

- stale_count: 1
- missing_count: 0
- error_count: 0

## Source Status

| Source | Status | Last synced | Note |
|---|---:|---|---|
| Gmail | fresh | `2026-06-14T14:03:57.278Z` | healthy |
| Calendar | fresh | `2026-06-14T14:17:26.353Z` | healthy |
| Drive | fresh | `2026-06-14T14:17:27.134Z` | healthy |
| Sheets | fresh | `2026-06-14T14:43:38.741Z` | healthy |
| Health | fresh | `2026-06-14T14:29:30.696Z` | healthy |
| bakudanramen.com | fresh | `2026-06-14T14:43:33.904Z` | healthy |
| rawsushibar.com | fresh | `2026-06-14T14:43:34.701Z` | healthy |
| QuickBooks | fresh | `2026-06-14T15:15:00.935Z` | healthy; real laptop1/Dev1 evidence imported |
| Work Orders | stale | `2026-06-13T05:33:59.840Z` | older than 1440-minute threshold |
| Graph | fresh | `2026-06-14T14:44:29.929Z` | local graph DB |
| Memory | fresh | `2026-06-14T14:29:30.704Z` | local operational memory DB |

## Guardrail

Monitor includes the required no-hallucination phrase:

`Em chưa có đủ dữ liệu thật để kết luận.`

Final status: PASS WITH WORK_ORDER STALE ALERT
