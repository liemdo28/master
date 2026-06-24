# N8N_DISCOVERY_REPORT.md
Generated: 2026-06-24T05:30:00Z

## n8n Control Status: MI_N8N_EXECUTION_BUS_READY (PARTIAL)

n8n is INSTALLED and RUNNING at port 5678.
Workflow registry has 7 workflows defined.
Evidence logging is active.
Mi-Core routes for n8n control are implemented.
HOWEVER: Mi-Core cannot list n8n workflows (401 auth — wrong credentials format).
Workflow JSON files exist but import status into n8n is UNKNOWN.

---

## n8n Installation

| Property | Value | Evidence |
|----------|-------|---------|
| n8n URL | http://localhost:5678 | Runtime verified |
| n8n Health | {"status":"ok"} | curl http://localhost:5678/healthz |
| n8n Database | C:\Users\liemdo\.n8n\database.sqlite | EXISTS |
| Workflow Registry | E:\Project\Master\Mi\n8n\config\workflow-registry.json | EXISTS |
| Workflow JSON Files | E:\Project\Master\Mi\n8n\workflows\ | EXISTS |
| Evidence Log | E:\Project\Master\Mi\n8n\data\workflow-logs.jsonl | EXISTS |
| Mi-N8N Contract | E:\Project\Master\Mi\n8n\N8N_MI_CORE_CONTRACT.md | EXISTS |
| Environment Config | E:\Project\Master\Mi\n8n\config\.env.example | EXISTS |

---

## Mi-Core n8n Routes

| Route | Method | Purpose | Status |
|-------|--------|---------|--------|
| /api/n8n/health | GET | n8n health check | ✅ WORKS |
| /api/n8n/workflows | GET | list n8n workflows | ❌ 401 Unauthorized |
| /api/n8n/trigger/:id | POST | trigger workflow | ⚠️ UNTESTED |
| /api/n8n/execution/:id | GET | get execution | ⚠️ UNTESTED |
| /api/n8n/execution/:id/logs | GET | get execution logs | ⚠️ UNTESTED |
| /api/n8n/execution/:id | DELETE | stop execution | ⚠️ UNTESTED |
| /api/n8n/evidence | POST | receive evidence callback | ✅ Implemented |
| /api/n8n/evidence | GET | read evidence log | ✅ Implemented |

---

## n8n Auth Issue

**Problem:** Mi-Core n8n-router.ts uses Basic Auth:
```typescript
const N8N_USER = process.env.N8N_USER || 'mi-admin';
const N8N_PASS = process.env.N8N_PASS || 'mi-n8n-secure-2025';
```
But n8n API requires API key authentication:
```
X-N8N-API-KEY header required
```

**Test:**
```bash
curl http://localhost:5678/api/v1/workflows
→ {"message":"'X-N8N-API-KEY' header required"}

curl http://localhost:5678/api/v1/workflows -u "mi-admin:mi-n8n-secure-2025"
→ {"message":"'X-N8N-API-KEY' header required"}
```

**Fix Required:** Update Mi-Core n8n-router.ts to use `X-N8N-API-KEY` header with the actual n8n API key from `C:\Users\liemdo\.n8n\database.sqlite`.

---

## Workflow Registry

7 workflows defined in registry. All marked "exported" (JSON files exist).

| Workflow ID | Domain | File | Approval Required | Mi Required |
|------------|--------|------|-------------------|-------------|
| mi-system-health-check | system | workflows/system/mi-system-health-check.json | no | yes |
| seo-daily-audit | seo | workflows/seo/seo-daily-audit.json | yes | yes |
| seo-weekly-executive-report | seo | workflows/seo/seo-weekly-executive-report.json | no | yes |
| review-monitoring | reviews | workflows/reviews/review-monitoring.json | yes | yes |
| food-safety-daily-reminder | food-safety | workflows/food-safety/food-safety-daily-reminder.json | yes | yes |
| quickbooks-daily-sync | quickbooks | workflows/quickbooks/quickbooks-daily-sync.json | no | yes |
| doordash-weekly-campaign-review | doordash | workflows/doordash/doordash-weekly-campaign-review.json | yes | yes |

---

## n8n Workflow Files

| Workflow | File Exists | Ran Today? |
|----------|-------------|------------|
| seo-daily-audit | ✅ | ✅ 01:50 UTC, completed in 5s |
| seo-weekly-executive-report | ✅ | ❌ Scheduled Monday |
| mi-system-health-check | ⚠️ Unknown | ⚠️ Unknown |
| review-monitoring | ⚠️ Unknown | ⚠️ Unknown |
| food-safety-daily-reminder | ⚠️ Unknown | ⚠️ Unknown |
| quickbooks-daily-sync | ⚠️ Unknown | ⚠️ Unknown |
| doordash-weekly-campaign-review | ⚠️ Unknown | ⚠️ Unknown |

---

## Evidence Log

Evidence log at `E:\Project\Master\Mi\n8n\data\workflow-logs.jsonl`:
```json
{"log_id":"log_017d7512-9f35-4749-b878-7a4d4f737a95",
 "workflow_id":"seo-daily-audit","domain":"seo","source":"n8n",
 "brand_id":"bakudan","location_id":"all","status":"completed",
 "started_at":"2026-06-24T01:50:00Z","completed_at":"2026-06-24T01:50:05Z","error":""}
```

---

## Can Mi Control n8n?

| Capability | Status | Evidence |
|-----------|--------|---------|
| Mi can check n8n health? | ✅ YES | /api/n8n/health |
| Mi can list workflows? | ❌ NO | 401 auth failure |
| Mi can trigger workflow? | ⚠️ UNTESTED | Route exists, auth may fail |
| Mi can get execution status? | ⚠️ UNTESTED | Route exists, auth may fail |
| Mi can stop execution? | ⚠️ UNTESTED | Route exists, auth may fail |
| Mi can receive evidence? | ✅ YES | /api/n8n/evidence |
| n8n can call Mi-Core? | ✅ YES | N8N_MI_CORE_CONTRACT defined |
| n8n can POST evidence to Mi? | ✅ YES | Mi_EVIDENCE_WEBHOOK configured |

---

## Issues

1. **n8n API key not in Mi-Core .env** — Wrong auth format (Basic vs API key)
2. **Mi cannot list workflows** — Blocks workflow discovery
3. **Trigger/stop execution untested** — Routes exist but auth may fail
4. **6/7 workflow files not verified** — Only seo-daily-audit confirmed executed
5. **n8n UI access unverified** — Cannot confirm browser access

---

## Required Fix (Phase C)

Update `mi-core/server/src/n8n/n8n-router.ts`:
1. Replace Basic Auth with `X-N8N-API-KEY` header
2. Read API key from `N8N_API_KEY` env var or extract from sqlite DB
3. Update `mi-core/.env` with the actual API key
4. Test `/api/n8n/workflows` returns workflow list
5. Verify at least 7 workflows are imported
