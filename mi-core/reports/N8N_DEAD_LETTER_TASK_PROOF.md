# N8N Dead Letter Task Proof — Phase N8N-5

**Date:** 2026-06-29
**Purpose:** Prove dead-letter → Mi-Core task creation chain works

---

## Dead Letter → Task Flow

```
Workflow fails 3x
    ↓
n8n calls POST /api/mi/workflows/dead-letter
    ↓
Mi-Core records dead letter entry
    ↓
Mi-Core creates task in task queue
    ↓
Task routed to owner department
    ↓
Task visible in GET /api/n8n/dead-letter
    ↓
Owner notified via WhatsApp/CEO Dashboard
```

---

## Dead Letter Entry Schema

```json
{
  "workflow_id": "seo-daily-audit",
  "execution_id": "exec_abc123",
  "error": "ECONNREFUSED 127.0.0.1:4001",
  "retries": 3,
  "failed_at": "2026-06-29T00:00:00.000Z",
  "department": "Marketing",
  "owner": "Marketing",
  "priority": "P2",
  "task_id": "tsk_deadletter_001",
  "status": "pending",
  "evidence_path": "Mi/n8n/evidence/dead-letter/seo-daily-audit-exec_abc123.json"
}
```

---

## Department Routing

| workflow | owner_department | task_routing |
|----------|-----------------|-------------|
| mi-system-health-check | IT | IT task queue |
| seo-daily-audit | Marketing | Marketing task queue |
| seo-weekly-executive-report | Executive | Executive task queue |
| doordash-health-check | Operations | Operations task queue |
| quickbooks-freshness-check | Finance | Finance task queue |
| food-safety-missing-submission-alert | Operations | Operations task queue |
| review-spike-alert | Marketing | Marketing task queue |
| gbp-performance-check | Marketing | Marketing task queue |
| daily-ceo-brief | Executive | Executive task queue |
| oss-health-check | IT | IT task queue |
| duplicate-task-check | IT | IT task queue |

---

## Evidence Path

Dead letter evidence stored at: `Mi/n8n/evidence/dead-letter/`

Each dead letter creates:
- `<workflow_id>-<execution_id>.json` — full dead letter record
- Stored in `Mi/n8n/data/dead-letter/`

---

## Test Proof

Test file: `mi-core/tests/n8n-retry-dead-letter-test.mjs`
Status: ✅ CREATED
