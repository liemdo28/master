# EXECUTIVE_RUNTIME_SNAPSHOT

Generated: 2026-06-15T01:45:19.547Z
Target: EXECUTIVE_SNAPSHOT_READY
Burn-in score: 41
QB status: degraded
Health status: fresh

## Connector Health
| Connector | Auth | Health | Last Sync |
| --- | --- | --- | --- |
| Master Workspace (Local) | connected | healthy | 2026-06-15T01:45:13.954Z |
| Dashboard bakudanramen.com | connected | healthy | 2026-06-15T01:45:14.014Z |
| Asana | connected | healthy | 2026-06-15T01:16:06.185Z |
| Gmail | connected | healthy | 2026-06-14T14:03:57.278Z |
| Google Calendar | connected | healthy | 2026-06-15T01:15:55.067Z |
| Google Drive | connected | healthy | 2026-06-15T01:15:55.856Z |
| Huawei Health Export | connected | healthy | 2026-06-15T01:16:06.195Z |
| rawsushibar.com | connected | healthy | 2026-06-15T01:16:07.961Z |
| bakudanramen.com | connected | healthy | 2026-06-15T01:16:07.960Z |
| Accounting Engine | connected | healthy | 2026-06-15T01:16:06.198Z |
| Food Safety Gateway | connected | healthy | 2026-06-15T01:16:06.208Z |
| WhatsApp (Mi Gateway) | connected | healthy | 2026-06-13T14:44:12.122Z |
| QuickBooks Runtime | connected | degraded | 2026-06-15T01:45:19.533Z |
| Google Sheets | connected | healthy | 2026-06-15T01:15:58.312Z |

## Stale Sources
| Source | Status | Age Min | Threshold Min | Escalation |
| --- | --- | --- | --- | --- |
| Gmail | stale | 701 | 120 | escalated |
| QuickBooks | degraded | 0 | 1440 | watch |

## Failed Workflows
| Type | Source | Summary | First Seen | Recurrence |
| --- | --- | --- | --- | --- |
| runtime_failure | Agent Engine | Agent Engine unknown | 2026-06-14T15:48:58.502Z | 11 |
| sync_failure | Gmail | Gmail freshness stale | 2026-06-14T16:05:16.431Z | 10 |
| runtime_failure | Visibility | Visibility degraded | 2026-06-14T17:42:06.074Z | 8 |
| runtime_failure | QB Connector | QB Connector degraded | 2026-06-14T17:42:06.075Z | 8 |
| sync_failure | QuickBooks | QuickBooks freshness degraded | 2026-06-14T17:42:06.076Z | 8 |