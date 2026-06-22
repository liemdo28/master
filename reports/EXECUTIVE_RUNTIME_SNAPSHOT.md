# EXECUTIVE_RUNTIME_SNAPSHOT

Generated: 2026-06-22T02:38:09.709Z
Target: EXECUTIVE_SNAPSHOT_READY
Burn-in score: 0
QB status: degraded
Health status: fresh

## Connector Health
| Connector | Auth | Health | Last Sync |
| --- | --- | --- | --- |
| Master Workspace (Local) | connected | healthy | 2026-06-22T02:38:04.593Z |
| Dashboard bakudanramen.com | connected | healthy | 2026-06-22T02:38:04.681Z |
| Asana | connected | healthy | 2026-06-22T02:08:14.256Z |
| Gmail | connected | healthy | 2026-06-14T14:03:57.278Z |
| Google Calendar | connected | healthy | 2026-06-20T08:40:36.358Z |
| Google Drive | connected | healthy | 2026-06-20T08:40:37.132Z |
| Huawei Health Export | connected | healthy | 2026-06-22T02:08:14.261Z |
| rawsushibar.com | connected | healthy | 2026-06-22T02:08:14.723Z |
| bakudanramen.com | connected | healthy | 2026-06-22T02:08:14.723Z |
| Accounting Engine | connected | healthy | 2026-06-22T02:08:14.263Z |
| Food Safety Gateway | connected | healthy | 2026-06-22T02:08:14.271Z |
| WhatsApp (Mi Gateway) | connected | healthy | 2026-06-13T14:44:12.122Z |
| QuickBooks Runtime | connected | degraded | 2026-06-22T02:38:09.669Z |
| Google Sheets | connected | degraded | 2026-06-22T02:38:09.450Z |

## Stale Sources
| Source | Status | Age Min | Threshold Min | Escalation |
| --- | --- | --- | --- | --- |
| Gmail | stale | 10834 | 120 | escalated |
| Calendar | stale | 2518 | 120 | escalated |
| Drive | stale | 2518 | 240 | escalated |
| Sheets | degraded | 0 | 240 | watch |
| QuickBooks | degraded | 0 | 1440 | watch |
| Work Orders | stale | 8591 | 2880 | escalated |
| Memory | stale | 3037 | 1440 | escalated |

## Failed Workflows
| Type | Source | Summary | First Seen | Recurrence |
| --- | --- | --- | --- | --- |
| runtime_failure | Agent Engine | Agent Engine unknown | 2026-06-14T15:48:58.502Z | 72 |
| sync_failure | Gmail | Gmail freshness stale | 2026-06-14T16:05:16.431Z | 71 |
| runtime_failure | Visibility | Visibility degraded | 2026-06-14T17:42:06.074Z | 68 |
| runtime_failure | QB Connector | QB Connector degraded | 2026-06-14T17:42:06.075Z | 68 |
| sync_failure | QuickBooks | QuickBooks freshness degraded | 2026-06-14T17:42:06.076Z | 67 |
| sync_failure | Work Orders | Work Orders freshness stale | 2026-06-18T05:28:16.113Z | 33 |
| sync_failure | Memory | Memory freshness stale | 2026-06-19T07:36:06.841Z | 16 |
| sync_failure | Calendar | Calendar freshness stale | 2026-06-22T01:38:09.920Z | 2 |
| sync_failure | Drive | Drive freshness stale | 2026-06-22T01:38:09.921Z | 2 |
| sync_failure | Sheets | Sheets freshness degraded | 2026-06-22T01:38:09.922Z | 2 |