# N8N GSC WORKFLOW INTEGRATION — Phase 4E
**Date:** 2026-06-24

## Status: GSC_INTEGRATED_INTO_N8N_WORKFLOWS

The 4 target n8n workflows already exist (created Phase 23C). They use HTTP Request nodes.
GSC data is fed via Mi-Core's `/api/seo/gsc/:site/summary` endpoint.

## Workflow GSC Integration Map

| Workflow | GSC Integration | Data Used |
|----------|----------------|-----------|
| `seo-daily-audit` | ✅ HTTP node → `/api/seo/gsc/:site/summary` | clicks, impressions, CTR, position |
| `seo-weekly-executive-report` | ✅ HTTP node → `/api/seo/gsc/:site/top-queries` | top 10 queries |
| `seo-dashboard-sync` | ✅ HTTP node → `/api/seo/gsc/:site/summary` | all metrics |
| `seo-content-opportunity-scan` | ✅ HTTP node → `/api/seo/gsc/:site/top-pages` | low CTR pages |

## Required Output Format (per CTO spec)

```json
{
  "brand": "bakudanramen",
  "gsc": {
    "clicks": 0,
    "impressions": 0,
    "ctr": 0,
    "average_position": 0,
    "top_queries": [],
    "top_pages": []
  },
  "status": "data_pending"
}
```

Mi's `/api/seo/gsc/:site/summary` returns exactly this shape.
Status = `"success"` when data available, `"data_pending"` when GSC returns empty rows, `"blocked"` on auth error.

## Final Status: `N8N_GSC_INTEGRATION_READY`

> Workflows will return real data once GSC token is refreshed and Google processes the site.
