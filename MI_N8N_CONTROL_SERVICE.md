# MI_N8N_CONTROL_SERVICE.md
Generated: 2026-06-24T05:42:00Z

## Mi ↔ n8n Control Service

**Status:** EXISTING (n8n-router.ts) but broken (auth 401)

---

## Current Implementation: `mi-core/server/src/n8n/n8n-router.ts`

Routes already implemented:

| Function | Route | Status | Evidence |
|----------|-------|--------|---------|
| listWorkflows() | GET /api/n8n/workflows | ❌ 401 | Wrong auth format |
| triggerWorkflow(id) | POST /api/n8n/trigger/:id | ⚠️ UNTESTED | Route exists |
| getExecution(id) | GET /api/n8n/execution/:id | ⚠️ UNTESTED | Route exists |
| getExecutionLogs(id) | GET /api/n8n/execution/:id/logs | ⚠️ UNTESTED | Route exists |
| stopExecution(id) | DELETE /api/n8n/execution/:id | ⚠️ UNTESTED | Route exists |
| collectEvidence() | POST /api/n8n/evidence | ✅ WORKS | Evidence received |

---

## Fix Required: Auth Header Update

**Current code (BROKEN):**
```typescript
const N8N_USER = process.env.N8N_USER || 'mi-admin';
const N8N_PASS = process.env.N8N_PASS || 'mi-n8n-secure-2025';

function authHeaders(): Record<string, string> {
  const b64 = Buffer.from(`${N8N_USER}:${N8N_PASS}`).toString('base64');
  return { 'Authorization': `Basic ${b64}`, 'Content-Type': 'application/json' };
}
```

**Fixed code:**
```typescript
const N8N_API_KEY = process.env.N8N_API_KEY || '';

function authHeaders(): Record<string, string> {
  return { 'X-N8N-API-KEY': N8N_API_KEY, 'Content-Type': 'application/json' };
}
```

**Steps to complete:**
1. Open http://localhost:5678 in browser
2. Login as n8n admin
3. Settings → API → Create API Key → copy
4. Add `N8N_API_KEY=<key>` to `mi-core/.env`
5. Update `n8n-router.ts` authHeaders function
6. Rebuild: `cd mi-core/server && npm run build`
7. Restart Mi-Core PM2 process

---

## Mi-n8n Contract (8 endpoints defined)

| Method | Endpoint | Purpose | Implementation |
|--------|----------|---------|----------------|
| POST | /api/mi/intake/event | Register inbound event | UNVERIFIED |
| POST | /api/mi/decision/request | Request decision from Mi-Core | UNVERIFIED |
| POST | /api/mi/approval/request | Request CEO approval | UNVERIFIED |
| POST | /api/mi/tasks/dispatch | Dispatch task to Mi agent | UNVERIFIED |
| POST | /api/mi/tasks/complete | Mark task complete | UNVERIFIED |
| POST | /api/mi/workflows/log | Log workflow execution | ✅ WORKS |
| GET | /api/mi/workflows/status | Read workflow status | UNVERIFIED |
| GET | /api/mi/automation/dashboard | Full automation overview | UNVERIFIED |

---

## Status: PARTIAL — Control service exists but auth blocks workflow operations
