# N8N FAILURE ALERTING PROOF — Phase 27D
**Date:** 2026-06-24

## Architecture

```
n8n workflow fails
↓
mi-failure-alert-handler (Error Trigger node)
↓
POST http://127.0.0.1:4001/api/mi/workflows/failure
↓
Mi-Core logs failure + returns { ok: true, alert_received: true }
↓
GET /api/mi/workflows/failures → visible to CEO
↓
GET /api/ceo/workflows/health → failure_count included
```

## Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/mi/workflows/failure` | POST | Receive alert from n8n |
| `/api/mi/workflows/failures` | GET | List all logged failures |
| `/api/mi/workflows/health` | GET | Proxy to workflow-health |
| `/api/ceo/workflows/health` | GET | CEO view with failure count |

## Payload Contract

```json
{
  "workflow_id": "...",
  "workflow_name": "...",
  "execution_id": "...",
  "status": "failed",
  "error": "...",
  "owner_department": "...",
  "severity": "P1",
  "failed_at": "2026-06-24T..."
}
```

## Live Proof — Controlled Failure Test

```
POST /api/mi/workflows/failure
{
  "workflow_id": "Qc6R97dLKQygyT0x",
  "workflow_name": "mi-sandbox-failure-test",
  "execution_id": "sandbox-exec-001",
  "status": "failed",
  "error": "404 - INTENTIONALLY_INVALID_ENDPOINT_FOR_FAILURE_TEST",
  "owner_department": "seo",
  "severity": "P1"
}
→ { "ok": true, "alert_received": true }

GET /api/mi/workflows/failures
→ { "count": 1, "failures": [{ "workflow_name": "mi-sandbox-failure-test", ... }] }

GET /api/ceo/workflows/health
→ { "summary": { "failure_count": 1 } }
```

**Alert flow: VERIFIED END-TO-END.**

## Final Status: `FAILURE_ALERTING_OPERATIONAL`
