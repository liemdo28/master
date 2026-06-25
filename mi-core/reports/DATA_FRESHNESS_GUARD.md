# DATA_FRESHNESS_GUARD

Generated: 2026-06-25T08:49:10.403Z
Target: DATA_FRESHNESS_GUARD_READY
Overall status: stale

| Source | Status | Age Min | Threshold Min | Stale | Last Sync |
| --- | --- | --- | --- | --- | --- |
| Gmail | stale | 15525 | 120 | yes | 2026-06-14T14:03:57.278Z |
| Calendar | fresh | 29 | 120 | no | 2026-06-25T08:19:49.151Z |
| Drive | fresh | 29 | 240 | no | 2026-06-25T08:19:49.827Z |
| Sheets | fresh | 29 | 240 | no | 2026-06-25T08:19:51.916Z |
| Asana | fresh | 29 | 240 | no | 2026-06-25T08:20:09.463Z |
| Health | fresh | 29 | 1440 | no | 2026-06-25T08:20:09.473Z |
| Website bakudanramen.com | fresh | 29 | 1440 | no | 2026-06-25T08:20:10.043Z |
| Website rawsushibar.com | fresh | 29 | 1440 | no | 2026-06-25T08:20:10.044Z |
| QuickBooks | degraded | 0 | 1440 | no | 2026-06-25T08:49:10.388Z |
| Work Orders | fresh | 1461 | 2880 | no | 2026-06-24T08:28:02.137Z |
| Graph | fresh | 60 | 1440 | no | 2026-06-25T07:49:01.374Z |
| Memory | fresh | 528 | 1440 | no | 2026-06-25T00:01:05.357Z |

Rules: fresh = within threshold, warning = degraded connector/error with timestamp, stale = beyond threshold/missing/error. Stale sources are escalated into the incident registry.