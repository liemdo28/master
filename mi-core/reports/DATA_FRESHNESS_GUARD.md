# DATA_FRESHNESS_GUARD

Generated: 2026-06-24T08:16:02.355Z
Target: DATA_FRESHNESS_GUARD_READY
Overall status: stale

| Source | Status | Age Min | Threshold Min | Stale | Last Sync |
| --- | --- | --- | --- | --- | --- |
| Gmail | stale | 14052 | 120 | yes | 2026-06-14T14:03:57.278Z |
| Calendar | stale | 5735 | 120 | yes | 2026-06-20T08:40:36.358Z |
| Drive | stale | 5735 | 240 | yes | 2026-06-20T08:40:37.132Z |
| Sheets | degraded | 0 | 240 | no | 2026-06-24T08:16:01.204Z |
| Asana | fresh | 30 | 240 | no | 2026-06-24T07:46:08.543Z |
| Health | fresh | 30 | 1440 | no | 2026-06-24T07:46:08.547Z |
| Website bakudanramen.com | fresh | 30 | 1440 | no | 2026-06-24T07:46:09.006Z |
| Website rawsushibar.com | fresh | 30 | 1440 | no | 2026-06-24T07:46:09.007Z |
| QuickBooks | degraded | 0 | 1440 | no | 2026-06-24T08:16:02.340Z |
| Work Orders | stale | 11809 | 2880 | yes | 2026-06-16T03:27:31.657Z |
| Graph | fresh | 120 | 1440 | no | 2026-06-24T06:15:56.070Z |
| Memory | fresh | 345 | 1440 | no | 2026-06-24T02:30:35.270Z |

Rules: fresh = within threshold, warning = degraded connector/error with timestamp, stale = beyond threshold/missing/error. Stale sources are escalated into the incident registry.