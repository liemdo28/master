# Work Order Engine
**Module:** `src/gstack/work-order-engine.ts`  
**Date:** 2026-06-13

---

## Purpose

Every CEO request — regardless of complexity — becomes a **structured Work Order** before any action is taken. No ad-hoc execution. No silent work. No untracked changes.

---

## Work Order Schema

```json
{
  "request_id": "WO-20260613-001",
  "created_at": "2026-06-13T05:20:00.000Z",
  "updated_at": "2026-06-13T05:20:17.500Z",
  "source": "whatsapp",
  "requested_by": "ceo",
  "raw_request": "Mi ơi, kiểm tra Dashboard...",
  "intent": {
    "intent": "audit_project",
    "confidence": 82,
    "target_project": "dashboard",
    "risk_level": 1,
    "requires_approval": false
  },
  "priority": "P3",
  "target_project": "dashboard",
  "assigned_role": "qa_agent",
  "acceptance_criteria": ["All issues categorized", "Safe fixes applied", "Evidence provided"],
  "evidence_required": ["test_results", "health_check_output", "error_log_scan"],
  "execution_plan": [
    { "step_id": "S1", "role": "ceo_interpreter", "action": "Interpret and scope request", "status": "done" },
    { "step_id": "S2", "role": "product_manager", "action": "Define acceptance criteria", "status": "done" }
  ],
  "qa_plan": [
    { "check_id": "QA1", "name": "Regression suite", "type": "regression", "status": "pass" },
    { "check_id": "QA3", "name": "Service health", "type": "test", "status": "pass" }
  ],
  "status": "delivered",
  "execution_log": [...],
  "result": {
    "verdict": "PARTIAL",
    "confidence_score": 78,
    "findings": [...],
    "fixed": [],
    "tested": [...],
    "needs_approval": []
  }
}
```

---

## Lifecycle

```
created → assigned → executing → qa_pending → [approval_pending] → delivered
                                                                  ↘ rejected
                                                                  ↘ cancelled
```

---

## Priority System

| Priority | Trigger |
|----------|---------|
| P0 | "khẩn cấp", "production crash", "critical" |
| P1 | fix_bug (risk≥2), deploy_release, rollback |
| P2 | build_feature |
| P3 | audit, status check, report, knowledge search |

---

## Role Assignment

| Intent | Assigned Role |
|--------|--------------|
| fix_bug | engineering_manager |
| audit_project | qa_agent |
| build_feature | engineering_manager |
| deploy_release | release_agent |
| rollback | release_agent |
| check_status | qa_agent |
| create_report | product_manager |
| search_knowledge | ceo_interpreter |

---

## Storage

Work orders stored as individual JSON files:
- Path: `.local-agent-global/work-orders/WO-YYYYMMDD-NNN.json`
- Persistent across restarts
- Queryable via API: `GET /api/gstack/orders`

---

## API

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/gstack/process` | ✅ | Submit CEO request |
| GET | `/api/gstack/orders` | ✅ | List work orders |
| GET | `/api/gstack/orders/:id` | ✅ | Get specific WO |
| GET | `/api/gstack/intent?text=` | ✅ | Classify intent only |
| GET | `/api/gstack/health` | ❌ | Module health |
