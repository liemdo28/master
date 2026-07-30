# AUDIT: Department Runtime (A4)
**Date:** 2026-06-24  
**Status:** ⚠️ PARTIAL — Registry complete, direct execution API missing

---

## Evidence Collected

### Department Registry
```
GET /api/company-os/departments
Total: 20
Active: 11
Planned: 9

Phase 1 (5 depts):
  dispatch              ACTIVE    FULL_AUTO
  executive-assistant   ACTIVE    FULL_AUTO
  report-center         ACTIVE    FULL_AUTO
  library               PLANNED   FULL_AUTO
  qa                    ACTIVE    FULL_AUTO

Phase 2 (4 depts):
  finance               ACTIVE    REQUIRES_APPROVAL
  tax-compliance        PLANNED   REQUIRES_APPROVAL
  restaurant-intel      ACTIVE    FULL_AUTO
  investment-fp         PLANNED   FULL_AUTO

Phase 3 (6 depts):
  technical-operations  ACTIVE    FULL_AUTO
  engineering           ACTIVE    REQUIRES_APPROVAL
  rd                    PLANNED   FULL_AUTO
  competitive-intel     PLANNED   FULL_AUTO
  hr                    PLANNED   REQUIRES_APPROVAL

Phase 4 (3 depts):
  marketing             ACTIVE    FULL_AUTO
  brand-creative        ACTIVE    FULL_AUTO
  website-studio        PLANNED   FULL_AUTO

Phase 5 (2 depts):
  crm                   PLANNED   FULL_AUTO
  video-studio          PLANNED   FULL_AUTO
```

### Department Execution Lifecycle Test
All task execution routes through `/api/company-os/command` (pipeline). Direct `/run-dept` endpoint does NOT exist.

| Step | Status | Evidence |
|------|--------|----------|
| receiveTask() | ✅ | POST /api/company-os/command accepted |
| selectBrain() | ✅ | Intent router assigns qwen3:14b for dispatch |
| selectTools() | ✅ | Intent → check_status / general mapped |
| execute() | ⚠️ | Executes via dispatch only, 80% confidence |
| collectEvidence() | ✅ | Pipeline stored in evidence store |
| submitToQA() | ✅ | qa_verdict: PASS returned in response |
| returnResult() | ✅ | CEO message formatted and returned |

---

## Department Coverage

| Department | Status | Task Reception | Brain | Tools | Evidence |
|------------|--------|----------------|-------|-------|----------|
| dispatch | ACTIVE | ✅ | qwen3:14b | intent-router | ✅ |
| executive-assistant | ACTIVE | via dispatch | qwen3:8b | task-intel | ✅ |
| report-center | ACTIVE | via dispatch | qwen3:8b | exec-brief | ✅ |
| qa | ACTIVE | via dispatch | gemma3:12b | qa-gate | ✅ |
| finance | ACTIVE | REQUIRES_APPROVAL | qwen3:14b | approval-gate | ✅ |
| restaurant-intel | ACTIVE | via dispatch | qwen3:8b | toast,doordash | ⚠️ no live data |
| technical-operations | ACTIVE | via dispatch | qwen3:14b | autonomous,nodes | ✅ |
| engineering | ACTIVE | REQUIRES_APPROVAL | qwen2.5-coder | ai-dev-agent | ✅ |
| marketing | ACTIVE | via dispatch | qwen3:8b | rest-creative | ✅ |
| brand-creative | ACTIVE | via dispatch | qwen3:8b | flux,comfyui | ✅ |

---

## Issues Found

| ID | Issue | Severity |
|----|-------|----------|
| DR-01 | No direct `/run-dept` API — cannot run isolated dept without full pipeline | MEDIUM |
| DR-02 | 9 of 20 departments still PLANNED — HR, CRM, Video, Library, etc. | MEDIUM |
| DR-03 | restaurant-intel has no live Toast/DoorDash data — DATA_MISSING for all money ops | HIGH |

---

## Verdict
**DEPARTMENT_PARTIAL** — 11 departments active. Full pipeline lifecycle (receive→execute→evidence→QA→return) confirmed. Direct dept isolation API missing. Finance/Operations connectors not live.
