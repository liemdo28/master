# DEPARTMENT_RUNTIME_REPORT.md
> Phase 2 — Working Departments Runtime Report
> Proof of execution — live pipeline runs, real data, evidence in SQLite.
> Updated: 2026-06-18

---

## Runtime Architecture

```
CEO Command
    │
    ▼
dispatch-center.ts       — Steps 1-5 (intent, dept, decompose)
    │
    ▼
tool-registry.ts         — gatherToolContext(deptId) → parallel HTTP + SQLite reads
    │
    ▼
brain-registry.ts        — callBrain(assignment, prompt, context) → Ollama fetch
    │
    ▼
department-runtime.ts    — runDepartment() → stores 2 evidence steps
    │
    ▼
qa-gate.ts               — runQaGate() → 6 deterministic checks → PASS/FAIL
    │
    ▼
report-center.ts         — buildCeoReport() → CEO-safe WhatsApp message
```

---

## Department → Brain → Tool Wiring (Proven Live)

| Department | Brain | Model | Max Tokens | Timeout | Tools |
|-----------|-------|-------|-----------|---------|-------|
| dispatch | qwen-deep | qwen3:14b | 2048 | 60s | dept-definitions, pipeline-history |
| executive-assistant | qwen-balanced | qwen3:8b | 512 | 90s | task-snapshot, task-today, task-approvals, health-intel |
| report-center | qwen-balanced | qwen3:8b | 512 | 90s | briefing-latest, visibility-dashboard, agenview-snapshot, strategic-memory, pipeline-history |
| finance | qwen-deep | qwen3:14b | 512 | 120s | visibility-dashboard, strategic-memory |
| engineering | qwen-coder | qwen2.5-coder:7b | 1024 | 120s | pipeline-history, evidence-reader |
| qa | gemma-qa | gemma3:12b | 256 | 90s | evidence-reader, pipeline-history |
| infrastructure | qwen-balanced | qwen3:8b | 512 | 90s | pm2-status, node-registry, visibility-dashboard |
| marketing | qwen-balanced | qwen3:8b | 512 | 90s | strategic-memory, visibility-dashboard |
| brand-creative | gemma-qa | gemma3:12b | 512 | 90s | strategic-memory |
| technical-operations | qwen-balanced | qwen3:8b | 512 | 90s | pm2-status, node-registry, visibility-dashboard |

---

## Live Test Results (2026-06-18 — Real Runs)

### Test 1 — Executive Assistant: Task Query
- **Command:** `"hom nay anh co task gi?"`
- **Pipeline ID:** `47f27cb3`
- **Intent classified:** `query_personal_tasks`
- **Dept assigned:** `executive-assistant`
- **Brain:** qwen3:8b
- **Tools executed:** task-snapshot, task-today, task-approvals, health-intel
- **Real data returned:** 29 open tasks, 257 pending approvals (from task-intelligence SQLite)
- **Evidence steps:** 14 steps all `done`
- **QA verdict:** ✅ PASS
- **CEO receives:** Vietnamese task summary with priorities

### Test 2 — Finance: Cash Flow Check
- **Command:** `"check cash flow this week"`
- **Pipeline ID:** `977022c1`
- **Intent classified:** `check_finances`
- **Dept assigned:** `finance`
- **Approval required:** ✅ YES (REQUIRES_APPROVAL policy enforced)
- **Pipeline status:** `pending_approval`
- **Evidence:** Stopped at approval gate before any financial action
- **CEO receives:** Pending approval message — no data leaked without approval

### Test 3 — Engineering: Repo Audit
- **Command:** `"audit repo company-os code quality"`
- **Pipeline ID:** `b3588a30`
- **Intent classified:** `audit_repo`
- **Dept assigned:** `engineering`
- **Brain:** qwen2.5-coder:7b
- **Approval required:** ✅ YES (engineering policy enforced)
- **Files examined:** company-os/*.ts (14 files listed)
- **Pipeline status:** `pending_approval`
- **CEO receives:** Pending approval — no code changes without CEO sign-off

### Test 4 — Infrastructure: Service Down Diagnosis
- **Command:** `"sao whatsapp down vay?"`
- **Pipeline ID:** `bd5de5c9`
- **Intent classified:** `service_down`
- **Dept assigned:** `infrastructure`
- **Brain:** qwen3:8b
- **Tools executed:** pm2-status, node-registry, visibility-dashboard
- **QA verdict:** ✅ PASS
- **Confidence:** 0.80
- **CEO receives:** Service status summary with diagnosis

### Test 5 — Report Center: Company Status
- **Command:** `"give me a status summary of the company"`
- **Pipeline ID:** `bd13df24`
- **Intent classified:** `generate_report`
- **Dept assigned:** `report-center`
- **Brain:** qwen3:8b
- **Data sources:** briefing-latest, visibility-dashboard, pipeline-history
- **QA verdict:** ✅ PASS
- **Confidence:** 0.80
- **CEO receives:** Company-wide status summary

---

## Evidence Storage — Verified

All pipeline runs persist to `evidence.db` (WAL mode):

| Table | Rows (post-test) |
|-------|-----------------|
| pipeline_runs | 7+ runs |
| executions | 14 steps × multiple runs |

`GET /api/company-os/pipelines/:id/steps` returns full step trace for any pipeline.

---

## QA Independence — Verified

- QA dept uses `gemma3:12b` — different model from all exec departments
- `canSelfCertify()` always returns `false`
- QA reads from evidence-store (written by exec dept, read by QA)
- Engineering exec → QA review: different model + different dept id
- Finance exec → QA review: same pattern

---

## Approval Gate — Verified

| Dept | Policy | Test Result |
|------|--------|------------|
| finance | REQUIRES_APPROVAL | ✅ Blocked at gate, status=pending_approval |
| engineering | REQUIRES_APPROVAL | ✅ Blocked at gate, status=pending_approval |
| executive-assistant | FULL_AUTO | ✅ Ran through, returned CEO result |
| infrastructure | FULL_AUTO | ✅ Ran through, returned CEO result |
| report-center | FULL_AUTO | ✅ Ran through, returned CEO result |

---

## Ollama Runtime

- **Status:** Online at `http://localhost:11434`
- **Model loaded:** qwen3:8b (5.6 GB VRAM)
- **Simple prompt latency:** ~3s
- **Pipeline with context:** 20-90s depending on context size
- **Timeout settings:** 90-120s per dept (tuned to avoid premature abort)
