# EXECUTIVE_RUNTIME_SNAPSHOT

Generated: 2026-06-26T13:45:09.737Z
Target: EXECUTIVE_SNAPSHOT_READY
Burn-in score: 0
QB status: degraded
Health status: fresh

## Connector Health
| Connector | Auth | Health | Last Sync |
| --- | --- | --- | --- |
| Master Workspace (Local) | connected | healthy | 2026-06-26T13:45:04.440Z |
| Dashboard bakudanramen.com | connected | healthy | 2026-06-26T13:45:04.539Z |
| Asana | not_configured | healthy | 2026-06-26T13:16:00.881Z |
| Gmail | not_configured | offline |  |
| Google Calendar | not_configured | healthy | 2026-06-26T13:15:51.148Z |
| Google Drive | not_configured | healthy | 2026-06-26T13:15:51.886Z |
| Google Sheets | connected | healthy | 2026-06-26T13:15:53.996Z |
| Huawei Health Export | connected | healthy | 2026-06-26T13:16:00.887Z |
| rawsushibar.com | connected | healthy | 2026-06-26T13:16:01.549Z |
| bakudanramen.com | connected | healthy | 2026-06-26T13:16:01.548Z |
| Accounting Engine | connected | healthy | 2026-06-26T13:16:00.890Z |
| QuickBooks Runtime | connected | degraded | 2026-06-26T13:45:09.696Z |
| Food Safety Gateway | connected | healthy | 2026-06-26T13:16:00.899Z |

## Stale Sources
| Source | Status | Age Min | Threshold Min | Escalation |
| --- | --- | --- | --- | --- |
| QuickBooks | degraded | 0 | 1440 | watch |
| Work Orders | stale | 15018 | 2880 | escalated |
| Memory | stale | 2264 | 1440 | escalated |

## Failed Workflows
| Type | Source | Summary | First Seen | Recurrence |
| --- | --- | --- | --- | --- |
| runtime_failure | Agent Engine | Agent Engine unknown | 2026-06-26T11:45:03.479Z | 3 |
| runtime_failure | Visibility | Visibility degraded | 2026-06-26T11:45:03.479Z | 3 |
| runtime_failure | Gmail | Gmail degraded | 2026-06-26T11:45:03.480Z | 3 |
| runtime_failure | Calendar | Calendar degraded | 2026-06-26T11:45:03.481Z | 3 |
| runtime_failure | Drive | Drive degraded | 2026-06-26T11:45:03.482Z | 3 |
| runtime_failure | QB Connector | QB Connector degraded | 2026-06-26T11:45:03.483Z | 3 |
| sync_failure | QuickBooks | QuickBooks freshness degraded | 2026-06-26T11:45:03.483Z | 3 |
| sync_failure | Work Orders | Work Orders freshness stale | 2026-06-26T11:45:03.484Z | 3 |
| sync_failure | Memory | Memory freshness stale | 2026-06-26T11:45:03.485Z | 3 |
| runtime_failure | Mi-Core | Mi-Core down | 2026-06-26T12:45:09.893Z | 2 |