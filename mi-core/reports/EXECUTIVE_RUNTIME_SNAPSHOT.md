# EXECUTIVE_RUNTIME_SNAPSHOT

Generated: 2026-06-25T02:23:06.931Z
Target: EXECUTIVE_SNAPSHOT_READY
Burn-in score: 16
QB status: degraded
Health status: fresh

## Connector Health
| Connector | Auth | Health | Last Sync |
| --- | --- | --- | --- |
| Master Workspace (Local) | connected | healthy | 2026-06-25T02:22:57.248Z |
| Dashboard bakudanramen.com | connected | healthy | 2026-06-25T02:22:57.755Z |
| Asana | connected | healthy | 2026-06-25T01:53:48.886Z |
| Gmail | connected | healthy | 2026-06-14T14:03:57.278Z |
| Google Calendar | connected | healthy | 2026-06-25T01:53:38.151Z |
| Google Drive | connected | healthy | 2026-06-25T01:53:39.055Z |
| Huawei Health Export | connected | healthy | 2026-06-25T01:53:48.893Z |
| rawsushibar.com | connected | healthy | 2026-06-25T01:53:49.394Z |
| bakudanramen.com | connected | healthy | 2026-06-25T01:53:49.393Z |
| Accounting Engine | connected | healthy | 2026-06-25T01:53:48.897Z |
| Food Safety Gateway | connected | healthy | 2026-06-25T01:53:48.905Z |
| WhatsApp (Mi Gateway) | connected | healthy | 2026-06-13T14:44:12.122Z |
| QuickBooks Runtime | connected | degraded | 2026-06-25T02:23:06.862Z |
| Google Sheets | connected | healthy | 2026-06-25T01:53:42.036Z |

## Stale Sources
| Source | Status | Age Min | Threshold Min | Escalation |
| --- | --- | --- | --- | --- |
| Gmail | stale | 15139 | 120 | escalated |
| QuickBooks | degraded | 0 | 1440 | watch |

## Failed Workflows
| Type | Source | Summary | First Seen | Recurrence |
| --- | --- | --- | --- | --- |
| runtime_failure | Mi-Core | Mi-Core down | 2026-06-14T15:47:19.780Z | 27 |
| runtime_failure | Agent Engine | Agent Engine unknown | 2026-06-14T15:48:58.502Z | 104 |
| sync_failure | Gmail | Gmail freshness stale | 2026-06-14T16:05:16.431Z | 103 |
| runtime_failure | Visibility | Visibility degraded | 2026-06-14T17:42:06.074Z | 100 |
| runtime_failure | QB Connector | QB Connector degraded | 2026-06-14T17:42:06.075Z | 100 |
| sync_failure | QuickBooks | QuickBooks freshness degraded | 2026-06-14T17:42:06.076Z | 99 |