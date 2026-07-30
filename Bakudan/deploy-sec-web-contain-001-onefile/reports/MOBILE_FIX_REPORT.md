# MOBILE FIX REPORT — Phase 13.8

**Date:** 2026-06-17
**Status:** ✅ ALL P0 AND P1 FIXES APPLIED

---

## FIX SUMMARY

| Bug ID | Severity | Description | Root Cause | Fix | File |
|--------|----------|-------------|------------|-----|------|
| MOB-001 | P0 | Internal Error on Overdue Bills Drilldown | SQL query referenced `b.is_archived` column without checking existence; no try/catch wrapper | Added `$this->db->columnExists()` check + conditional WHERE clause + try/catch | `controllers/DrilldownController.php` |
| MOB-002 | P0 | Internal Error on Critical Tasks Drilldown | SQL query referenced `t.reviewer_due_date` without checking existence; no try/catch | Added `$this->db->columnExists()` check + conditional reviewer clause + try/catch | `controllers/DrilldownController.php` |
| MOB-003 | P1 | Horizontal overflow on ALL mobile pages | `ceo-readability.css` forces `.main-content { margin-left: var(--sidebar-w) !important }` globally; no mobile override | Added `@media (max-width:768px)` and `(769-1100px)` overrides in `ceo-readability.css` to reset margin-left to 0, sidebar width to 280px, and hide sidebar | `assets/css/ceo-readability.css` |
| MOB-004 | P1 | Penalty drilldown returns blank/404 | No route or controller method for `/overview/drilldown/penalty` | Added `penalty()` method to `DrilldownController` + route in `index.php` + new view template | `controllers/DrilldownController.php`, `index.php`, `views/drilldown/penalty.php` |
| MOB-005 | P1 | Compliance Risk drilldown unguarded | Same pattern as MOB-001/002 — no try/catch | Added try/catch wrapper | `controllers/DrilldownController.php` |
| — | P2 | Safety net: overflow-x | Body could leak horizontal scroll from any element | Added `overflow-x: hidden; max-width: 100vw` to `html, body` and `.app-layout` | `assets/css/layout.css` |

---

## FILES MODIFIED

| File | Change |
|------|--------|
| `controllers/DrilldownController.php` | Fixed `overdueBills()`, `criticalTasks()`, `complianceRisk()` with column existence checks + try/catch; added `penalty()` method |
| `index.php` | Added route: `GET /overview/drilldown/penalty` → `DrilldownController::penalty()` |
| `views/drilldown/penalty.php` | **NEW** — Penalty drilldown view with responsive design |
| `assets/css/layout.css` | Added `overflow-x: hidden` to `html`, `body`, `.app-layout` |
| `assets/css/ceo-readability.css` | Added mobile overrides to reset `margin-left: 0 !important`, sidebar hidden at 768px and below, toggle visible 769-1100px |
| `tests/mobile-regression.spec.js` | **NEW** — Playwright regression suite for 4 device profiles |

---

## TRACK A — P0 APPLICATION FAILURES: RESOLUTION

### MOB-001: Overdue Bills Drilldown
- **Controller:** `DrilldownController::overdueBills()`
- **Root Cause:** SQL query at line 62 had `AND COALESCE(b.is_archived, 0) = 0` without first checking if the `is_archived` column exists on the `bills` table. This caused a MySQL SQLSTATE exception on environments where the column was not yet added.
- **Fix:** Added `$hasArchived = $this->db->columnExists('bills', 'is_archived')` check. The archive WHERE clause is now conditional. Wrapped entire query block in try/catch to gracefully handle any remaining query errors.
- **Migration Dependency:** None — the fix is self-contained and schema-safe.

### MOB-002: Critical Tasks Drilldown
- **Controller:** `DrilldownController::criticalTasks()`
- **Root Cause:** SQL query referenced `t.reviewer_due_date` column without checking existence. The reviewer_due_date column may not exist in all database schemas.
- **Fix:** Added `$hasReviewerDue = $this->db->columnExists('tasks', 'reviewer_due_date')` check. The reviewer clause in WHERE is now conditional. Wrapped entire query block in try/catch.

### MOB-005: Compliance Risk (preventive)
- **Controller:** `DrilldownController::complianceRisk()`
- **Fix:** Added try/catch wrapper around the entire obligations query block to prevent any future SQL exceptions from reaching the global error handler.

---

## TRACK B+C — RESPONSIVE LAYOUT: RESOLUTION

### Root Cause Analysis
The `ceo-readability.css` (Layer 4) declares `.main-content { margin-left: var(--sidebar-w) !important; }` globally. At desktop widths (>1100px), this is correct — the sidebar is visible and the content area needs the margin. However, the existing `layout.css` responsive rules at `@media (max-width: 768px)` set `margin-left: 0` WITHOUT `!important`, so the ceo-readability `!important` always won.

### Fix Applied
Added mobile override block at the **end** of `ceo-readability.css` (last rule wins at equal specificity):

```css
@media (max-width: 768px) {
    .main-content { margin-left: 0 !important; width: 100% !important; min-width: 0 !important; }
    .sidebar { width: 280px !important; transform: translateX(-100%) !important; }
    .sidebar.open { transform: translateX(0) !important; }
    ...
}
```

### Safety Net
Added to `layout.css`:
```css
html, body { overflow-x: hidden; max-width: 100vw; }
.app-layout { display: flex; min-height: 100vh; overflow-x: hidden; }
```

---

## TRACK D+E — KPI DRILLDOWNS & PENALTY ROUTES: RESOLUTION

### Penalty Drilldown
- **New route:** `GET /overview/drilldown/penalty`
- **New controller method:** `DrilldownController::penalty()`
- **New view:** `views/drilldown/penalty.php`
- Queries `penalties` table with optional `users` and `penalty_rules` joins
- Responsive design with flex-wrap on mobile
- Empty state messaging when no penalties exist

### Existing Penalty Routes Verified
| Route | Status |
|-------|--------|
| `/penalties` | ✅ Already existed via `PenaltyController::userMyPenalties()` |
| `/my-penalties` | ✅ Already existed (same handler) |
| `/manager/penalties` | ✅ Already existed via `PenaltyController::managerDashboard()` |
| `/admin/penalties` | ✅ Already existed via `PenaltyController::adminDashboard()` |
| `/ceo/penalties` | ✅ Already existed via `PenaltyController::ceoSummary()` |
| `/overview/drilldown/penalty` | ✅ **NEW** — added in this phase |

---

## PHP BINARY STATUS

PHP CLI binary (`C:\xampp\php\php.exe`) was not found on the development machine. PHP syntax verification could not be run locally. The modified files use only PHP 8.0+ syntax (match expressions, arrow functions, named arguments) consistent with the rest of the codebase. Syntax validation will occur at deploy time.

---

*Generated: 2026-06-17*
