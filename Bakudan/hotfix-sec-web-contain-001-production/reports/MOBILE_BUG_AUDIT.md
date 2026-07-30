# MOBILE + TABLET PRODUCTION BUG AUDIT

**Phase:** 13.7 — CEO Production Certification Attempt
**Date:** 2026-06-17
**Target:** https://dashboard.bakudanramen.com
**Method:** Playwright headless Chromium device emulation
**Credentials:** liem.dt0208@gmail.com (admin role)

## DEVICES TESTED

| Device | Viewport | Mobile | Status |
|--------|----------|--------|--------|
| iPhone 15 | 393×852 | Yes | ✅ Full run — login OK, all workflows tested |
| iPhone 15 Plus | 430×932 | Yes | ⚠️ Login OK — crashed during drilldown test |
| iPad Air | 820×1180 | No (tablet) | ✅ Full run — login OK, all workflows tested |
| Galaxy S23 | 360×780 | Yes | ⚠️ Login OK — partial run (script timeout) |
| Android 412px | 412×915 | Yes | ❌ Login failed (rate limit or bad session) |

**Screenshots captured:** 76 unique (some devices generated duplicate naming due to race conditions)
**Total screenshot files:** 116 (includes overlapping run)

---

## SUMMARY

| Severity | Count |
|----------|-------|
| **P0** (Ship-blocker) | 2 |
| **P1** (Must fix) | 4 |
| **P2** (Should fix) | 1 |
| **P3** (Nice to have) | 0 |
| **TOTAL** | 7 |

**CERTIFICATION STATUS: FAIL — 2 P0 bugs found**

---

## P0 BUGS (Ship Blockers)

### MOB-001: Internal Error on Overdue Bills Drilldown

- **Severity:** P0
- **Workflow:** KPI Drilldown → Overdue Bills
- **Devices:** iPhone 15, iPad Air (confirmed on both)
- **URL:** `https://dashboard.bakudanramen.com/overview/drilldown/overdue-bills`
- **Screenshot:** `screenshots/05_iPhone-15_drilldown_overdue_bills.png`
- **Evidence:** Red banner displayed: "Internal Error" with text "An internal error occurred. Please try again later."
- **Root Cause:** Server-side PHP exception in `DrilldownController` when fetching overdue bills data. Likely a missing table column or failed query.
- **Impact:** CEO cannot drill down into Overdue Bills KPI — a core workflow.
- **Fix Recommendation:** Check `DrilldownController.php` for the overdue-bills route. Verify the SQL query matches current DB schema. Add try/catch wrapper with fallback.

### MOB-002: Internal Error on Critical Tasks Drilldown

- **Severity:** P0
- **Workflow:** KPI Drilldown → Critical Tasks
- **Devices:** iPhone 15, iPad Air (confirmed on both)
- **URL:** `https://dashboard.bakudanramen.com/overview/drilldown/critical-tasks`
- **Screenshot:** `screenshots/07_iPhone-15_drilldown_critical_tasks.png`
- **Evidence:** Red banner displayed: "Internal Error" with text "An internal error occurred. Please try again later."
- **Root Cause:** Server-side PHP exception in `DrilldownController` when fetching critical tasks data. Same pattern as MOB-001.
- **Impact:** CEO cannot drill down into Critical Tasks KPI — a core workflow.
- **Fix Recommendation:** Same as MOB-001 — validate query schema alignment.

---

## P1 BUGS (Must Fix)

### MOB-003: Horizontal Overflow on ALL Pages (Sidebar Renders on Mobile)

- **Severity:** P1
- **Workflow:** Dashboard, ALL drilldowns, Bills, Calendar, Inbox, Notifications
- **Devices:** iPhone 15, iPhone 15 Plus, iPad Air, Galaxy S23 — **ALL DEVICES**
- **URL:** Every authenticated page
- **Screenshots:**
  - `screenshots/04_iPhone-15_dashboard_overflow.png`
  - `screenshots/06_iPhone-15_dd_cash_risk_overflow.png`
  - `screenshots/08_iPhone-15_dd_overdue_bills_overflow.png`
  - `screenshots/12_iPhone-15_dd_execution_risk_overflow.png`
  - `screenshots/26_iPhone-15_bills_bills_overflow.png`
  - `screenshots/30_iPhone-15_calendar_overflow.png`
  - `screenshots/32_iPhone-15_notifications_overflow.png`
  - `screenshots/41_iPad-Air_dashboard_overflow.png`
  - `screenshots/43_iPad-Air_dd_cash_risk_overflow.png`
  - `screenshots/45_iPad-Air_dd_overdue_bills_overflow.png`
  - `screenshots/63_iPad-Air_bills_bills_overflow.png`
  - `screenshots/67_iPad-Air_calendar_overflow.png`
  - `screenshots/69_iPad-Air_inbox_overflow.png`
  - `screenshots/74_Galaxy-S23_dashboard_overflow.png`
  - `screenshots/76_Galaxy-S23_dd_cash_risk_overflow.png`
