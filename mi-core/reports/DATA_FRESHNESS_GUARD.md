# DATA_FRESHNESS_GUARD

Generated: 2026-06-26T13:45:09.713Z
Target: DATA_FRESHNESS_GUARD_READY
Overall status: stale

| Source | Status | Age Min | Threshold Min | Stale | Last Sync |
| --- | --- | --- | --- | --- | --- |
| Gmail | fresh | 30 | 120 | no | 2026-06-26T13:15:12.564Z |
| Calendar | fresh | 29 | 120 | no | 2026-06-26T13:15:51.148Z |
| Drive | fresh | 29 | 240 | no | 2026-06-26T13:15:51.886Z |
| Sheets | fresh | 29 | 240 | no | 2026-06-26T13:15:53.996Z |
| Asana | fresh | 29 | 240 | no | 2026-06-26T13:16:00.881Z |
| Health | fresh | 29 | 1440 | no | 2026-06-26T13:16:00.887Z |
| Website bakudanramen.com | fresh | 29 | 1440 | no | 2026-06-26T13:16:01.548Z |
| Website rawsushibar.com | fresh | 29 | 1440 | no | 2026-06-26T13:16:01.549Z |
| QuickBooks | degraded | 0 | 1440 | no | 2026-06-26T13:45:09.696Z |
| Work Orders | stale | 15018 | 2880 | yes | 2026-06-16T03:27:31.657Z |
| Graph | fresh | 300 | 1440 | no | 2026-06-26T08:44:55.667Z |
| Memory | stale | 2264 | 1440 | yes | 2026-06-25T00:01:05.357Z |

Rules: fresh = within threshold, warning = degraded connector/error with timestamp, stale = beyond threshold/missing/error. Stale sources are escalated into the incident registry.