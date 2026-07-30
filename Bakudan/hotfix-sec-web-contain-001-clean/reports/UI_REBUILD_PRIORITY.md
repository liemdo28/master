# UI REBUILD PRIORITY
**Date:** 2026-06-16
**Method:** Impact × Effort scoring. P0=blocker, P1=this sprint, P2=next sprint.

---

## P0 — Blockers (Fix Before CEO Uses Production)

### P0-1: Wrap orphan pages in main.php shell
**Problem:** 18 pages have no sidebar (header.php or no layout). CEO lands on War Room, Control Tower, Company Calendar — all no sidebar. User is lost.
**Pages to fix:**
- `views/control-tower/index.php` → wrap in main.php
- `views/company/calendar.php` → wrap in main.php
- `views/ceo/war-room.php` → wrap in main.php
- `views/action-center/index.php` → wrap in main.php
- `views/manager/command.php` → wrap in main.php
- `views/health/index.php` → wrap in main.php
- `views/employee/my-day.php` → wrap in main.php
- `views/activity/index.php` → wrap in main.php
**Effort:** Low (mechanical change per file)
**Impact:** High (CEO navigation restored)

### P0-2: Fix exception_queue.php CSS system
**Problem:** Uses Tailwind classes (`p-6`, `space-y-6`, `text-white`) — Tailwind CDN not loaded in main shell. Page will render unstyled or incorrectly.
**Fix:** Rewrite exception_queue.php using existing custom CSS variables (`var(--bg-card)`, `var(--text-primary)` etc.) matching the rest of the app.
**Effort:** Low
**Impact:** High

### P0-3: Fix task_type_view.php — wrap in main.php
**Problem:** No layout wrapper, raw HTML output.
**Fix:** Add `ob_start()` / `ob_get_clean()` + `require main.php` pattern.
**Effort:** Low
**Impact:** Medium

### P0-4: Drilldown pages — add sidebar context
**Problem:** All 9 drilldown views use `drilldown/layout.php` — a standalone page with NO sidebar. When CEO drills into Overdue Bills, they lose navigation. Back button required.
**Fix:** Wrap drilldown/layout.php output inside main.php content area. Keep back-to-overview breadcrumb.
**Effort:** Low (change drilldown/layout.php to output content only, wrap in main.php in each drilldown controller)
**Impact:** High

### P0-5: penalty views missing main.php wrapper
**Problem:** `views/admin/penalties/my_penalties.php`, `manager_view.php`, `ceo_summary.php` (created this session) output raw HTML without main.php wrapper. They appear correctly because the controller uses `ob_start()` + `require main.php` — verify this works end-to-end.
**Fix:** Verify controller wraps correctly. Add `$pageTitle` + `$currentPage` variables.
**Effort:** Very Low
**Impact:** Medium

---

## P1 — This Sprint (CEO-Quality Experience)

### P1-1: Unified Drawer — extend task-drawer.js to handle bills + users + stores
**Problem:** `task-drawer.js` is the best drawer implementation. Bill list → navigates to bill detail page. Store list → navigates to store page.
**Fix:** Add `openBillDrawer(id)`, `openUserDrawer(id)`, `openStoreDrawer(id)` to existing task-drawer pattern. Each fetches from a new API endpoint and renders in the right-side panel.
**New APIs needed:**
- `GET /api/bills/{id}/detail` → JSON for bill drawer
- `GET /api/users/{id}/detail` → JSON for user drawer
- `GET /api/stores/{id}/detail` → JSON for store drawer
**Effort:** Medium
**Impact:** High (drawer-first UX)

### P1-2: Manager Command — wrap in main.php + fix DB query in view
**Problem:** `views/manager/command.php` runs raw SQL inside the view file (no controller). No layout.
**Fix:** Move queries to `ManagerCommandController`, output via main.php shell.
**Effort:** Medium
**Impact:** Medium

### P1-3: Store-Level Bill Summary on CEO overview
**Problem:** No page shows "per store bill health" in a single view.
**Fix:** Add a "Store Finance" section to `/overview` showing: [Store] Rent✅ Tax⚠️ Utilities✅ per store row.
**Effort:** Medium
**Impact:** High (CEO directive core requirement)

