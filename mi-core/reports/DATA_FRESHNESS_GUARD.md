# DATA_FRESHNESS_GUARD

Generated: 2026-06-15T01:45:19.538Z
Target: DATA_FRESHNESS_GUARD_READY
Overall status: stale

| Source | Status | Age Min | Threshold Min | Stale | Last Sync |
| --- | --- | --- | --- | --- | --- |
| Gmail | stale | 701 | 120 | yes | 2026-06-14T14:03:57.278Z |
| Calendar | fresh | 29 | 120 | no | 2026-06-15T01:15:55.067Z |
| Drive | fresh | 29 | 240 | no | 2026-06-15T01:15:55.856Z |
| Sheets | fresh | 29 | 240 | no | 2026-06-15T01:15:58.312Z |
| Asana | fresh | 29 | 240 | no | 2026-06-15T01:16:06.185Z |
| Health | fresh | 29 | 1440 | no | 2026-06-15T01:16:06.195Z |
| Website bakudanramen.com | fresh | 29 | 1440 | no | 2026-06-15T01:16:07.960Z |
| Website rawsushibar.com | fresh | 29 | 1440 | no | 2026-06-15T01:16:07.961Z |
| QuickBooks | degraded | 0 | 1440 | no | 2026-06-15T01:45:19.533Z |
| Work Orders | fresh | 2091 | 2880 | no | 2026-06-13T14:54:18.677Z |
| Graph | fresh | 60 | 1440 | no | 2026-06-15T00:45:12.896Z |
| Memory | fresh | 16 | 1440 | no | 2026-06-15T01:28:50.665Z |

Rules: fresh = within threshold, warning = degraded connector/error with timestamp, stale = beyond threshold/missing/error. Stale sources are escalated into the incident registry.