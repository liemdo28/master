# EXECUTIVE_RUNTIME_SNAPSHOT

Generated: 2026-06-24T08:16:02.375Z
Target: EXECUTIVE_SNAPSHOT_READY
Burn-in score: 0
QB status: degraded
Health status: fresh

## Connector Health
| Connector | Auth | Health | Last Sync |
| --- | --- | --- | --- |
| Master Workspace (Local) | connected | healthy | 2026-06-24T08:15:57.074Z |
| Dashboard bakudanramen.com | connected | healthy | 2026-06-24T08:15:57.151Z |
| Asana | connected | healthy | 2026-06-24T07:46:08.543Z |
| Gmail | connected | healthy | 2026-06-14T14:03:57.278Z |
| Google Calendar | connected | healthy | 2026-06-20T08:40:36.358Z |
| Google Drive | connected | healthy | 2026-06-20T08:40:37.132Z |
| Huawei Health Export | connected | healthy | 2026-06-24T07:46:08.547Z |
| rawsushibar.com | connected | healthy | 2026-06-24T07:46:09.007Z |
| bakudanramen.com | connected | healthy | 2026-06-24T07:46:09.006Z |
| Accounting Engine | connected | healthy | 2026-06-24T07:46:08.553Z |
| Food Safety Gateway | connected | healthy | 2026-06-24T07:46:08.560Z |
| WhatsApp (Mi Gateway) | connected | healthy | 2026-06-13T14:44:12.122Z |
| QuickBooks Runtime | connected | degraded | 2026-06-24T08:16:02.340Z |
| Google Sheets | connected | degraded | 2026-06-24T08:16:01.204Z |

## Stale Sources
| Source | Status | Age Min | Threshold Min | Escalation |
| --- | --- | --- | --- | --- |
| Gmail | stale | 14052 | 120 | escalated |
| Calendar | stale | 5735 | 120 | escalated |
| Drive | stale | 5735 | 240 | escalated |
| Sheets | degraded | 0 | 240 | watch |
| QuickBooks | degraded | 0 | 1440 | watch |
| Work Orders | stale | 11809 | 2880 | escalated |

## Failed Workflows
| Type | Source | Summary | First Seen | Recurrence |
| --- | --- | --- | --- | --- |
| runtime_failure | Agent Engine | Agent Engine unknown | 2026-06-14T15:48:58.502Z | 95 |
| sync_failure | Gmail | Gmail freshness stale | 2026-06-14T16:05:16.431Z | 94 |
| runtime_failure | Visibility | Visibility degraded | 2026-06-14T17:42:06.074Z | 91 |
| runtime_failure | QB Connector | QB Connector degraded | 2026-06-14T17:42:06.075Z | 91 |
| sync_failure | QuickBooks | QuickBooks freshness degraded | 2026-06-14T17:42:06.076Z | 90 |
| sync_failure | Work Orders | Work Orders freshness stale | 2026-06-18T05:28:16.113Z | 56 |
| sync_failure | Calendar | Calendar freshness stale | 2026-06-22T01:38:09.920Z | 25 |
| sync_failure | Drive | Drive freshness stale | 2026-06-22T01:38:09.921Z | 25 |
| sync_failure | Sheets | Sheets freshness degraded | 2026-06-22T01:38:09.922Z | 25 |