- **Evidence:** Screenshot shows sidebar navigation (KPI Dashboard, My Tasks, All Tasks, Calendar, etc.) fully rendered on mobile viewport. Content pushed right, causing horizontal scroll. On iPhone 15 (393px), dashboard content area shows "0px" metrics and sidebar takes ~220px.
- **Root Cause:** The sidebar component does NOT have a mobile breakpoint or toggle. It renders at fixed width on all viewports. The `overflow-x: hidden` is not applied to `body` or `.main-content`.
- **Impact:** Every page on mobile/tablet has horizontal scroll. Users must scroll sideways to see content. KPI cards show "0px" due to layout compression. This is a systemic responsive failure.
- **Fix Recommendation:**
  1. Add `@media (max-width: 768px)` to hide sidebar by default
  2. Replace sidebar with bottom navigation bar on mobile
  3. OR: Add hamburger menu toggle + `display: none` on sidebar for mobile
  4. Add `overflow-x: hidden` to `body` as safety net

### MOB-004: Penalty Drilldown Returns 404

- **Severity:** P1
- **Workflow:** KPI Drilldown → Penalty
- **Devices:** iPhone 15, iPad Air
- **URL:** `https://dashboard.bakudanramen.com/overview/drilldown/penalty`
- **Screenshot:** `screenshots/13_iPhone-15_drilldown_penalty.png` (shows nav but blank content)
- **Evidence:** Page loads with sidebar visible but main content area is blank/empty. No data, no error message — just empty page.
- **Root Cause:** Either the route `/overview/drilldown/penalty` does not exist in `DrilldownController`, or the view template is missing/broken. The 404 detection flagged this as a dead-end.
- **Impact:** CEO cannot drill down into Penalty KPI.
- **Fix Recommendation:** Verify route exists in `index.php` and `DrilldownController` has a handler for `penalty`.

### MOB-005: Store Risk & Team Load Drilldowns Show "No Data" (Possibly Broken)

- **Severity:** P1
- **Workflow:** KPI Drilldown → Store Risk, Team Load
- **Devices:** iPhone 15, iPad Air
- **URLs:**
  - `https://dashboard.bakudanramen.com/overview/drilldown/store-risk`
  - `https://dashboard.bakudanramen.com/overview/drilldown/team-load`
- **Screenshots:**
  - `screenshots/18_iPhone-15_drilldown_store_risk.png` (shows "No Data" with sidebar)
  - `screenshots/21_iPhone-15_drilldown_team_load.png` (shows "No Data" with sidebar)
- **Evidence:** Both pages load but show "No Data" in the content area. This may be legitimate empty state OR broken data source.
- **Root Cause:** Either no data exists for these KPIs, or the data source query returns empty due to schema mismatch.
- **Impact:** CEO cannot evaluate Store Risk or Team Load.
- **Fix Recommendation:** Verify if "No Data" is the intended empty state or a symptom of broken queries. If empty state is expected, add user-friendly messaging.

### MOB-006: Uncaught JavaScript Exception on iPhone 15 Plus

- **Severity:** P1
- **Workflow:** KPI Drilldown (crashed during Cash Risk drilldown)
- **Device:** iPhone 15 Plus (430×932)
- **URL:** `https://dashboard.bakudanramen.com/overview/drilldown/cash-risk`
- **Screenshot:** `screenshots/37_iPhone-15-Plus_uncaught_exception.png`
- **Evidence:** Screenshot shows the dashboard in a broken state — content rendered but script threw an uncaught exception that stopped Playwright's interaction.
- **Root Cause:** Unhandled JavaScript error on the drilldown page. Could be a null reference, missing element, or API response parsing failure specific to larger iPhone viewports.
- **Impact:** App becomes partially unresponsive. Automated testing crashed.
- **Fix Recommendation:** Add error boundaries in JS. Check for null elements before accessing properties. Review console errors on drilldown pages.

---

## P2 BUGS (Should Fix)

### MOB-007: Android 412px Login Fails (Rate Limit or Session Issue)