### P1-4: CEO sidebar — remove Vendors/Procurement
**Problem:** CEO sidebar still shows Vendors, Procurement (canAdmin() gate). CEO shouldn't manage vendors.
**Fix:** Gate vendor sidebar links with `isAdmin()` instead of `canAdmin()`.
**Effort:** Very Low
**Impact:** Low

### P1-5: Finance CFO Panel
**Problem:** Not implemented. CEO spec requires a Finance view.
**Fix:** New page `/finance/overview` showing: total bills this month, paid vs outstanding, by category, by store.
**Effort:** Medium
**Impact:** High

### P1-6: Rebuild exception_queue to match design system
**Already partially done in P0-2. This item = full rebuild with:**
- Proper CSS using `var(--*)` tokens
- Per-exception action buttons (assign owner, mark resolved)
- Linked to source record drawer
**Effort:** Medium
**Impact:** Medium

### P1-7: CEO-filtered overview — show store-level data prominently
**Problem:** `/overview` shows aggregate KPIs but CEO wants to know "which store, which owner, what action".
**Fix:** Add "Store Command" section to overview: 4 store rows, each showing top 1 overdue bill + top 1 overdue task with owner name.
**Effort:** Medium
**Impact:** High

---

## P2 — Next Sprint (Polish)

### P2-1: Consolidate CSS — remove redundant files
**Target:** Merge `ceo-readability.css` + `executive-ui.css` + `ux-unified.css` into a single `components.css`.
Remove `ux-extras.css` (3KB, 70% redundant with layout.css).
**Effort:** Medium
**Impact:** Low (maintenance)

### P2-2: Typography unified
**Problem:** Font sizes range from 10px–28px with no system. Some pages use `font-size:11px` inline, others use `var(--text-sm)`.
**Fix:** Define t-shirt sizes in tokens.css: `--text-xs: 11px`, `--text-sm: 13px`, `--text-base: 14px`, `--text-lg: 16px`, `--text-xl: 20px`, `--text-2xl: 24px`. Replace all inline font-size values.
**Effort:** High (tedious)
**Impact:** Low (visual only)

### P2-3: Responsive / Mobile
**Problem:** Not designed for mobile. Sidebar always open.
**Fix:** Sidebar collapse on mobile, bottom navigation strip for 4 primary items (Tasks, Bills, Notifications, My Day).
**Effort:** High
**Impact:** Medium (operations staff uses mobile)

### P2-4: Empty state illustrations
**Problem:** Empty states are "No records" text only.
**Fix:** Add simple SVG icon per section + one-line guidance text ("No overdue bills — store is healthy" / "Click + to create your first task").
**Effort:** Low
**Impact:** Medium (UX quality signal)

### P2-5: Animate drawer open/close
**Problem:** Drawer appears/disappears instantly.
**Fix:** CSS transition `transform: translateX()` 200ms ease.
**Effort:** Very Low
**Impact:** Low

---

## Execution Order

```
Week 1 — P0 (blockers):
  P0-1: Wrap 8 orphan pages in main.php
  P0-2: Fix exception_queue CSS
  P0-3: Fix task_type_view
  P0-4: Drilldown sidebar
  P0-5: Verify penalty views

Week 2 — P1 high-impact:
  P1-1: Unified drawer (bill + user + store)
  P1-3: Store finance summary on overview
  P1-5: Finance CFO Panel

Week 3 — P1 remaining:
  P1-2: Manager Command
  P1-4: CEO sidebar vendors fix
  P1-6: Exception queue rebuild
  P1-7: Store command section on overview

Week 4+ — P2:
  P2-1: CSS consolidation
  P2-4: Empty states
  P2-3: Mobile (later sprint)
```

---

## Success Criteria (CEO Directive)

After rebuild, CEO opens dashboard and immediately sees:
- [ ] What is wrong (highlighted in red)
- [ ] Who owns it (person name visible)
- [ ] Which store (store name visible on every row)
- [ ] What action is needed (action button on the card)
- [ ] Where to click (every KPI → drawer → action, no dead ends)
