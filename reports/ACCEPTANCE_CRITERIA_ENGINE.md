# Acceptance Criteria Engine
**Module:** DEV3 Phase 13.3  
**Date:** 2026-06-13  
**Status:** PRODUCTION_READY  
**File:** `mi-core/server/src/gstack/pm-agent/acceptance-criteria.ts`

---

## Design Principle

Every criterion must be:
1. **Measurable** — expressed as a boolean or numeric check
2. **Gate-linked** — mapped to a QA certification gate (G1–G5 or BUSINESS)
3. **Severity-classified** — blocking (🔴) or advisory (🟡)

**Bad:** "DONE"  
**Good:** `p0_defects === 0` → [G3] Blocking

---

## Criteria Library by Intent

### audit_project

| ID | Gate | Blocking | Description | Measurement |
|----|------|---------|-------------|-------------|
| AC-A1 | G3 | 🔴 | Không có lỗi P0 | `p0_defects === 0` |
| AC-A2 | G3 | 🔴 | Không có lỗi P1 | `p1_defects === 0` |
| AC-A3 | G2 | 🔴 | Evidence package tạo | `evidence_files.length >= 2` |
| AC-A4 | G4 | 🔴 | QA confidence ≥ 70% | `confidence >= 70` |
| AC-A5 | BUSINESS | 🟡 | CEO report sent | `ceo_report_delivered === true` |

### fix_bug

| ID | Gate | Blocking | Measurement |
|----|------|---------|-------------|
| AC-F1 | G5 | 🔴 | `auto_fix_boundary_check === PASS` |
| AC-F2 | G1 | 🔴 | `tsc_errors === 0` |
| AC-F3 | G4 | 🔴 | `regression_pass_rate >= 0.8` |
| AC-F4 | G3 | 🔴 | `new_p0_defects === 0` |
| AC-F5 | G2 | 🟡 | `before_after_evidence === true` |

### deploy_release

| ID | Gate | Blocking | Measurement |
|----|------|---------|-------------|
| AC-D1 | G5 | 🔴 | `ceo_approval_granted === true` |
| AC-D2 | G1 | 🔴 | `tsc_errors === 0` |
| AC-D3 | G4 | 🔴 | `regression_pass_rate >= 0.8` |
| AC-D4 | G2 | 🔴 | `post_deploy_health === true` |
| AC-D5 | G5 | 🔴 | `rollback_plan_ready === true` |

---

## Multi-Phase Extra Criteria

When the request contains both `fix` AND (`kiem tra` / `test`), two additional criteria are injected:

| ID | Gate | Blocking | Description |
|----|------|---------|-------------|
| AC-MP1 | G5 | 🔴 | Fix chỉ áp dụng nếu audit PASS (safety gate) |
| AC-MP2 | G4 | 🔴 | Test lại sau fix — regression không được giảm |

---

## Acceptance Test Result

**Input:** "Mi ơi kiểm tra Dashboard, tìm lỗi, nếu an toàn thì fix, test lại rồi báo anh."

Generated: **7 criteria** (6 blocking, 1 advisory)  
Multi-phase extras: **AC-MP1 + AC-MP2** injected ✅

| ID | Gate | Blocking | Description |
|----|------|---------|-------------|
| AC-A1 | G3 | 🔴 | Không có lỗi P0 |
| AC-A2 | G3 | 🔴 | Không có lỗi P1 |
| AC-A3 | G2 | 🔴 | Evidence package tạo |
| AC-A4 | G4 | 🔴 | QA confidence ≥ 70% |
| AC-A5 | BUSINESS | 🟡 | CEO report sent |
| AC-MP1 | G5 | 🔴 | Fix chỉ áp dụng nếu audit PASS |
| AC-MP2 | G4 | 🔴 | Regression không giảm sau fix |