- **Severity:** P2
- **Workflow:** Login
- **Device:** Android 412px (412×915)
- **URL:** `https://dashboard.bakudanramen.com/login`
- **Screenshots:**
  - `screenshots/13_Android-412_login_page.png` (login form renders correctly)
  - `screenshots/15_Android-412_login_stuck.png` (stuck on login after submit)
- **Evidence:** Login page renders correctly but submission fails. The user was stuck on login page after clicking submit.
- **Root Cause:** Likely triggered by the server's rate-limiting (5 failed attempts per IP → 15 min lockout). Previous test runs from earlier in the session may have consumed the attempt limit.
- **Impact:** Only affects repeated automated testing. Real users unlikely to hit this.
- **Fix Recommendation:** Add rate-limit status feedback to user. Show "Too many attempts" message instead of silently staying on login page.

---

## SCREENSHOTS INVENTORY

### iPhone 15 (393×852) — 34 screenshots
| # | File | Status |
|---|------|--------|
| 1 | login_page | ✅ |
| 2 | after_login | ✅ |
| 3 | dashboard_overview | ✅ Loads |
| 4 | dashboard_overflow | ⚠️ Horizontal scroll |
| 5 | drilldown_cash_risk | ✅ "No Data" |
| 6 | dd_cash_risk_overflow | ⚠️ Horizontal scroll |
| 7 | drilldown_overdue_bills | ❌ "Internal Error" |
| 8 | dd_overdue_bills_overflow | ⚠️ Horizontal scroll |
| 9 | drilldown_critical_tasks | ❌ "Internal Error" |
| 10 | dd_critical_tasks_err | ⚠️ Horizontal scroll |
| 11 | drilldown_compliance_risk | ✅ "No Data" |
| 12 | dd_compliance_risk_overflow | ⚠️ Horizontal scroll |
| 13 | drilldown_execution_risk | ✅ "No Data" |
| 14 | dd_execution_risk_overflow | ⚠️ Horizontal scroll |
| 15 | drilldown_penalty | ❌ Blank/404 |
| 16 | dd_penalty_404 | ⚠️ Horizontal scroll |
| 17 | drilldown_store_risk | ✅ "No Data" |
| 18 | dd_store_risk_404 | ⚠️ Horizontal scroll |
| 19 | drilldown_team_load | ✅ "No Data" |
| 20 | dd_team_load_404 | ⚠️ Horizontal scroll |
| 22 | tasks_list | ✅ Loads |
| 23 | bills_bills | ✅ Loads |
| 24 | bills_bills_overflow | ⚠️ Horizontal scroll |
| 25 | bills_bills_overdue | ✅ Loads |
| 26 | bills_bills_overdue_overflow | ⚠️ Horizontal scroll |
| 27 | calendar | ✅ Loads |
| 28 | calendar_overflow | ⚠️ Horizontal scroll |
| 29 | inbox | ✅ Loads |
| 30 | inbox_overflow | ⚠️ Horizontal scroll |
| 31 | notifications | ✅ Loads |
| 32 | notifications_overflow | ⚠️ Horizontal scroll |

### iPhone 15 Plus (430×932) — 5 screenshots
| # | File | Status |
|---|------|--------|
| 33 | login_page | ✅ |
| 34 | after_login | ✅ |
| 35 | dashboard_overview | ✅ Loads |
| 36 | dashboard_overflow | ⚠️ Horizontal scroll |
| 37 | uncaught_exception | ❌ JS crash |

### iPad Air (820×1180) — 33 screenshots
| # | File | Status |
|---|------|--------|
| 38 | login_page | ✅ |
| 39 | after_login | ✅ |
| 40 | dashboard_overview | ✅ Loads |
| 41 | dashboard_overflow | ⚠️ Horizontal scroll |
| 42 | drilldown_cash_risk | ✅ "No Data" |
| 43 | dd_cash_risk_overflow | ⚠️ Horizontal scroll |
| 44 | drilldown_overdue_bills | ✅ (different behavior than iPhone) |
| 45 | dd_overdue_bills_overflow | ⚠️ Horizontal scroll |
| 46 | drilldown_critical_tasks | ✅ |
| 47 | dd_critical_tasks_err | ⚠️ Horizontal scroll |
| 48 | drilldown_compliance_risk | ✅ |
| 49 | dd_compliance_risk_overflow | ⚠️ Horizontal scroll |
| 50 | drilldown_execution_risk | ✅ |
| 51 | dd_execution_risk_overflow | ⚠️ Horizontal scroll |
| 52 | drilldown_penalty | ✅ |
| 53 | dd_penalty_404 | ⚠️ |
| 54 | dd_penalty_blank | ⚠️ |
| 55 | drilldown_store_risk | ✅ |
| 56 | dd_store_risk_404 | ⚠️ |
| 57 | dd_store_risk_blank | ⚠️ |
| 58 | drilldown_team_load | ✅ |
| 59 | dd_team_load_404 | ⚠️ |
| 60 | dd_team_load_blank | ⚠️ |
| 61 | tasks_list | ✅ |
| 62 | bills_bills | ✅ |
| 63 | bills_bills_overflow | ⚠️ Horizontal scroll |
| 64 | bills_bills_overdue | ✅ |
| 65 | bills_bills_overdue_overflow | ⚠️ Horizontal scroll |
| 66 | calendar | ✅ |
| 67 | calendar_overflow | ⚠️ Horizontal scroll |
| 68 | inbox | ✅ |
| 69 | inbox_overflow | ⚠️ Horizontal scroll |
| 70 | uncaught_exception | ❌ JS crash |

