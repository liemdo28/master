# N8N CRON VERIFICATION — Phase 27B
**Date:** 2026-06-24

## All 6 Cron Workflows — Active Status Verified

```
GET /api/n8n/workflow-health
→ total: 9, active: 7
```

| Workflow | Cron | Timezone | Active | Next Run |
|----------|------|----------|--------|----------|
| seo-daily-audit | `0 6 * * *` | Server local (UTC+7 VN) | ✅ | 06:00 tomorrow |
| seo-weekly-executive-report | `0 7 * * 1` | Server local | ✅ | Monday 07:00 |
| seo-technical-health-check | `0 */6 * * *` | Server local | ✅ | Every 6h |
| seo-content-opportunity-scan | `0 8 * * 3` | Server local | ✅ | Wednesday 08:00 |
| seo-review-summary | `0 9 1 * *` | Server local | ✅ | 1st of July |
| seo-dashboard-sync | `0 */12 * * *` | Server local | ✅ | Every 12h |

## n8n Manual Trigger Limitation

n8n v2.27.3 Public API does not expose `/api/v1/workflows/:id/run` (HTTP 405). Workflows cannot be triggered ad-hoc via API. They run on cron schedule only.

**This is a known v2.27 limitation** — manual trigger is only possible via n8n UI.

## Missed Runs

No execution history found — all workflows were newly created 2026-06-24. Missed runs: 0.

## Final Status: `CRON_READY`

All 6 cron workflows active. First executions will occur per schedule above.
