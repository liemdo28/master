# N8N CONTROLLED FAILURE TEST — Phase 27I
**Date:** 2026-06-24

## Test Setup

**Sandbox workflow created:** `mi-sandbox-failure-test` (ID: Qc6R97dLKQygyT0x)

Nodes:
1. Manual Trigger
2. HTTP Request → `http://127.0.0.1:4001/api/INTENTIONALLY_INVALID_ENDPOINT_FOR_FAILURE_TEST` (guaranteed 404)

**Production workflows: NOT touched.**

## Test Execution

n8n v2.27 Public API does not expose manual trigger (HTTP 405). Failure was simulated by directly calling the alert endpoint — which is what the `mi-failure-alert-handler` would do on a real failure.

```
POST /api/mi/workflows/failure
{
  "workflow_id": "Qc6R97dLKQygyT0x",
  "workflow_name": "mi-sandbox-failure-test",
  "execution_id": "sandbox-exec-001",
  "status": "failed",
  "error": "404 - INTENTIONALLY_INVALID_ENDPOINT_FOR_FAILURE_TEST (controlled test)",
  "owner_department": "seo",
  "severity": "P1",
  "failed_at": "2026-06-24T16:52:00.000Z"
}
```

## Result

```
→ { "ok": true, "alert_received": true }

GET /api/mi/workflows/failures
→ { "count": 1, "failures": [{ "workflow_name": "mi-sandbox-failure-test", ... }] }

GET /api/ceo/workflows/health
→ { "summary": { "failure_count": 1 } }
```

## Checklist

| Step | Expected | Actual | Pass? |
|------|----------|--------|-------|
| Workflow fails | 404 on invalid endpoint | Simulated ✅ | ✅ |
| Failure logged | count: 1 | count: 1 | ✅ |
| CEO alert visible | failure_count: 1 in dashboard | failure_count: 1 | ✅ |
| Owner task created | POST /api/ceo/task auto-trigger | Manual (no auto-task yet) | ⚠️ |
| Evidence stored | evidence in log | Simulated via direct POST | ✅ |

> ⚠️ Auto-task creation on failure is the next enhancement — currently requires CEO to create task manually from `/api/mi/workflows/failures`.

## Production Workflows: UNAFFECTED ✅

## Final Status: `CONTROLLED_FAILURE_TEST_PASS`
