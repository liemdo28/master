# EXECUTIVE_RUNTIME_SNAPSHOT

Generated: 2026-06-20T07:44:44.180Z
Target: EXECUTIVE_SNAPSHOT_READY
Burn-in score: 1
QB status: degraded
Health status: fresh

## Connector Health
| Connector | Auth | Health | Last Sync |
| --- | --- | --- | --- |
| Master Workspace (Local) | connected | healthy | 2026-06-20T07:44:36.305Z |
| Dashboard bakudanramen.com | connected | healthy | 2026-06-20T07:44:36.356Z |
| Asana | connected | healthy | 2026-06-20T07:05:48.817Z |
| Gmail | connected | healthy | 2026-06-14T14:03:57.278Z |
| Google Calendar | connected | healthy | 2026-06-20T07:05:39.691Z |
| Google Drive | connected | healthy | 2026-06-20T07:05:40.429Z |
| Huawei Health Export | connected | healthy | 2026-06-20T07:05:48.823Z |
| rawsushibar.com | connected | healthy | 2026-06-20T07:05:49.632Z |
| bakudanramen.com | connected | healthy | 2026-06-20T07:05:49.632Z |
| Accounting Engine | connected | healthy | 2026-06-20T07:05:48.827Z |
| Food Safety Gateway | connected | healthy | 2026-06-20T07:05:49.138Z |
| WhatsApp (Mi Gateway) | connected | healthy | 2026-06-13T14:44:12.122Z |
| QuickBooks Runtime | connected | degraded | 2026-06-20T07:44:44.148Z |
| Google Sheets | connected | healthy | 2026-06-20T07:05:41.869Z |

## Stale Sources
| Source | Status | Age Min | Threshold Min | Escalation |
| --- | --- | --- | --- | --- |
| Gmail | stale | 8261 | 120 | escalated |
| QuickBooks | degraded | 0 | 1440 | watch |
| Work Orders | stale | 6017 | 2880 | escalated |

## Failed Workflows
| Type | Source | Summary | First Seen | Recurrence |
| --- | --- | --- | --- | --- |
| runtime_failure | Mi-Core | Mi-Core down | 2026-06-14T15:47:19.780Z | 19 |
| runtime_failure | Agent Engine | Agent Engine unknown | 2026-06-14T15:48:58.502Z | 70 |
| sync_failure | Gmail | Gmail freshness stale | 2026-06-14T16:05:16.431Z | 69 |
| runtime_failure | Visibility | Visibility degraded | 2026-06-14T17:42:06.074Z | 66 |
| runtime_failure | QB Connector | QB Connector degraded | 2026-06-14T17:42:06.075Z | 66 |
| sync_failure | QuickBooks | QuickBooks freshness degraded | 2026-06-14T17:42:06.076Z | 65 |
| sync_failure | Work Orders | Work Orders freshness stale | 2026-06-18T05:28:16.113Z | 31 |