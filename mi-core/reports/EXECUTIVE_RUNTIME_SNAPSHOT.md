# EXECUTIVE_RUNTIME_SNAPSHOT

Generated: 2026-06-26T15:48:36.854Z
Target: EXECUTIVE_SNAPSHOT_READY
Burn-in score: 0
QB status: degraded
Health status: fresh

## Connector Health
| Connector | Auth | Health | Last Sync |
| --- | --- | --- | --- |
| Master Workspace (Local) | connected | healthy | 2026-06-26T15:48:31.437Z |
| Dashboard bakudanramen.com | connected | healthy | 2026-06-26T15:48:31.579Z |
| Asana | connected | healthy | 2026-06-26T15:19:31.884Z |
| Gmail | not_configured | offline |  |
| Google Calendar | not_configured | healthy | 2026-06-26T15:19:20.103Z |
| Google Drive | not_configured | healthy | 2026-06-26T15:19:20.786Z |
| Google Sheets | connected | healthy | 2026-06-26T15:19:23.353Z |
| Huawei Health Export | connected | healthy | 2026-06-26T15:19:31.888Z |
| rawsushibar.com | connected | healthy | 2026-06-26T15:19:32.669Z |
| bakudanramen.com | connected | healthy | 2026-06-26T15:19:32.668Z |
| Accounting Engine | connected | healthy | 2026-06-26T15:19:31.890Z |
| QuickBooks Runtime | connected | degraded | 2026-06-26T15:48:36.816Z |
| Food Safety Gateway | connected | healthy | 2026-06-26T15:19:31.896Z |

## Stale Sources
| Source | Status | Age Min | Threshold Min | Escalation |
| --- | --- | --- | --- | --- |
| QuickBooks | degraded | 0 | 1440 | watch |
| Work Orders | stale | 15141 | 2880 | escalated |
| Memory | stale | 2388 | 1440 | escalated |

## Failed Workflows
| Type | Source | Summary | First Seen | Recurrence |
| --- | --- | --- | --- | --- |
| runtime_failure | Mi-Core | Mi-Core down | 2026-06-26T14:49:30.488Z | 2 |
| runtime_failure | Agent Engine | Agent Engine unknown | 2026-06-26T14:49:30.488Z | 2 |
| runtime_failure | Visibility | Visibility degraded | 2026-06-26T14:49:30.489Z | 2 |
| runtime_failure | Gmail | Gmail degraded | 2026-06-26T14:49:30.490Z | 2 |
| runtime_failure | Calendar | Calendar degraded | 2026-06-26T14:49:30.490Z | 2 |
| runtime_failure | Drive | Drive degraded | 2026-06-26T14:49:30.491Z | 2 |
| runtime_failure | QB Connector | QB Connector degraded | 2026-06-26T14:49:30.492Z | 2 |
| sync_failure | QuickBooks | QuickBooks freshness degraded | 2026-06-26T14:49:30.493Z | 2 |
| sync_failure | Work Orders | Work Orders freshness stale | 2026-06-26T14:49:30.493Z | 2 |
| sync_failure | Memory | Memory freshness stale | 2026-06-26T14:49:30.494Z | 2 |