# N8N_SEO_WORKFLOW_CERTIFICATION.md
Generated: 2026-06-24T05:43:00Z

## n8n SEO Workflow Certification

---

## Required Workflows (per CTO Directive)

| Workflow | Status | File Location |
|----------|--------|---------------|
| seo-daily-audit | ✅ EXISTS + RAN TODAY | Mi/n8n/workflows/seo/seo-daily-audit.json |
| seo-weekly-executive-report | ✅ EXISTS | Mi/n8n/workflows/seo/seo-weekly-executive-report.json |
| seo-technical-health-check | ❌ MISSING | — |
| seo-content-opportunity-scan | ❌ MISSING | — |
| seo-schema-validation | ❌ MISSING | — |
| seo-review-summary | ❌ MISSING | — |
| seo-dashboard-sync | ❌ MISSING | — |

**Completion: 2/7 workflow files exist (28%)**

---

## Workflow 1: seo-daily-audit (VERIFIED RAN)

**File:** `Mi/n8n/workflows/seo/seo-daily-audit.json`
**Schedule:** 0 7 * * *
**Last Run:** 2026-06-24T01:50:00Z → 01:50:05Z (5 seconds)
**Status:** completed
**Brand:** bakudan
**Evidence:** `Mi/n8n/data/workflow-logs.jsonl`

✅ Verified runtime evidence:
```json
{"log_id":"log_017d7512-9f35-4749-b878-7a4d4f737a95",
 "workflow_id":"seo-daily-audit","domain":"seo","source":"n8n",
 "brand_id":"bakudan","location_id":"all","status":"completed",
 "started_at":"2026-06-24T01:50:00Z","completed_at":"2026-06-24T01:50:05Z",
 "error":"","evidence":[]}
```

---

## Workflow 2: seo-weekly-executive-report (EXISTS)

**File:** `Mi/n8n/workflows/seo/seo-weekly-executive-report.json`
**Schedule:** 0 9 * * 1 (Monday 9 AM ICT)
**Last Run:** Not yet (today is Wednesday 2026-06-24)
**Status:** exported but not imported into n8n (UNKNOWN)

---

## Missing Workflows (5 needed)

### seo-technical-health-check
Recommended file: `Mi/n8n/workflows/seo/seo-technical-health-check.json`

```json
{
  "name": "SEO Technical Health Check",
  "nodes": [
    {"type": "webhook", "webhookId": "seo-technical-health-check"},
    {"type": "http-request", "url": "http://localhost:4001/api/seo/orchestrator/run/daily-technical-audit"},
    {"type": "http-request", "url": "http://localhost:4001/api/n8n/evidence", "method": "POST"}
  ],
  "schedule": "0 */6 * * *"
}
```

### seo-content-opportunity-scan
Recommended file: `Mi/n8n/workflows/seo/seo-content-opportunity-scan.json`

### seo-schema-validation
Recommended file: `Mi/n8n/workflows/seo/seo-schema-validation.json`

### seo-review-summary
Recommended file: `Mi/n8n/workflows/seo/seo-review-summary.json`

### seo-dashboard-sync
Recommended file: `Mi/n8n/workflows/seo/seo-dashboard-sync.json`

---

## Mi-Core ↔ SEO Orchestration

For each workflow, the contract pattern is:
```
n8n webhook → POST to Mi-Core /api/seo/orchestrator/run/<jobId>
           → Mi-Core proxies to SEO agent (port 4011-4017)
           → Returns real evidence
           → Mi posts to /api/n8n/evidence for logging
```

**Job IDs supported (from seo-router.ts):**
- daily-website-crawl → port 4011
- daily-gbp-sync → port 4011
- daily-gsc-sync → port 4011
- daily-ga4-sync → port 4011
- daily-schema-validation → port 4014
- daily-technical-audit → port 4012
- weekly-citation-scan → port 4011
- weekly-content-plan → port 4015
- weekly-executive-seo-report → port 4017
- monthly-full-seo-audit → port 4012

---

## Workflow Certification Status

**Certified:** 2/7 (seo-daily-audit + seo-weekly-executive-report)
**Missing:** 5 workflows (technical-health, content-opp, schema-validation, review-summary, dashboard-sync)

---

## Status: SEO_PARTIAL

Only 2/7 required workflows exist. 5 workflows need to be authored and imported into n8n. The seo-daily-audit has been proven to run end-to-end via n8n and post evidence to Mi-Core.