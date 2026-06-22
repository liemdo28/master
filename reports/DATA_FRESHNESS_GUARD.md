# DATA_FRESHNESS_GUARD

Generated: 2026-06-22T02:38:09.689Z
Target: DATA_FRESHNESS_GUARD_READY
Overall status: stale

| Source | Status | Age Min | Threshold Min | Stale | Last Sync |
| --- | --- | --- | --- | --- | --- |
| Gmail | stale | 10834 | 120 | yes | 2026-06-14T14:03:57.278Z |
| Calendar | stale | 2518 | 120 | yes | 2026-06-20T08:40:36.358Z |
| Drive | stale | 2518 | 240 | yes | 2026-06-20T08:40:37.132Z |
| Sheets | degraded | 0 | 240 | no | 2026-06-22T02:38:09.450Z |
| Asana | fresh | 30 | 240 | no | 2026-06-22T02:08:14.256Z |
| Health | fresh | 30 | 1440 | no | 2026-06-22T02:08:14.261Z |
| Website bakudanramen.com | fresh | 30 | 1440 | no | 2026-06-22T02:08:14.723Z |
| Website rawsushibar.com | fresh | 30 | 1440 | no | 2026-06-22T02:08:14.723Z |
| QuickBooks | degraded | 0 | 1440 | no | 2026-06-22T02:38:09.669Z |
| Work Orders | stale | 8591 | 2880 | yes | 2026-06-16T03:27:31.657Z |
| Graph | fresh | 0 | 1440 | no | 2026-06-22T02:38:02.868Z |
| Memory | stale | 3037 | 1440 | yes | 2026-06-20T00:01:00.988Z |

Rules: fresh = within threshold, warning = degraded connector/error with timestamp, stale = beyond threshold/missing/error. Stale sources are escalated into the incident registry.