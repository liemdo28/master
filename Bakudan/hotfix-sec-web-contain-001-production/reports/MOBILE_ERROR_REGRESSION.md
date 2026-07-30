# MOBILE ERROR REGRESSION AUDIT

**Phase:** 13.7
**Date:** 2026-06-17
**Target:** https://dashboard.bakudanramen.com
**Status:** ❌ FAIL — 2 P0 server errors found

---

## ERROR TYPES SEARCHED

| Error Type | Found | Devices | Details |
|------------|-------|---------|---------|
| Internal Error (PHP exception) | ✅ YES | iPhone 15, iPad Air | Overdue Bills + Critical Tasks drilldown |
| SQLSTATE | ❌ No | — | Not found in page content |
| Fatal Error | ❌ No | — | Not found (errors handled by try/catch) |
| TypeError | ❌ No | — | Not found in visible content |
| Undefined Index | ❌ No | — | Not found (logged server-side) |
| Undefined Variable | ❌ No | — | Not found (logged server-side) |
| 500 Internal Server Error | ❌ No | — | 200 responses, but error rendered in-page |
| Blank Screen | ❌ No | — | All pages rendered content |
| Dead-end / 404 | ✅ YES | iPhone 15 | Penalty drilldown blank/404 |

---

## DETAILED ERROR LOG

### ERR-001: PHP Exception → Overdue Bills Drilldown
- **URL:** `https://dashboard.bakudanramen.com/overview/drilldown/overdue-bills`
- **HTTP Status:** 200 (exception caught by global handler)
- **Visible Error:** Red banner "Internal Error — An internal error occurred"
- **Source:** `index.php` global exception handler catches PHP exception from `DrilldownController::overdueBills()`
- **Logged:** Yes, in `logs/errors/php-errors.log` (server-side)
- **Devices affected:** iPhone 15, iPad Air
- **Severity:** P0 — Ship blocker

### ERR-002: PHP Exception → Critical Tasks Drilldown
- **URL:** `https://dashboard.bakudanramen.com/overview/drilldown/critical-tasks`
- **HTTP Status:** 200 (exception caught by global handler)
- **Visible Error:** Red banner "Internal Error — An internal error occurred"
- **Source:** Same pattern as ERR-001, `DrilldownController::criticalTasks()`
- **Devices affected:** iPhone 15, iPad Air
- **Severity:** P0 — Ship blocker

### ERR-003: JS Uncaught Exception → iPhone 15 Plus
- **URL:** `https://dashboard.bakudanramen.com/overview/drilldown/cash-risk`
- **HTTP Status:** 200
- **Visible Error:** Page partially renders, script crashes
- **Source:** Unhandled JavaScript error (likely null reference)
- **Device affected:** iPhone 15 Plus (430×932)
- **Severity:** P1 — Must fix

---

## PRODUCTION LOG CHECK

The server logs at `logs/errors/php-errors.log` would contain the full stack traces for ERR-001 and ERR-002. These are not accessible via HTTP and require server-level access.

**Recommended server check:**
```bash
tail -50 /home/liemdo0208/releases/dashboard-*/logs/errors/php-errors.log
```

---

## REGRESSION ASSESSMENT

| Previous Phase | Error Count | Current Phase | Change |
|----------------|-------------|---------------|--------|
| Phase 13.6 | 0 (drawer PASS) | Phase 13.7 | +2 P0, +1 P1 |

The drilldown errors were likely present before but not tested in previous phases (Phase 13.6 focused on drawers, not KPI drilldowns).

---

## RESULT: ❌ FAIL

**PASS CRITERIA: 0 unresolved production issues** — **3 errors found (2 P0, 1 P1)**

**Required:**
1. Fix DrilldownController exceptions (ERR-001, ERR-002)
2. Fix JS exception on iPhone 15 Plus (ERR-003)
3. Investigate server logs for full stack traces
4. Verify no SQLSTATE or TypeError entries in production logs

*Evidence: reports/screenshots/ (116 files), logs/errors/php-errors.log (server-side)*
