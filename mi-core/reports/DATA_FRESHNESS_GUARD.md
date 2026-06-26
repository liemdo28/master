# DATA_FRESHNESS_GUARD

Generated: 2026-06-26T15:48:36.832Z
Target: DATA_FRESHNESS_GUARD_READY
Overall status: stale

| Source | Status | Age Min | Threshold Min | Stale | Last Sync |
| --- | --- | --- | --- | --- | --- |
| Gmail | fresh | 30 | 120 | no | 2026-06-26T15:18:39.338Z |
| Calendar | fresh | 29 | 120 | no | 2026-06-26T15:19:20.103Z |
| Drive | fresh | 29 | 240 | no | 2026-06-26T15:19:20.786Z |
| Sheets | fresh | 29 | 240 | no | 2026-06-26T15:19:23.353Z |
| Asana | fresh | 29 | 240 | no | 2026-06-26T15:19:31.884Z |
| Health | fresh | 29 | 1440 | no | 2026-06-26T15:19:31.888Z |
| Website bakudanramen.com | fresh | 29 | 1440 | no | 2026-06-26T15:19:32.668Z |
| Website rawsushibar.com | fresh | 29 | 1440 | no | 2026-06-26T15:19:32.669Z |
| QuickBooks | degraded | 0 | 1440 | no | 2026-06-26T15:48:36.816Z |
| Work Orders | stale | 15141 | 2880 | yes | 2026-06-16T03:27:31.657Z |
| Graph | fresh | 120 | 1440 | no | 2026-06-26T13:48:29.532Z |
| Memory | stale | 2388 | 1440 | yes | 2026-06-25T00:01:05.357Z |

Rules: fresh = within threshold, warning = degraded connector/error with timestamp, stale = beyond threshold/missing/error. Stale sources are escalated into the incident registry.