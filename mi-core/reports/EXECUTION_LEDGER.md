# Execution Ledger
**Module:** `src/gstack/execution-ledger.ts`  
**Storage:** `.local-agent-global/execution-ledger/ledger.jsonl`  
**Date:** 2026-06-13

---

## Principle

Every action taken by any agent is logged. The ledger is:
- **Immutable** — append-only JSONL file
- **Persistent** — survives PM2 restarts
- **Auditable** — source of truth for certification
- **Auto-rotating** — rotates at 10MB

---

## Entry Schema

```json
{
  "entry_id": "LE-1749791234567-0001",
  "ts": "2026-06-13T05:20:17.523Z",
  "work_order_id": "WO-20260613-007",
  "requested_by": "ceo",
  "agent_role": "engineering_manager",
  "action_type": "plan_technical_work",
  "target": "dashboard",
  "command_run": "pm2 jlist 2>nul",
  "files_changed": [],
  "test_result": null,
  "evidence": "4 technical task(s) planned | 3 auto-executable (safe) | 1 require approval",
  "verdict": "PENDING",
  "detail": "Tasks: T1[done], T2[done], T3[done], T4[pending]"
}
```

---

## Verdict Values

| Verdict | Meaning |
|---------|---------|
| `PASS` | Action completed successfully |
| `FAIL` | Action failed — details in evidence |
| `SKIP` | Action skipped (not applicable) |
| `PENDING` | Action in progress or blocked |
| `APPROVAL_REQUIRED` | Requires CEO approval before execution |

---

## Logged Actions

| Action Type | Agent Role |
|------------|-----------|
| `interpret_request` | ceo_interpreter |
| `define_scope` | product_manager |
| `plan_technical_work` | engineering_manager |
| `qa_sweep` | qa_agent |
| `audit_certification` | auditor_agent |
| `release_readiness_check` | release_agent |
| `pm2_restart` | release_agent |
| `compile_report` | product_manager |
| `pipeline_complete` | system |
| `pipeline_error` | system |

---

## API

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/gstack/ledger` | ✅ | Last 50 entries |
| GET | `/api/gstack/ledger?wo_id=WO-xxx` | ✅ | Entries for specific WO |
| GET | `/api/gstack/ledger/stats` | ✅ | Pass/fail counts by role |
| GET | `/api/gstack/ledger?limit=100` | ✅ | Custom limit |

---

## Stats Format

```json
{
  "total_entries": 47,
  "pass": 38,
  "fail": 4,
  "approval_required": 5,
  "by_role": {
    "ceo_interpreter": 7,
    "engineering_manager": 7,
    "qa_agent": 7,
    "auditor_agent": 7,
    "product_manager": 14,
    "system": 5
  }
}
```
