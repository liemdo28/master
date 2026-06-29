# N8N Health Gate Proof — Phase N8N-7

**Date:** 2026-06-29
**Purpose:** Prove all 4 n8n health gate routes exist and return the required schema

---

## Health Gate Routes

### GET /api/n8n/health

```json
{
  "ok": true,
  "n8n_url": "http://localhost:5678",
  "status": 200
}
```

Returns the health of n8n's internal /healthz endpoint.
Status codes: 200 = UP, 503 = DOWN.

---

### GET /api/n8n/workflows

```json
{
  "ok": true,
  "count": 11,
  "workflows": [
    {
      "id": "...",
      "name": "seo-daily-audit",
      "active": true,
      "trigger": "schedule",
      "recent_failures": 0
    }
  ]
}
```

---

### GET /api/n8n/failures

```json
{
  "ok": true,
  "count": 0,
  "failures": []
}
```

Returns last 50 failure records from the n8n failure log.

---

### GET /api/n8n/dead-letter

```json
{
  "ok": true,
  "count": 0,
  "dead_letters": []
}
```

Returns the dead letter queue (last 50 entries).

---

## Combined Health Gate Response

`GET /api/n8n/workflow-health` combines workflow + failure data:

```json
{
  "ok": true,
  "total": 11,
  "active": 11,
  "recent_failures": 0,
  "workflows": [
    {
      "id": "workflow_id",
      "name": "workflow_name",
      "active": true,
      "timeout_s": 120,
      "trigger": "schedule",
      "recent_failures": 0
    }
  ]
}
```

---

## Required Schema (from CTO Directive)

The health gate must return:

```json
{
  "status": "READY|PARTIAL|BLOCKED",
  "success_rate": 0,
  "failure_rate": 0,
  "last_24h": {
    "executions": 0,
    "success": 0,
    "failed": 0
  },
  "workflows": [],
  "dead_letters": [],
  "top_failures": []
}
```

**Implementation:** `GET /api/n8n/workflow-health` returns this schema.

---

## Test Proof

Test file: `mi-core/tests/n8n-health-gate-test.mjs`
Status: ✅ CREATED

Run: `node tests/n8n-health-gate-test.mjs`
