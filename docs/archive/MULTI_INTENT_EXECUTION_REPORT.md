# MULTI_INTENT_EXECUTION_REPORT

**Generated:** 2026-06-15T09:26:47.926Z
**Target:** MULTI_INTENT_EXECUTION_READY
**Result:** PASS

| Case | Result | Executed | Dropped | Children |
|---|---:|---:|---:|---|
| M1 | PASS | 2/2 | 0 | WF-M1-A:DASHBOARD_AUDIT:approval_pending<br>WF-M1-B:FINANCE_REPORT:completed |
| M2 | PASS | 3/3 | 0 | WF-M2-A:DASHBOARD_AUDIT:approval_pending<br>WF-M2-B:FINANCE_REPORT:completed<br>WF-M2-C:SEO_CONTENT:approval_pending |
| M3 | PASS | 4/4 | 0 | WF-M3-A:DASHBOARD_AUDIT:approval_pending<br>WF-M3-B:FINANCE_REPORT:completed<br>WF-M3-C:SEO_CONTENT:approval_pending<br>WF-M3-D:EMAIL_DRAFT:approval_pending |
| M4 | PASS | 4/4 | 0 | WF-M4-A:DASHBOARD_AUDIT:approval_pending<br>WF-M4-B:FINANCE_REPORT:failed<br>WF-M4-C:SEO_CONTENT:approval_pending<br>WF-M4-D:EMAIL_DRAFT:approval_pending |
| M5 | PASS | 4/4 | 0 | WF-001-A:DASHBOARD_AUDIT:approval_pending<br>WF-001-B:FINANCE_REPORT:completed<br>WF-001-C:SEO_CONTENT:approval_pending<br>WF-001-D:EMAIL_DRAFT:approval_pending |

## Partial Failure

M4 forced QB/finance failure. Dashboard, SEO, and Maria children still executed; QB was marked failed. No global abort occurred.

## Vietnamese Conjunction Splitting

| Message | Expected | Actual | Pass |
|---|---|---|---|
| "Dashboard rồi QB rồi SEO Raw Sushi rồi Maria" | DASHBOARD_AUDIT, FINANCE_REPORT, SEO_CONTENT, EMAIL_DRAFT | DASHBOARD_AUDIT, FINANCE_REPORT, SEO_CONTENT, EMAIL_DRAFT | PASS |
| "Dashboard và QB và SEO và Maria" | DASHBOARD_AUDIT, FINANCE_REPORT, SEO_CONTENT, EMAIL_DRAFT | DASHBOARD_AUDIT, FINANCE_REPORT, SEO_CONTENT, EMAIL_DRAFT | PASS |
| "Dashboard, QB, SEO, Maria" | DASHBOARD_AUDIT, FINANCE_REPORT, SEO_CONTENT, EMAIL_DRAFT | DASHBOARD_AUDIT, FINANCE_REPORT, SEO_CONTENT, EMAIL_DRAFT | PASS |
| "Check Dashboard; check QB; create SEO; send Maria" | DASHBOARD_AUDIT, FINANCE_REPORT, SEO_CONTENT, EMAIL_DRAFT | DASHBOARD_AUDIT, FINANCE_REPORT, SEO_CONTENT, EMAIL_DRAFT | PASS |
| "Dashboard QB SEO Maria" | DASHBOARD_AUDIT, FINANCE_REPORT, SEO_CONTENT, EMAIL_DRAFT | DASHBOARD_AUDIT, SEO_CONTENT | FAIL |

Evidence: `reports/multi-intent-regression-evidence.json`.
