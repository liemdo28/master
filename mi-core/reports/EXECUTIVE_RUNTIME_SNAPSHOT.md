# EXECUTIVE_RUNTIME_SNAPSHOT

Generated: 2026-06-24T07:16:02.687Z
Target: EXECUTIVE_SNAPSHOT_READY
Burn-in score: 0
QB status: degraded
Health status: fresh

## Connector Health
| Connector | Auth | Health | Last Sync |
| --- | --- | --- | --- |
| Master Workspace (Local) | connected | healthy | 2026-06-24T07:15:56.992Z |
| Dashboard bakudanramen.com | connected | healthy | 2026-06-24T07:15:57.096Z |
| Asana | connected | healthy | 2026-06-24T06:46:08.117Z |
| Gmail | connected | healthy | 2026-06-14T14:03:57.278Z |
| Google Calendar | connected | healthy | 2026-06-20T08:40:36.358Z |
| Google Drive | connected | healthy | 2026-06-20T08:40:37.132Z |
| Huawei Health Export | connected | healthy | 2026-06-24T06:46:08.126Z |
| rawsushibar.com | connected | healthy | 2026-06-24T06:46:08.594Z |
| bakudanramen.com | connected | healthy | 2026-06-24T06:46:08.593Z |
| Accounting Engine | connected | healthy | 2026-06-24T06:46:08.133Z |
| Food Safety Gateway | connected | healthy | 2026-06-24T06:46:08.142Z |
| WhatsApp (Mi Gateway) | connected | healthy | 2026-06-13T14:44:12.122Z |
| QuickBooks Runtime | connected | degraded | 2026-06-24T07:16:02.661Z |
| Google Sheets | connected | degraded | 2026-06-24T07:16:00.956Z |

## Stale Sources
| Source | Status | Age Min | Threshold Min | Escalation |
| --- | --- | --- | --- | --- |
| Gmail | stale | 13992 | 120 | escalated |
| Calendar | stale | 5675 | 120 | escalated |
| Drive | stale | 5675 | 240 | escalated |
| Sheets | degraded | 0 | 240 | watch |
| QuickBooks | degraded | 0 | 1440 | watch |
| Work Orders | stale | 11749 | 2880 | escalated |

## Failed Workflows
| Type | Source | Summary | First Seen | Recurrence |
| --- | --- | --- | --- | --- |
| runtime_failure | Mi-Core | Mi-Core down | 2026-06-14T15:47:19.780Z | 23 |
| runtime_failure | Agent Engine | Agent Engine unknown | 2026-06-14T15:48:58.502Z | 94 |
| sync_failure | Gmail | Gmail freshness stale | 2026-06-14T16:05:16.431Z | 93 |
| runtime_failure | Visibility | Visibility degraded | 2026-06-14T17:42:06.074Z | 90 |
| runtime_failure | QB Connector | QB Connector degraded | 2026-06-14T17:42:06.075Z | 90 |
| sync_failure | QuickBooks | QuickBooks freshness degraded | 2026-06-14T17:42:06.076Z | 89 |
| sync_failure | Work Orders | Work Orders freshness stale | 2026-06-18T05:28:16.113Z | 55 |
| sync_failure | Calendar | Calendar freshness stale | 2026-06-22T01:38:09.920Z | 24 |
| sync_failure | Drive | Drive freshness stale | 2026-06-22T01:38:09.921Z | 24 |
| sync_failure | Sheets | Sheets freshness degraded | 2026-06-22T01:38:09.922Z | 24 |