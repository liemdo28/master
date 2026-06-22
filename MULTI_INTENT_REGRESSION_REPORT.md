# MULTI_INTENT_REGRESSION_REPORT

**Generated:** 2026-06-15
**Result:** PASS

---

## Regression Suite

**File:** `tests/multi-intent-execution-regression.mjs`

### Test Coverage

| Category | Count |
|----------|-------|
| Core test cases (M1-M5) | 5 |
| Regression variants (100 compound messages) | 100 |
| Vietnamese conjunction splitting | 5 |
| **Total** | **110** |

### Core Test Cases

| Case | Description | Expected Children | Result |
|------|-------------|-------------------|--------|
| M1 | Dashboard + QB | DASHBOARD_AUDIT, FINANCE_REPORT | PASS |
| M2 | Dashboard + QB + SEO | DASHBOARD_AUDIT, FINANCE_REPORT, SEO_CONTENT | PASS |
| M3 | Dashboard + QB + SEO + Maria | DASHBOARD_AUDIT, FINANCE_REPORT, SEO_CONTENT, EMAIL_DRAFT | PASS |
| M4 | Partial failure (QB forced fail) | 4 children (QB failed, others continue) | PASS |
| M5 | Parent/child tracking hierarchy | WF-001 → WF-001-A/B/C/D | PASS |

### Regression Variants

20 unique compound CEO message patterns × 5 repetitions = 100 test cases

Patterns tested:
1. Vietnamese natural language with "rồi" conjunction
2. Vietnamese natural language with "và" conjunction
3. English compound with "+"
4. Mixed Vietnamese/English
5. Semicolon-separated
6. Comma-separated lists
7. Terse keyword chains ("Dashboard QB SEO Maria")
8. Full natural sentences with action verbs
9. Review/audit phrasing
10. All 4 intent variations (Dashboard, QB, SEO, Maria)

### Vietnamese Conjunction Splitting

| Pattern | Example | Result |
|---------|---------|--------|
| `rồi` (then) | "Dashboard rồi QB rồi SEO" | PASS |
| `và` (and) | "Dashboard và QB và SEO" | PASS |
| `,` (comma) | "Dashboard, QB, SEO, Maria" | PASS |
| `;` (semicolon) | "Dashboard; QB; SEO; Maria" | PASS |
| No separator | "Dashboard QB SEO Maria" | PASS |

---

## Acceptance Criteria

| Gate | Required | Actual | Result |
|------|----------|--------|--------|
| Pass rate | ≥95% | 100% | ✅ PASS |
| Silently dropped children | 0 | 0 | ✅ PASS |
| Duplicate children | 0 | 0 | ✅ PASS |
| Fake workflow claims | 0 | 0 | ✅ PASS |
| Unsafe executions | 0 | 0 | ✅ PASS |

---

## Evidence

- Core test evidence: `reports/multi-intent-execution-evidence.json`
- Regression evidence: `reports/multi-intent-regression-evidence.json`
- Workflow traces: `.local-agent-global/workflows/multi-intent/WF-*.json`

---

## Verdict

**MULTI_INTENT_REGRESSION_PASSED** ✅
