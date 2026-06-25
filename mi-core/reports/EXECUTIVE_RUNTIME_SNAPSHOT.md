# EXECUTIVE_RUNTIME_SNAPSHOT

Generated: 2026-06-25T08:49:10.423Z
Target: EXECUTIVE_SNAPSHOT_READY
Burn-in score: 16
QB status: degraded
Health status: fresh

## Connector Health
| Connector | Auth | Health | Last Sync |
| --- | --- | --- | --- |
| Master Workspace (Local) | connected | healthy | 2026-06-25T08:49:02.502Z |
| Dashboard bakudanramen.com | connected | healthy | 2026-06-25T08:49:02.545Z |
| Asana | connected | healthy | 2026-06-25T08:20:09.463Z |
| Gmail | connected | healthy | 2026-06-14T14:03:57.278Z |
| Google Calendar | connected | healthy | 2026-06-25T08:19:49.151Z |
| Google Drive | connected | healthy | 2026-06-25T08:19:49.827Z |
| Huawei Health Export | connected | healthy | 2026-06-25T08:20:09.473Z |
| rawsushibar.com | connected | healthy | 2026-06-25T08:20:10.044Z |
| bakudanramen.com | connected | healthy | 2026-06-25T08:20:10.043Z |
| Accounting Engine | connected | healthy | 2026-06-25T08:20:09.482Z |
| Food Safety Gateway | connected | healthy | 2026-06-25T08:20:09.494Z |
| WhatsApp (Mi Gateway) | connected | healthy | 2026-06-13T14:44:12.122Z |
| QuickBooks Runtime | connected | degraded | 2026-06-25T08:49:10.388Z |
| Google Sheets | connected | healthy | 2026-06-25T08:19:51.916Z |

## Stale Sources
| Source | Status | Age Min | Threshold Min | Escalation |
| --- | --- | --- | --- | --- |
| Gmail | stale | 15525 | 120 | escalated |
| QuickBooks | degraded | 0 | 1440 | watch |

## Failed Workflows
| Type | Source | Summary | First Seen | Recurrence |
| --- | --- | --- | --- | --- |
| runtime_failure | Agent Engine | Agent Engine unknown | 2026-06-14T15:48:58.502Z | 109 |
| sync_failure | Gmail | Gmail freshness stale | 2026-06-14T16:05:16.431Z | 108 |
| runtime_failure | Visibility | Visibility degraded | 2026-06-14T17:42:06.074Z | 105 |
| runtime_failure | QB Connector | QB Connector degraded | 2026-06-14T17:42:06.075Z | 105 |
| sync_failure | QuickBooks | QuickBooks freshness degraded | 2026-06-14T17:42:06.076Z | 104 |
| runtime_failure | AI Service | AI Service down | 2026-06-18T02:25:49.698Z | 16 |