# DATA_FRESHNESS_GUARD

Generated: 2026-06-25T02:23:06.889Z
Target: DATA_FRESHNESS_GUARD_READY
Overall status: stale

| Source | Status | Age Min | Threshold Min | Stale | Last Sync |
| --- | --- | --- | --- | --- | --- |
| Gmail | stale | 15139 | 120 | yes | 2026-06-14T14:03:57.278Z |
| Calendar | fresh | 29 | 120 | no | 2026-06-25T01:53:38.151Z |
| Drive | fresh | 29 | 240 | no | 2026-06-25T01:53:39.055Z |
| Sheets | fresh | 29 | 240 | no | 2026-06-25T01:53:42.036Z |
| Asana | fresh | 29 | 240 | no | 2026-06-25T01:53:48.886Z |
| Health | fresh | 29 | 1440 | no | 2026-06-25T01:53:48.893Z |
| Website bakudanramen.com | fresh | 29 | 1440 | no | 2026-06-25T01:53:49.393Z |
| Website rawsushibar.com | fresh | 29 | 1440 | no | 2026-06-25T01:53:49.394Z |
| QuickBooks | degraded | 0 | 1440 | no | 2026-06-25T02:23:06.862Z |
| Work Orders | fresh | 1075 | 2880 | no | 2026-06-24T08:28:02.137Z |
| Graph | fresh | 60 | 1440 | no | 2026-06-25T01:22:51.827Z |
| Memory | fresh | 142 | 1440 | no | 2026-06-25T00:01:05.357Z |

Rules: fresh = within threshold, warning = degraded connector/error with timestamp, stale = beyond threshold/missing/error. Stale sources are escalated into the incident registry.