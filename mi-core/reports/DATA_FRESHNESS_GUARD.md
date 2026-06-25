# DATA_FRESHNESS_GUARD

Generated: 2026-06-25T13:06:04.199Z
Target: DATA_FRESHNESS_GUARD_READY
Overall status: stale

| Source | Status | Age Min | Threshold Min | Stale | Last Sync |
| --- | --- | --- | --- | --- | --- |
| Gmail | stale | 15782 | 120 | yes | 2026-06-14T14:03:57.278Z |
| Calendar | fresh | 29 | 120 | no | 2026-06-25T12:36:39.701Z |
| Drive | fresh | 29 | 240 | no | 2026-06-25T12:36:40.415Z |
| Sheets | fresh | 29 | 240 | no | 2026-06-25T12:36:42.903Z |
| Asana | fresh | 29 | 240 | no | 2026-06-25T12:36:50.182Z |
| Health | fresh | 29 | 1440 | no | 2026-06-25T12:36:50.190Z |
| Website bakudanramen.com | fresh | 29 | 1440 | no | 2026-06-25T12:36:50.951Z |
| Website rawsushibar.com | fresh | 29 | 1440 | no | 2026-06-25T12:36:50.952Z |
| QuickBooks | degraded | 0 | 1440 | no | 2026-06-25T13:06:04.181Z |
| Work Orders | fresh | 1718 | 2880 | no | 2026-06-24T08:28:02.137Z |
| Graph | fresh | 60 | 1440 | no | 2026-06-25T12:05:50.755Z |
| Memory | fresh | 785 | 1440 | no | 2026-06-25T00:01:05.357Z |

Rules: fresh = within threshold, warning = degraded connector/error with timestamp, stale = beyond threshold/missing/error. Stale sources are escalated into the incident registry.