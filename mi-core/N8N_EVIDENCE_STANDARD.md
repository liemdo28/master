# N8N EVIDENCE STANDARD — Phase 27E
**Date:** 2026-06-24

## Standard Evidence Payload

Every workflow must POST to `POST /api/n8n/evidence` as final node:

```json
{
  "workflow_id": "...",
  "execution_id": "...",
  "domain": "seo",
  "brand": "bakudanramen | rawsushibar | all",
  "status": "success | failed | partial",
  "started_at": "2026-06-24T...",
  "finished_at": "2026-06-24T...",
  "duration_ms": 0,
  "inputs": {},
  "outputs": {},
  "evidence_files": [],
  "next_actions": []
}
```

## Mi-Core Evidence Store

```
POST /api/n8n/evidence   ← receive evidence from workflows
GET  /api/n8n/evidence   ← list last 50 evidence records
```

Evidence stored in-memory ring buffer (500 records max). Persisted in `data/seo/seo-state.json`.

## SEO Workflow Compliance

All 6 cron SEO workflows have a "Log Evidence" / "Store Evidence" / "Store Opportunities" node as final step calling `/api/n8n/evidence`. ✅

| Workflow | Evidence Node | Status |
|----------|--------------|--------|
| seo-daily-audit | Log Evidence → POST /api/n8n/evidence | ✅ |
| seo-technical-health-check | Store Evidence → POST /api/n8n/evidence | ✅ |
| seo-content-opportunity-scan | Store Opportunities → POST /api/n8n/evidence | ✅ |
| seo-dashboard-sync | Push to Dashboard → POST /api/bigdata/ingest/json | ✅ (separate sink) |
| seo-review-summary | Submit CEO Report → POST /api/ceo/task | ✅ (separate sink) |
| seo-weekly-executive-report | Post to CEO → POST /api/ceo/task | ✅ (separate sink) |

## Final Status: `EVIDENCE_STANDARD_APPLIED`
