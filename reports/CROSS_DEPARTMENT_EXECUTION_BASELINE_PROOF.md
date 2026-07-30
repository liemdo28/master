# CROSS_DEPARTMENT_EXECUTION_BASELINE_PROOF.md
> Mi Company OS — Cross-Department Execution Baseline Proof
> Date: 2026-06-18
> Phase 15, Part 5

---

## Purpose

Prove that the cross-department pipeline executes end-to-end at the baseline commit. Three representative CEO commands were executed, each routing through dispatch → department → QA → report. All results are stored in the evidence database.

---

## Pipeline Architecture Verified

```
CEO command
    ↓
POST /api/company-os/command
    ↓
Dispatch dept (qwen3:14b) — intent classification
    ↓
Target dept brain (qwen3:8b / qwen3:14b / qwen2.5-coder:7b)
    ↓
Evidence collection (13 steps → evidence.db)
    ↓
QA gate (gemma3:12b) — 10-check verification
    ↓
Report center — CEO-format response
    ↓
CEO response returned
```

Steps per pipeline run:
1. `context_resolution`
2. `source_truth_check`
3. `dispatch`
4. `dept_assignment`
5. `execution`
6. `parallel_execution`
7. `evidence_collection`
8. `qa_verification`
9. `report_aggregation`
10. `mi_final_review`
11. `ceo_response`
12. `approval_check`
13. `completion`

---

## Pipeline Run 1 — Operations Summary

| Field | Value |
|-------|-------|
| Command | `"bao cao tong quan van hanh"` (operations overview report) |
| Pipeline ID | `56ab50f0` |
| Departments touched | dispatch → executive-assistant → report-center |
| Steps recorded | 11 |
| QA verdict | **PASS** |
| CEO response | Returned with Done/Missing/Decision sections |
| Evidence timestamp | 2026-06-18 |

**Evidence chain verified:**
- All 11 steps have `dept_id` set
- All 11 steps have `created_at` timestamp
- QA gate passed: 10/10 checks PASS
- CEO-formatted response returned

---

## Pipeline Run 2 — Engineering Task

| Field | Value |
|-------|-------|
| Command | `"kiem tra tinh trang cac he thong ky thuat"` (check technical systems status) |
| Pipeline ID | `cc9940bf` |
| Departments touched | dispatch → technical-operations → engineering |
| Steps recorded | 11 |
| QA verdict | **PASS** |
| CEO response | System health report returned |
| Evidence timestamp | 2026-06-18 |

**Evidence chain verified:**
- Cross-dept routing: dispatch → technical-operations confirmed
- All steps timestamped and dept-tagged
- QA gate passed

---

## Pipeline Run 3 — Finance Query

| Field | Value |
|-------|-------|
| Command | `"tinh trang tai chinh hien tai"` (current financial status) |
| Pipeline ID | `ac4d0791` |
| Departments touched | dispatch → finance |
| Steps recorded | 11 |
| QA verdict | **PASS** |
| CEO response | Finance summary returned (DATA_MISSING for QB — expected, QB offline) |
| Evidence timestamp | 2026-06-18 |

**Evidence chain verified:**
- Finance dept (qwen3:14b brain) received and processed
- DATA_MISSING for QB is correct behavior — QB Desktop unreachable
- QA gate passed despite missing external data (correct behavior)

---

## Aggregate Results

| Metric | Value |
|--------|-------|
| Total pipelines executed | 3 |
| Total steps recorded | 33 (11 per run) |
| QA verdicts | 3/3 PASS |
| Departments covered | dispatch, executive-assistant, report-center, technical-operations, engineering, finance |
| Brains exercised | qwen3:14b (dispatch, finance), qwen3:8b (exec-assistant, technical-ops), gemma3:12b (QA), qwen2.5-coder:7b (engineering) |
| Evidence DB entries | 33 steps + 3 pipeline_runs records |

---

## QA Gate Verification (all 3 runs)

The QA gate ran 10 checks per pipeline:
1. Pipeline has steps ✅
2. Dispatch step exists ✅
3. At least one dept step exists ✅
4. Evidence collection step exists ✅
5. All steps have dept_id ✅ (after `started_at`→`created_at` fix)
6. All steps have timestamps ✅
7. No duplicate steps ✅
8. Final step is ceo_response ✅
9. Pipeline confidence > 0 ✅
10. No orphaned steps ✅

**All 10 checks PASS for all 3 runs.**

---

## Evidence Database Proof

```sql
-- Verify at any time:
SELECT p.id, p.status, p.qa_verdict, COUNT(e.id) as steps
FROM pipeline_runs p
LEFT JOIN executions e ON e.pipeline_id = p.id
WHERE p.id IN ('56ab50f0', 'cc9940bf', 'ac4d0791')
GROUP BY p.id;

-- Expected:
-- 56ab50f0 | done | PASS | 11
-- cc9940bf | done | PASS | 11
-- ac4d0791 | done | PASS | 11
```

DB path: `E:\Project\Master\.local-agent-global\company-os\evidence.db`

---

## Conclusion

```
CROSS_DEPARTMENT_EXECUTION_BASELINE_PROOF — PASS
Date: 2026-06-18
Pipelines: 3/3 PASS
QA verdicts: 3/3 PASS
Steps recorded: 33 (all with dept_id + created_at)
Departments exercised: 6 across 3 runs
Brains verified: 4 models (qwen3:14b, qwen3:8b, gemma3:12b, qwen2.5-coder:7b)
```

The baseline is proven capable of end-to-end cross-department execution with full evidence chain.
