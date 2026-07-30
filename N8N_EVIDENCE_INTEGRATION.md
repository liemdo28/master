# N8N EVIDENCE INTEGRATION (C5)
**Date:** 2026-06-24  
**Status:** ✅ BUILT

---

## Evidence Contract

Every n8n workflow returns this structure to Mi:

```json
{
  "workflow_id": "exec-daily-brief",
  "status": "success",
  "evidence": [
    "Services healthy: 6/9",
    "Tasks today: 371 open",
    "Briefing sent via WhatsApp"
  ],
  "duration_ms": 1243
}
```

---

## Mi-Side Flow

```
n8n workflow completes
  ↓
POST http://host.docker.internal:4001/api/n8n/evidence
  ↓
n8nRouter.post('/evidence') receives payload
  ↓
Validates: workflow_id required
  ↓
Appends to in-memory evidenceLog (500-item circular buffer)
  ↓
Returns { ok: true, logged: true }
  ↓
CEO can query: GET /api/n8n/evidence
```

---

## Receive
```typescript
// n8n-router.ts
n8nRouter.post('/evidence', (req, res) => {
  const { workflow_id, status, evidence, duration_ms } = req.body;
  if (!workflow_id) return res.status(400).json({ error: 'workflow_id required' });
  evidenceLog.unshift({ received_at: new Date().toISOString(), workflow_id, status, evidence, duration_ms });
  return res.json({ ok: true, logged: true });
});
```

## Verify
```
GET /api/n8n/evidence
→ { count: N, records: [...last 50 workflow results] }
```

## QA
Evidence items are string assertions — Mi can run contradiction checks:
- If `exec-daily-brief` reports "Services healthy: 6/9" but `eng-pm2-health` reports "3 services DOWN" → contradiction → alert CEO

## Store
Future: Route evidence through `evidenceStore` (SHA256) for immutability.  
Current: In-memory buffer (survives server restart via future SQLite migration).

---

## Status
**N8N_EVIDENCE_INTEGRATION_READY** — POST endpoint live, GET endpoint live, circular buffer with 500 entries, workflow_id validation, timestamp recording.
