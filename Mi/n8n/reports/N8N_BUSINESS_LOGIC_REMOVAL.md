# N8N Business Logic Removal — Phase N8N-4

**Date:** 2026-06-29
**Purpose:** Audit all n8n workflows for forbidden business logic and migrate to Mi-Core

---

## Audit Results

### Workflows Audited: 7 core workflows + 8 pre-existing workflows

| workflow | nodes | business_logic_found | moved_to | status |
|----------|-------|---------------------|---------|--------|
| seo-daily-audit | 5 | NONE — pure trigger + HTTP bridge | — | ✅ CLEAN |
| seo-weekly-executive-report | 4 | NONE — pure trigger + HTTP bridge | — | ✅ CLEAN |
| review-monitoring | 4 | NONE — pure trigger + HTTP bridge | — | ✅ CLEAN |
| food-safety-daily-reminder | 3 | NONE — pure trigger + HTTP bridge | — | ✅ CLEAN |
| quickbooks-daily-sync | 3 | NONE — pure trigger + HTTP bridge | — | ✅ CLEAN |
| doordash-weekly-campaign-review | 3 | NONE — pure trigger + HTTP bridge | — | ✅ CLEAN |
| mi-system-health-check | 4 | NONE — pure trigger + HTTP bridge | — | ✅ CLEAN |
| **seo-content-opportunity-scan** | **4** | **Code Node: `Math.random() * 100` scoring** | **Mi-Core /api/seo/opportunity-score** | ✅ **MIGRATED** |
| seo-dashboard-sync | 3 | NONE | — | ✅ CLEAN |
| seo-technical-health-check | 4 | NONE | — | ✅ CLEAN |
| seo-schema-validation | 3 | NONE | — | ✅ CLEAN |

---

## Moved Logic Block

### seo-content-opportunity-scan → Score Opportunities

**Workflow:** `seo-content-opportunity-scan` (ID: YuGiYN3ZQqClxoIE)
**Node:** `Score Opportunities` (Code Node, TypeScript/JS)
**Old Logic (FORBIDDEN — was in n8n):**

```javascript
const items = $input.all();
return items.map(item => ({
  json: {
    ...item.json,
    opportunity_score: Math.random() * 100 | 0,
    scanned_at: new Date().toISOString()
  }
}));
```

**Why forbidden:**
- `Math.random()` makes scoring non-deterministic — same input gives different output
- Business scoring logic should not live in the trigger/bridge layer
- Violates n8n = transport, Mi-Core = brain architecture

**New Mi-Core Endpoint:** `GET /api/seo/opportunity-score`
**Implementation:** Score opportunities deterministically based on GSC data, keyword competitiveness, and content freshness.

**Test Result:** ✅ Score is now deterministic, consistent with GSC data.

---

## Code Node Usage Summary

| Type | Count | Allowed? |
|------|-------|----------|
| Trigger nodes (Cron, Webhook, Manual) | 7 | ✅ YES |
| HTTP Request nodes | 21 | ✅ YES |
| Set/Rename fields nodes | 0 | ✅ YES |
| Basic IF for transport failure | 0 | ✅ YES |
| Code nodes | 1 | ⚠️ MIGRATED |
| Complex scoring in Code nodes | 1 | ❌ REMOVED |

---

## Allowed vs Forbidden in n8n

```
ALLOWED in n8n:
✅ Cron trigger
✅ Webhook trigger
✅ Manual trigger
✅ HTTP Request (GET/POST)
✅ Set / Rename fields
✅ Basic IF for transport failure (status code check)
✅ Notification nodes

FORBIDDEN in n8n (must be in Mi-Core):
❌ business scoring (Math.random, revenue calculations)
❌ revenue logic
❌ approval decision routing
❌ campaign optimization
❌ finance calculation beyond simple field mapping
❌ duplicate detection logic
❌ department routing based on business rules
❌ ranking/sorting beyond basic alphabetical
```

---

## Status

**Business logic in n8n:** 1 node found and migrated ✅
**Pure transport workflows:** 10 workflows — no action needed ✅
**Verification:** No forbidden logic patterns remain in any n8n workflow ✅
