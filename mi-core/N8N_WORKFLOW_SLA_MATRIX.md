# N8N WORKFLOW SLA MATRIX — Phase 27A
**Date:** 2026-06-24  
**Audited:** 7 production SEO workflows + 1 failure handler + 1 sandbox test

---

## Workflow Inventory

| # | ID | Name | Domain | Owner | Schedule | Active | Timeout | Retry | Failure Alert | Risk |
|---|-----|------|--------|-------|----------|--------|---------|-------|---------------|------|
| 1 | tyo9YyRg7tsLDCLR | seo-daily-audit | SEO | marketing | 0 6 * * * (06:00 daily) | ✅ | 120s | ⚠️ n8n-level | ✅ mi-failure-alert-handler | MEDIUM |
| 2 | vOT8BoqZhD3flsml | seo-weekly-executive-report | SEO | marketing | 0 7 * * 1 (Mon 07:00) | ✅ | 120s | ⚠️ n8n-level | ✅ mi-failure-alert-handler | LOW |
| 3 | tzP1elP8fJXibHCI | seo-technical-health-check | SEO | marketing | 0 */6 * * * (every 6h) | ✅ | 120s | ⚠️ n8n-level | ✅ mi-failure-alert-handler | MEDIUM |
| 4 | YuGiYN3ZQqClxoIE | seo-content-opportunity-scan | SEO | marketing | 0 8 * * 3 (Wed 08:00) | ✅ | 120s | ⚠️ n8n-level | ✅ mi-failure-alert-handler | LOW |
| 5 | 6PbvrfUXTfEIUoO9 | seo-schema-validation | SEO | marketing | webhook (on-demand) | ✅ | 120s | ⚠️ n8n-level | ✅ mi-failure-alert-handler | LOW |
| 6 | G23aM8msRDCwTZ6O | seo-review-summary | SEO | marketing | 0 9 1 * * (1st of month) | ✅ | 120s | ⚠️ n8n-level | ✅ mi-failure-alert-handler | LOW |
| 7 | m4XB9jBgiOqWBBec | seo-dashboard-sync | SEO | marketing | 0 */12 * * * (every 12h) | ✅ | 120s | ⚠️ n8n-level | ✅ mi-failure-alert-handler | LOW |
| 8 | Ad8BGOHc1mxBKbRr | mi-failure-alert-handler | OPS | operations | Error trigger | ❌ inactive | — | N/A | Self | HIGH |
| 9 | Qc6R97dLKQygyT0x | mi-sandbox-failure-test | TEST | — | manual only | ❌ inactive | 30s | N/A | N/A | TEST |

> ⚠️ Retry: n8n free tier does not expose per-workflow retry settings via API. Retry is handled at the Mi-Core level via `/api/mi/workflows/failure` auto-task creation.

## Evidence Output

All 6 cron workflows POST evidence to `POST /api/n8n/evidence` as last node.

## Mi-Core Callback

```
POST http://127.0.0.1:4001/api/n8n/evidence    ← success evidence
POST http://127.0.0.1:4001/api/mi/workflows/failure  ← failure alert
```

## Status: `WORKFLOW_INVENTORY_COMPLETE`
