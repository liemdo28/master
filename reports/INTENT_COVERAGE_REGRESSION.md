# Intent Coverage Regression Report
**Date:** 2026-06-15
**Phase:** DEV3 CEO_READY_V3 Closeout — D2
**Result:** CEO_LANGUAGE_READY

---

## Stress Test: 92/92 PASS (100%)

Full test file: `tests/ceo-one-message-stress-test.mjs`

---

## Results by Category

| Category | Tested | Pass | Coverage |
|----------|--------|------|----------|
| Finance (D1) | 18 | 18 | 100% |
| Store status (D2) | 15 | 15 | 100% |
| Send message (D2) | 8 | 8 | 100% |
| Audit project | 8 | 8 | 100% |
| Build/create | 7 | 7 | 100% |
| Task intelligence | 6 | 6 | 100% |
| Deploy/rollback | 3 | 3 | 100% |
| Fix bug | 3 | 3 | 100% |
| Unknown intent | 5 | 5 | 100% |
| Compound phrases | 4 | 4 | 100% |
| D2 alias phrases | 15 | 15 | 100% |
| **TOTAL** | **92** | **92** | **100%** |

---

## Hallucination Verification

```
Finance phrases → query_finance (truth layer): 18/18 ✅
Finance phrases → full pipeline: 0/18 ✅
Hallucination risk: 0 ✅
```

No finance phrase routes through the full fabrication pipeline.
All finance queries hit the Finance Truth Layer which returns either
real source-stamped data or explicit "unavailable".

---

## Auth Regression Cross-Check

Run after intent changes confirmed no auth surface regression:

```
19/19 PASS
AUTH_REGRESSION_PASS ✅
```

---

## Key Fixes Applied in D2

| Issue | Fix | Result |
|-------|-----|--------|
| `create_report` catching "gui X bao cao" | Moved `send_message` before `create_report` in RULES | ✅ |
| `query_personal_tasks` catching "cho anh biết" | Tightened `cho anh` pattern to require task/viec/duyet | ✅ |
| `kiem tra mi-core` → unknown | Added `mi.?core` to `audit_project` system pattern | ✅ |
| `xem ke toan thang nay` → unknown | Broadened `ke toan` to fire on standalone keyword | ✅ |
| `create_report` has `/\b(bao cao|report)\b/` too broad | Replaced with `/\b(tao|create)\b.*\b(bao cao|report)\b/` | ✅ |
| `audit + dashboard + cho anh biet` → tasks | Tightened `cho anh` to need task-context words | ✅ |

---

## Certification

- FINANCE_INTENT_100PCT: ✅
- STORE_STATUS_100PCT: ✅
- SEND_MESSAGE_100PCT: ✅
- AUDIT_PROJECT_100PCT: ✅
- BUILD_FEATURE_100PCT: ✅
- TASK_INTEL_100PCT: ✅
- HALLUCINATION_RISK_ZERO: ✅
- AUTH_REGRESSION_PASS: ✅
- **CEO_LANGUAGE_READY: ✅**
