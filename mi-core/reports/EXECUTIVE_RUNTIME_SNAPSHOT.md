# EXECUTIVE_RUNTIME_SNAPSHOT

Generated: 2026-06-26T16:48:36.659Z
Target: EXECUTIVE_SNAPSHOT_READY
Burn-in score: 0
QB status: degraded
Health status: fresh

## Connector Health
| Connector | Auth | Health | Last Sync |
| --- | --- | --- | --- |
| Master Workspace (Local) | connected | healthy | 2026-06-26T16:48:31.408Z |
| Dashboard bakudanramen.com | connected | healthy | 2026-06-26T16:48:31.505Z |
| Asana | connected | healthy | 2026-06-26T16:19:30.835Z |
| Gmail | not_configured | offline |  |
| Google Calendar | not_configured | healthy | 2026-06-26T16:19:20.161Z |
| Google Drive | not_configured | healthy | 2026-06-26T16:19:20.845Z |
| Google Sheets | connected | healthy | 2026-06-26T16:19:23.133Z |
| Huawei Health Export | connected | healthy | 2026-06-26T16:19:30.841Z |
| rawsushibar.com | connected | healthy | 2026-06-26T16:19:31.778Z |
| bakudanramen.com | connected | healthy | 2026-06-26T16:19:31.777Z |
| Accounting Engine | connected | healthy | 2026-06-26T16:19:30.844Z |
| QuickBooks Runtime | connected | degraded | 2026-06-26T16:48:36.476Z |
| Food Safety Gateway | connected | healthy | 2026-06-26T16:19:30.855Z |

## Stale Sources
| Source | Status | Age Min | Threshold Min | Escalation |
| --- | --- | --- | --- | --- |
| QuickBooks | degraded | 0 | 1440 | watch |
| Work Orders | stale | 15201 | 2880 | escalated |
| Memory | stale | 2448 | 1440 | escalated |

## Failed Workflows
| Type | Source | Summary | First Seen | Recurrence |
| --- | --- | --- | --- | --- |
| runtime_failure | Agent Engine | Agent Engine unknown | 2026-06-26T14:49:30.488Z | 3 |
| runtime_failure | Visibility | Visibility degraded | 2026-06-26T14:49:30.489Z | 3 |
| runtime_failure | Gmail | Gmail degraded | 2026-06-26T14:49:30.490Z | 3 |
| runtime_failure | Calendar | Calendar degraded | 2026-06-26T14:49:30.490Z | 3 |
| runtime_failure | Drive | Drive degraded | 2026-06-26T14:49:30.491Z | 3 |
| runtime_failure | QB Connector | QB Connector degraded | 2026-06-26T14:49:30.492Z | 3 |
| sync_failure | QuickBooks | QuickBooks freshness degraded | 2026-06-26T14:49:30.493Z | 3 |
| sync_failure | Work Orders | Work Orders freshness stale | 2026-06-26T14:49:30.493Z | 3 |
| sync_failure | Memory | Memory freshness stale | 2026-06-26T14:49:30.494Z | 3 |