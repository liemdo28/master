# EXECUTIVE_RUNTIME_SNAPSHOT

Generated: 2026-06-23T16:19:51.254Z
Target: EXECUTIVE_SNAPSHOT_READY
Burn-in score: 0
QB status: degraded
Health status: fresh

## Connector Health
| Connector | Auth | Health | Last Sync |
| --- | --- | --- | --- |
| Master Workspace (Local) | connected | healthy | 2026-06-23T16:19:45.611Z |
| Dashboard bakudanramen.com | connected | healthy | 2026-06-23T16:19:45.718Z |
| Asana | connected | healthy | 2026-06-23T15:49:59.322Z |
| Gmail | connected | healthy | 2026-06-14T14:03:57.278Z |
| Google Calendar | connected | healthy | 2026-06-20T08:40:36.358Z |
| Google Drive | connected | healthy | 2026-06-20T08:40:37.132Z |
| Huawei Health Export | connected | healthy | 2026-06-23T15:49:59.331Z |
| rawsushibar.com | connected | healthy | 2026-06-23T15:50:01.160Z |
| bakudanramen.com | connected | healthy | 2026-06-23T15:50:01.157Z |
| Accounting Engine | connected | healthy | 2026-06-23T15:49:59.334Z |
| Food Safety Gateway | connected | healthy | 2026-06-23T15:49:59.466Z |
| WhatsApp (Mi Gateway) | connected | healthy | 2026-06-13T14:44:12.122Z |
| QuickBooks Runtime | connected | degraded | 2026-06-23T16:19:51.227Z |
| Google Sheets | connected | degraded | 2026-06-23T16:19:46.040Z |

## Stale Sources
| Source | Status | Age Min | Threshold Min | Escalation |
| --- | --- | --- | --- | --- |
| Gmail | stale | 13096 | 120 | escalated |
| Calendar | stale | 4779 | 120 | escalated |
| Drive | stale | 4779 | 240 | escalated |
| Sheets | degraded | 0 | 240 | watch |
| QuickBooks | degraded | 0 | 1440 | watch |
| Work Orders | stale | 10852 | 2880 | escalated |
| Memory | stale | 5299 | 1440 | escalated |

## Failed Workflows
| Type | Source | Summary | First Seen | Recurrence |
| --- | --- | --- | --- | --- |
| runtime_failure | Agent Engine | Agent Engine unknown | 2026-06-14T15:48:58.502Z | 92 |
| sync_failure | Gmail | Gmail freshness stale | 2026-06-14T16:05:16.431Z | 91 |
| runtime_failure | Visibility | Visibility degraded | 2026-06-14T17:42:06.074Z | 88 |
| runtime_failure | QB Connector | QB Connector degraded | 2026-06-14T17:42:06.075Z | 88 |
| sync_failure | QuickBooks | QuickBooks freshness degraded | 2026-06-14T17:42:06.076Z | 87 |
| sync_failure | Work Orders | Work Orders freshness stale | 2026-06-18T05:28:16.113Z | 53 |
| sync_failure | Memory | Memory freshness stale | 2026-06-19T07:36:06.841Z | 36 |
| sync_failure | Calendar | Calendar freshness stale | 2026-06-22T01:38:09.920Z | 22 |
| sync_failure | Drive | Drive freshness stale | 2026-06-22T01:38:09.921Z | 22 |
| sync_failure | Sheets | Sheets freshness degraded | 2026-06-22T01:38:09.922Z | 22 |