# EXECUTIVE_RUNTIME_SNAPSHOT

Generated: 2026-06-24T11:54:33.710Z
Target: EXECUTIVE_SNAPSHOT_READY
Burn-in score: 16
QB status: degraded
Health status: fresh

## Connector Health
| Connector | Auth | Health | Last Sync |
| --- | --- | --- | --- |
| Master Workspace (Local) | connected | healthy | 2026-06-24T11:54:25.902Z |
| Dashboard bakudanramen.com | connected | healthy | 2026-06-24T11:54:25.994Z |
| Asana | connected | healthy | 2026-06-24T11:25:23.206Z |
| Gmail | connected | healthy | 2026-06-14T14:03:57.278Z |
| Google Calendar | connected | healthy | 2026-06-24T11:25:11.700Z |
| Google Drive | connected | healthy | 2026-06-24T11:25:12.540Z |
| Huawei Health Export | connected | healthy | 2026-06-24T11:25:23.211Z |
| rawsushibar.com | connected | healthy | 2026-06-24T11:25:23.842Z |
| bakudanramen.com | connected | healthy | 2026-06-24T11:25:23.841Z |
| Accounting Engine | connected | healthy | 2026-06-24T11:25:23.216Z |
| Food Safety Gateway | connected | healthy | 2026-06-24T11:25:23.223Z |
| WhatsApp (Mi Gateway) | connected | healthy | 2026-06-13T14:44:12.122Z |
| QuickBooks Runtime | connected | degraded | 2026-06-24T11:54:33.681Z |
| Google Sheets | connected | healthy | 2026-06-24T11:25:14.645Z |

## Stale Sources
| Source | Status | Age Min | Threshold Min | Escalation |
| --- | --- | --- | --- | --- |
| Gmail | stale | 14271 | 120 | escalated |
| QuickBooks | degraded | 0 | 1440 | watch |

## Failed Workflows
| Type | Source | Summary | First Seen | Recurrence |
| --- | --- | --- | --- | --- |
| runtime_failure | Mi-Core | Mi-Core down | 2026-06-14T15:47:19.780Z | 23 |
| runtime_failure | Agent Engine | Agent Engine unknown | 2026-06-14T15:48:58.502Z | 94 |
| sync_failure | Gmail | Gmail freshness stale | 2026-06-14T16:05:16.431Z | 93 |
| runtime_failure | Visibility | Visibility degraded | 2026-06-14T17:42:06.074Z | 90 |
| runtime_failure | QB Connector | QB Connector degraded | 2026-06-14T17:42:06.075Z | 90 |
| sync_failure | QuickBooks | QuickBooks freshness degraded | 2026-06-14T17:42:06.076Z | 89 |