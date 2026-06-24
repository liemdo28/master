# N8N-Mi Core Contract

**Version:** 1.0.0
**Date:** 2026-06-24

---

## Purpose

Define the contract between **n8n (Automation Fabric)** and **Mi-Core (Brain)**. Every n8n workflow must obey this contract. Mi-Core is the brain; n8n is the fabric.

---

## Endpoint Inventory

All endpoints live under Mi-Core at `http://127.0.0.1:4001` (or `MI_CORE_URL` env).

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/mi/intake/event` | optional | Register an inbound event |
| POST | `/api/mi/decision/request` | required | Request decision from Mi-Core |
| POST | `/api/mi/approval/request` | required | Request approval for an action |
| POST | `/api/mi/tasks/dispatch` | required | Dispatch a task to a Mi agent |
| POST | `/api/mi/tasks/complete` | required | Mark a task complete |
| POST | `/api/mi/workflows/log` | required | Log workflow execution |
| GET | `/api/mi/workflows/status` | required | Read workflow status |
| GET | `/api/mi/automation/dashboard` | required | Full automation overview |

Auth: `Authorization: Bearer <MI_API_KEY>` where `MI_API_KEY` matches `MI_CORE_API_KEY` in Mi-Core `.env`.

---

## Endpoint Specifications

### POST /api/mi/intake/event

**Purpose:** Register an event from n8n with Mi-Core before doing anything else.

**Request body:**
```json
{
  "source": "n8n",
  "domain": "seo",
  "event_type": "seo_daily_audit_request",
  "brand_id": "bakudan",
  "location_id": "all",
  "payload": { ... },
  "started_at": "2026-06-24T01:43:00Z"
}
```

**Response (200):**
```json
{
  "ok": true,
  "event_id": "evt_<uuid>",
  "received_at": "2026-06-24T01:43:00.123Z"
}
```

---

### POST /api/mi/decision/request

**Purpose:** Request Mi-Core to decide whether to proceed.

**Request body:**
```json
{
  "workflow_id": "seo-daily-audit",
  "domain": "seo",
  "action": "daily_audit",
  "brand_id": "all",
  "location_id": "all",
  "decision_needed": "approve_seo_audit_execution"
}
```

**Response (200):**
```json
{
  "ok": true,
  "decision_id": "dec_<uuid>",
  "approved": true,
  "reason": "Daily audit is within approved policy",
  "decided_at": "2026-06-24T01:43:01Z"
}
```

---

### POST /api/mi/approval/request

**Purpose:** Request CEO/operator approval for an action.

**Request body:**
```json
{
  "workflow_id": "review-monitoring",
  "domain": "reviews",
  "action": "review_auto_reply",
  "brand_id": "bakudan",
  "decision_needed": "auto_reply_or_manual_review",
  "context": {
    "review_text": "...",
    "sentiment": "positive",
    "suggested_reply": "..."
  }
}
```

**Response (200):**
```json
{
  "ok": true,
  "approval_id": "apr_<uuid>",
  "approved": false,
  "status": "pending",
  "polling_url": "/api/mi/approval/<id>/status"
}
```

---

### POST /api/mi/tasks/dispatch

**Purpose:** Dispatch a task to a Mi-Core agent.

**Request body:**
```json
{
  "domain": "seo",
  "action": "daily_audit",
  "brand_id": "all",
  "location_id": "all",
  "task_id": "tsk_<uuid>",
  "params": { ... }
}
```

**Response (200):**
```json
{
  "ok": true,
  "task_id": "tsk_<uuid>",
  "status": "dispatched",
  "agent": "seo-orchestrator"
}
```

---

### POST /api/mi/tasks/complete

**Purpose:** Mark a dispatched task as complete.

**Request body:**
```json
{
  "task_id": "tsk_<uuid>",
  "status": "completed",
  "result": { ... },
  "completed_at": "2026-06-24T01:43:05Z"
}
```

**Response (200):**
```json
{
  "ok": true,
  "task_id": "tsk_<uuid>",
  "status": "completed"
}
```

---

### POST /api/mi/workflows/log

**Purpose:** Persist workflow execution log back to Mi-Core.

**Request body:**
```json
{
  "workflow_id": "seo-daily-audit",
  "domain": "seo",
  "source": "n8n",
  "brand_id": "all",
  "location_id": "all",
  "task_id": "tsk_<uuid>",
  "status": "completed",
  "started_at": "2026-06-24T01:43:00Z",
  "completed_at": "2026-06-24T01:43:05Z",
  "error": "",
  "evidence": [ ... ]
}
```

**Response (200):**
```json
{
  "ok": true,
  "log_id": "log_<uuid>",
  "persisted_at": "2026-06-24T01:43:05.123Z"
}
```

---

### GET /api/mi/workflows/status

**Purpose:** Read current workflow status for dashboard.

**Query params:**
- `domain` (optional) — filter by domain
- `brand_id` (optional) — filter by brand
- `since` (optional, ISO8601) — only logs after this time
- `limit` (optional, default 50)

**Response (200):**
```json
{
  "ok": true,
  "count": 50,
  "workflows": [
    {
      "workflow_id": "seo-daily-audit",
      "status": "completed",
      "last_run": "2026-06-24T01:43:05Z",
      "success_rate": 0.98,
      "domain": "seo"
    }
  ]
}
```

---

### GET /api/mi/automation/dashboard

**Purpose:** Aggregated dashboard view for  
the CEO Home dashboard.  
  
**Response (200):**  
```json  
{  
  "ok": true,  
  "summary": {  
    "total_workflows": 7,  
    "active": 7,  
    "failing": 0,  
    "last_24h_runs": 47,  
    "success_rate": 0.96  
  },  
  "by_domain": {  
    "seo": { "runs_24h": 12, "success_rate": 1.0 },  
    "reviews": { "runs_24h": 24, "success_rate": 0.95 },  
    "food-safety": { "runs_24h": 1, "success_rate": 1.0 },  
    "quickbooks": { "runs_24h": 1, "success_rate": 1.0 },  
    "doordash": { "runs_24h": 1, "success_rate": 1.0 },  
    "system": { "runs_24h": 288, "success_rate": 0.99 }  
  },  
  "approvals_pending": 0,  
  "events_24h": 47  
}  
```  
  
---  
  
## Persistent Log Storage  
  
All POST requests to /api/mi/* are persisted as JSON files in `E:\Project\Master\Mi\n8n\data\`:  
  
- `events.jsonl` - all intake events (append-only)  
- `decisions.jsonl` - all decision requests  
- `approvals.jsonl` - all approval requests  
- `tasks.jsonl` - all task dispatches and completions  
- `workflow-logs.jsonl` - all workflow execution logs  
  
These files are backed up nightly via `backup-n8n.bat` to `Mi\n8n\backups\`.  
  
---  
  
## Implementation Notes  
  
The 8 contract endpoints are implemented as lightweight Express routes inside Mi-Core's compiled `dist/index.js`. Each route:  
  
1. Validates the request body (brand_id, location_id, workflow_id are required fields).  
2. Appends the record to the corresponding `.jsonl` file in `Mi\n8n\data\`.  
3. Returns a structured JSON response with the generated ID and timestamp.  
4. Increments in-memory counters for the dashboard endpoint.  
  
These routes act as a **persistent bridge** between n8n and Mi-Core. When Mi-Core's full decision/approval engines are ready to consume these events, they will read from the `.jsonl` files (or subscribe via the GET endpoints).  
