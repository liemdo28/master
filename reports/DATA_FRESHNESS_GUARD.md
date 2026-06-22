# DATA_FRESHNESS_GUARD

Generated: 2026-06-20T07:44:44.167Z
Target: DATA_FRESHNESS_GUARD_READY
Overall status: stale

| Source | Status | Age Min | Threshold Min | Stale | Last Sync |
| --- | --- | --- | --- | --- | --- |
| Gmail | stale | 8261 | 120 | yes | 2026-06-14T14:03:57.278Z |
| Calendar | fresh | 39 | 120 | no | 2026-06-20T07:05:39.691Z |
| Drive | fresh | 39 | 240 | no | 2026-06-20T07:05:40.429Z |
| Sheets | fresh | 39 | 240 | no | 2026-06-20T07:05:41.869Z |
| Asana | fresh | 39 | 240 | no | 2026-06-20T07:05:48.817Z |
| Health | fresh | 39 | 1440 | no | 2026-06-20T07:05:48.823Z |
| Website bakudanramen.com | fresh | 39 | 1440 | no | 2026-06-20T07:05:49.632Z |
| Website rawsushibar.com | fresh | 39 | 1440 | no | 2026-06-20T07:05:49.632Z |
| QuickBooks | degraded | 0 | 1440 | no | 2026-06-20T07:44:44.148Z |
| Work Orders | stale | 6017 | 2880 | yes | 2026-06-16T03:27:31.657Z |
| Graph | fresh | 250 | 1440 | no | 2026-06-20T03:34:33.601Z |
| Memory | fresh | 464 | 1440 | no | 2026-06-20T00:01:00.988Z |

Rules: fresh = within threshold, warning = degraded connector/error with timestamp, stale = beyond threshold/missing/error. Stale sources are escalated into the incident registry.