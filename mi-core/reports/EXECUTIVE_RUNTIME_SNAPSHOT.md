# EXECUTIVE_RUNTIME_SNAPSHOT

Generated: 2026-06-26T05:58:16.064Z
Target: EXECUTIVE_SNAPSHOT_READY
Burn-in score: 26
QB status: degraded
Health status: fresh

## Connector Health
| Connector | Auth | Health | Last Sync |
| --- | --- | --- | --- |
| Master Workspace (Local) | connected | healthy | 2026-06-26T05:58:07.793Z |
| Dashboard bakudanramen.com | connected | healthy | 2026-06-26T05:58:07.794Z |
| Asana | connected | healthy | 2026-06-26T05:29:04.755Z |
| Gmail | connected | healthy | 2026-06-14T14:03:57.278Z |
| Google Calendar | connected | healthy | 2026-06-26T05:28:55.000Z |
| Google Drive | connected | healthy | 2026-06-26T05:28:55.716Z |
| Huawei Health Export | connected | healthy | 2026-06-26T05:29:04.760Z |
| rawsushibar.com | connected | healthy | 2026-06-25T14:36:56.324Z |
| bakudanramen.com | connected | healthy | 2026-06-25T14:36:56.324Z |
| Accounting Engine | connected | healthy | 2026-06-26T05:29:04.764Z |
| Food Safety Gateway | connected | healthy | 2026-06-26T05:29:04.771Z |
| WhatsApp (Mi Gateway) | connected | healthy | 2026-06-13T14:44:12.122Z |
| QuickBooks Runtime | connected | degraded | 2026-06-26T05:58:16.025Z |
| Google Sheets | connected | healthy | 2026-06-26T05:28:58.288Z |

## Stale Sources
| Source | Status | Age Min | Threshold Min | Escalation |
| --- | --- | --- | --- | --- |
| Gmail | stale | 16794 | 120 | escalated |
| QuickBooks | degraded | 0 | 1440 | watch |
| Memory | stale | 1797 | 1440 | escalated |

## Failed Workflows
| Type | Source | Summary | First Seen | Recurrence |
| --- | --- | --- | --- | --- |
| runtime_failure | Agent Engine | Agent Engine unknown | 2026-06-14T15:48:58.502Z | 122 |
| sync_failure | Gmail | Gmail freshness stale | 2026-06-14T16:05:16.431Z | 121 |
| runtime_failure | Visibility | Visibility degraded | 2026-06-14T17:42:06.074Z | 118 |
| runtime_failure | QB Connector | QB Connector degraded | 2026-06-14T17:42:06.075Z | 118 |
| sync_failure | QuickBooks | QuickBooks freshness degraded | 2026-06-14T17:42:06.076Z | 117 |
| sync_failure | Memory | Memory freshness stale | 2026-06-19T07:36:06.841Z | 41 |