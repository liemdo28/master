# N8N CONTROL SERVICE (C2)
**Date:** 2026-06-24  
**Status:** ✅ BUILT AND WIRED

---

## Service Location
```
services/n8n-execution-bus/control/n8n-control-service.js
server/src/n8n/n8n-router.ts  (TypeScript — wired to Express)
```

## API Surface

### `listWorkflows()`
```
GET /api/n8n/workflows
Returns: { ok, count, workflows: [{ id, name, active, tags }] }
```

### `triggerWorkflow(workflowId, data?)`
```
POST /api/n8n/trigger/:id
Body: { ...any CEO data payload }
Returns: { ok, workflow_id, result }
Mechanism: POSTs to n8n webhook URL (/webhook/:id)
```

### `getExecution(executionId)`
```
GET /api/n8n/execution/:id
Returns: { ok, data: { id, workflow_id, status, started_at, finished_at } }
```

### `getExecutionLogs(executionId)`
```
GET /api/n8n/execution/:id/logs
Returns: { ok, status, nodes: [{ node, status, error }] }
```

### `stopExecution(executionId)`
```
DELETE /api/n8n/execution/:id
Returns: { ok, status }
```

### Evidence Callback (n8n → Mi)
```
POST /api/n8n/evidence
Body: {
  workflow_id: string,
  status: "success" | "error",
  evidence: [...],
  duration_ms: number
}
Returns: { ok: true, logged: true }

GET /api/n8n/evidence
Returns: { count, records: [...last 50] }
```

## Evidence Contract
Every n8n workflow MUST end with an HTTP Request node POSTing:
```json
{
  "workflow_id": "{{$workflow.id}}",
  "status": "{{$json.status}}",
  "evidence": ["{{$json.result}}"],
  "duration_ms": "{{$workflow.runAt}}"
}
```
to `http://host.docker.internal:4001/api/n8n/evidence`

## TypeScript Compilation
```
npx tsc --noEmit 2>&1 | grep -v node_modules
(no output — zero project errors)
```

## Status
**N8N_CONTROL_SERVICE_READY** — All 5 required APIs implemented and registered in Express.