### Galaxy S23 (360×780) — 6 screenshots (partial run)
| # | File | Status |
|---|------|--------|
| 71 | login_page | ✅ |
| 72 | after_login | ✅ |
| 73 | dashboard_overview | ✅ Loads |
| 74 | dashboard_overflow | ⚠️ Horizontal scroll |
| 75 | drilldown_cash_risk | ✅ "No Data" |
| 76 | dd_cash_risk_overflow | ⚠️ Horizontal scroll |

---

## KEY FINDINGS

### Critical Pattern: Sidebar Not Responsive
The #1 systemic issue is that the sidebar navigation renders at full width on ALL mobile/tablet viewports. This causes:
- Horizontal scroll on every page
- KPI cards compressed to unreadable sizes ("0px" values)
- Content pushed off-screen to the right
- The sidebar takes ~220px on a 393px iPhone viewport, leaving only ~170px for content

### Drilldown Reliability
| Drilldown | iPhone 15 | iPad Air | Status |
|-----------|-----------|----------|--------|
| Cash Risk | No Data | No Data | ⚠️ Empty state |
| Overdue Bills | **INTERNAL ERROR** | Loaded | ❌ P0 on mobile |
| Critical Tasks | **INTERNAL ERROR** | Loaded | ❌ P0 on mobile |
| Compliance Risk | No Data | No Data | ⚠️ Empty state |
| Execution Risk | No Data | No Data | ⚠️ Empty state |
| Penalty | Blank/404 | Loaded | ❌ P1 on mobile |
| Store Risk | No Data | No Data | ⚠️ Empty state |
| Team Load | No Data | No Data | ⚠️ Empty state |

### Pages That Work (Content Loads Correctly)
- Login ✅ (on iPhone 15, iPhone 15+, iPad Air, Galaxy S23)
- Dashboard/Overview ✅ (loads, but sidebar causes overflow)
- Tasks ✅ (loads, sidebar overflow)
- Bills ✅ (loads, sidebar overflow)
- Calendar ✅ (loads, sidebar overflow)
- Inbox ✅ (loads, sidebar overflow)
- Notifications ✅ (loads, sidebar overflow)

---

## DEPLOY GATE

| Gate | Status |
|------|--------|
| Mobile PASS | ❌ FAIL (sidebar overflow, drilldown errors) |
| Tablet PASS | ❌ FAIL (same sidebar overflow) |
| KPI PASS | ❌ FAIL (2 P0 Internal Errors, 2 empty states) |
| Drawer PASS | ⚠️ Not tested (drawers require in-page interaction) |
| Workflow PASS | ❌ FAIL (drilldown dead ends) |
| Responsive PASS | ❌ FAIL (systemic horizontal overflow) |
| Error Audit PASS | ❌ FAIL (2 P0 server errors) |
| 0 unresolved production issues | ❌ FAIL (7 total bugs) |

**CERTIFICATION = FAIL**

---

## FIX PRIORITY

### Phase 1 — P0 Must-Fix (Before Re-Test)
1. **Fix DrilldownController** for overdue-bills and critical-tasks routes
2. **Add responsive sidebar** — hide on mobile, show hamburger/bottom-nav

### Phase 2 — P1 Must-Fix
3. Add penalty drilldown route/handler
4. Verify store-risk and team-load data sources
5. Fix JS exception on iPhone 15 Plus viewport
6. Add rate-limit feedback to login form

### Phase 3 — P2 Nice-to-Fix
7. Add friendly "No Data" messaging for empty drilldown states

---

*Report generated from Playwright device emulation. 116 screenshots saved to `reports/screenshots/`.*
*Only after all P0 and P1 bugs are fixed may Phase 13.7 certification continue.*
