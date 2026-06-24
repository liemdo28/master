# N8N RETRY & TIMEOUT POLICY — Phase 27C
**Date:** 2026-06-24

## Applied Policy

| Parameter | Value | Applied To |
|-----------|-------|------------|
| `executionTimeout` | **120 seconds** | All 7 production workflows |
| Node-level timeout | 30 seconds | All HTTP Request nodes |
| Retry count | n8n free tier — no per-workflow API | Mi-Core compensates via failure tasks |
| Failure behavior | POST to `/api/mi/workflows/failure` → owner task created | All workflows via error handler |

## Verification

```
GET /api/n8n/workflow-health
→ seo-schema-validation: timeout=120
→ seo-review-summary: timeout=120
→ seo-content-opportunity-scan: timeout=120
→ seo-dashboard-sync: timeout=120
→ seo-daily-audit: timeout=120
→ seo-technical-health-check: timeout=120
→ seo-weekly-executive-report: timeout=120
```

## n8n Free Tier Retry Limitation

n8n v2.27 free license does not support workflow-level retry configuration via API. Per-execution retry is only configurable in paid plans. 

**Compensating control:** 
- On failure → `mi-failure-alert-handler` fires
- Alert POSTed to Mi-Core → failure logged + CEO task created
- CEO task triggers manual re-run decision

## High-Risk Workflows

`seo-daily-audit` and `seo-technical-health-check` are highest frequency (daily / every 6h). If they fail, the CEO failure alert fires within the same execution cycle.

## Final Status: `RETRY_TIMEOUT_POLICY_APPLIED`
