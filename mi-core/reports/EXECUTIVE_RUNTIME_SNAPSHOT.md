# EXECUTIVE_RUNTIME_SNAPSHOT

Generated: 2026-06-25T13:06:04.220Z
Target: EXECUTIVE_SNAPSHOT_READY
Burn-in score: 16
QB status: degraded
Health status: fresh

## Connector Health
| Connector | Auth | Health | Last Sync |
| --- | --- | --- | --- |
| Master Workspace (Local) | connected | healthy | 2026-06-25T13:05:52.013Z |
| Dashboard bakudanramen.com | connected | healthy | 2026-06-25T13:05:52.059Z |
| Asana | connected | healthy | 2026-06-25T12:36:50.182Z |
| Gmail | connected | healthy | 2026-06-14T14:03:57.278Z |
| Google Calendar | connected | healthy | 2026-06-25T12:36:39.701Z |
| Google Drive | connected | healthy | 2026-06-25T12:36:40.415Z |
| Huawei Health Export | connected | healthy | 2026-06-25T12:36:50.190Z |
| rawsushibar.com | connected | healthy | 2026-06-25T12:36:50.952Z |
| bakudanramen.com | connected | healthy | 2026-06-25T12:36:50.951Z |
| Accounting Engine | connected | healthy | 2026-06-25T12:36:50.400Z |
| Food Safety Gateway | connected | healthy | 2026-06-25T12:36:50.410Z |
| WhatsApp (Mi Gateway) | connected | healthy | 2026-06-13T14:44:12.122Z |
| QuickBooks Runtime | connected | degraded | 2026-06-25T13:06:04.181Z |
| Google Sheets | connected | healthy | 2026-06-25T12:36:42.903Z |

## Stale Sources
| Source | Status | Age Min | Threshold Min | Escalation |
| --- | --- | --- | --- | --- |
| Gmail | stale | 15782 | 120 | escalated |
| QuickBooks | degraded | 0 | 1440 | watch |

## Failed Workflows
| Type | Source | Summary | First Seen | Recurrence |
| --- | --- | --- | --- | --- |
| runtime_failure | Mi-Core | Mi-Core down | 2026-06-14T15:47:19.780Z | 28 |
| runtime_failure | Agent Engine | Agent Engine unknown | 2026-06-14T15:48:58.502Z | 111 |
| sync_failure | Gmail | Gmail freshness stale | 2026-06-14T16:05:16.431Z | 110 |
| runtime_failure | Visibility | Visibility degraded | 2026-06-14T17:42:06.074Z | 107 |
| runtime_failure | QB Connector | QB Connector degraded | 2026-06-14T17:42:06.075Z | 107 |
| sync_failure | QuickBooks | QuickBooks freshness degraded | 2026-06-14T17:42:06.076Z | 106 |