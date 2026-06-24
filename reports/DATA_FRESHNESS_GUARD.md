# DATA_FRESHNESS_GUARD

Generated: 2026-06-23T16:19:51.237Z
Target: DATA_FRESHNESS_GUARD_READY
Overall status: stale

| Source | Status | Age Min | Threshold Min | Stale | Last Sync |
| --- | --- | --- | --- | --- | --- |
| Gmail | stale | 13096 | 120 | yes | 2026-06-14T14:03:57.278Z |
| Calendar | stale | 4779 | 120 | yes | 2026-06-20T08:40:36.358Z |
| Drive | stale | 4779 | 240 | yes | 2026-06-20T08:40:37.132Z |
| Sheets | degraded | 0 | 240 | no | 2026-06-23T16:19:46.040Z |
| Asana | fresh | 30 | 240 | no | 2026-06-23T15:49:59.322Z |
| Health | fresh | 30 | 1440 | no | 2026-06-23T15:49:59.331Z |
| Website bakudanramen.com | fresh | 30 | 1440 | no | 2026-06-23T15:50:01.157Z |
| Website rawsushibar.com | fresh | 30 | 1440 | no | 2026-06-23T15:50:01.160Z |
| QuickBooks | degraded | 0 | 1440 | no | 2026-06-23T16:19:51.227Z |
| Work Orders | stale | 10852 | 2880 | yes | 2026-06-16T03:27:31.657Z |
| Graph | fresh | 0 | 1440 | no | 2026-06-23T16:19:46.904Z |
| Memory | stale | 5299 | 1440 | yes | 2026-06-20T00:01:00.988Z |

Rules: fresh = within threshold, warning = degraded connector/error with timestamp, stale = beyond threshold/missing/error. Stale sources are escalated into the incident registry.