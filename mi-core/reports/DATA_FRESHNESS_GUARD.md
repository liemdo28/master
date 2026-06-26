# DATA_FRESHNESS_GUARD

Generated: 2026-06-26T16:48:36.488Z
Target: DATA_FRESHNESS_GUARD_READY
Overall status: stale

| Source | Status | Age Min | Threshold Min | Stale | Last Sync |
| --- | --- | --- | --- | --- | --- |
| Gmail | fresh | 30 | 120 | no | 2026-06-26T16:18:39.710Z |
| Calendar | fresh | 29 | 120 | no | 2026-06-26T16:19:20.161Z |
| Drive | fresh | 29 | 240 | no | 2026-06-26T16:19:20.845Z |
| Sheets | fresh | 29 | 240 | no | 2026-06-26T16:19:23.133Z |
| Asana | fresh | 29 | 240 | no | 2026-06-26T16:19:30.835Z |
| Health | fresh | 29 | 1440 | no | 2026-06-26T16:19:30.841Z |
| Website bakudanramen.com | fresh | 29 | 1440 | no | 2026-06-26T16:19:31.777Z |
| Website rawsushibar.com | fresh | 29 | 1440 | no | 2026-06-26T16:19:31.778Z |
| QuickBooks | degraded | 0 | 1440 | no | 2026-06-26T16:48:36.476Z |
| Work Orders | stale | 15201 | 2880 | yes | 2026-06-16T03:27:31.657Z |
| Graph | fresh | 180 | 1440 | no | 2026-06-26T13:48:29.532Z |
| Memory | stale | 2448 | 1440 | yes | 2026-06-25T00:01:05.357Z |

Rules: fresh = within threshold, warning = degraded connector/error with timestamp, stale = beyond threshold/missing/error. Stale sources are escalated into the incident registry.