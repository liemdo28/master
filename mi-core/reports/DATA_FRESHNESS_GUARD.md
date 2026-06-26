# DATA_FRESHNESS_GUARD

Generated: 2026-06-26T05:58:16.044Z
Target: DATA_FRESHNESS_GUARD_READY
Overall status: stale

| Source | Status | Age Min | Threshold Min | Stale | Last Sync |
| --- | --- | --- | --- | --- | --- |
| Gmail | stale | 16794 | 120 | yes | 2026-06-14T14:03:57.278Z |
| Calendar | fresh | 29 | 120 | no | 2026-06-26T05:28:55.000Z |
| Drive | fresh | 29 | 240 | no | 2026-06-26T05:28:55.716Z |
| Sheets | fresh | 29 | 240 | no | 2026-06-26T05:28:58.288Z |
| Asana | fresh | 29 | 240 | no | 2026-06-26T05:29:04.755Z |
| Health | fresh | 29 | 1440 | no | 2026-06-26T05:29:04.760Z |
| Website bakudanramen.com | fresh | 921 | 1440 | no | 2026-06-25T14:36:56.324Z |
| Website rawsushibar.com | fresh | 921 | 1440 | no | 2026-06-25T14:36:56.324Z |
| QuickBooks | degraded | 0 | 1440 | no | 2026-06-26T05:58:16.025Z |
| Work Orders | fresh | 2730 | 2880 | no | 2026-06-24T08:28:02.137Z |
| Graph | fresh | 305 | 1440 | no | 2026-06-26T00:53:17.840Z |
| Memory | stale | 1797 | 1440 | yes | 2026-06-25T00:01:05.357Z |

Rules: fresh = within threshold, warning = degraded connector/error with timestamp, stale = beyond threshold/missing/error. Stale sources are escalated into the incident registry.