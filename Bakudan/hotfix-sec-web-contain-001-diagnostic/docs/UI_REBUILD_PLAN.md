# UI REBUILD PLAN
**Version:** 1.0
**Date:** 2026-06-16
**Owner:** Engineering
**Status:** APPROVED — CEO Directive

---

## Objective

Transform the dashboard from a collection of separately-built modules into a single unified operational interface. CEO should be able to understand company status, identify owners, and take action without navigating or searching.

---

## Current State Summary

| Problem | Scope | Severity |
|---------|-------|---------|
| ~50 pages have no sidebar or wrong layout | Layout | P0 |
| 15 CSS files, two CSS systems (custom + Tailwind) | CSS | P0 |
| 3 drawer implementations, mostly navigate-away | UX | P1 |
| Drilldowns lose sidebar context | UX | P0 |
| Manager Command has DB query in view | Architecture | P1 |
| No Finance CFO Panel | Feature | P1 |
| Empty states inconsistent | UX | P2 |

Full details: `reports/UI_CURRENT_STATE_AUDIT.md`

---

## Design System

### Color Tokens (existing in `tokens.css` — extend, don't replace)

```css
/* Already defined — use these everywhere */
--bg-primary:    #0f0f13
--bg-card:       #1a1a24
--bg-card-hover: #1e1e2e
--border-subtle: #1f2937
--border-card:   #2d2d3d
--text-primary:  #f1f5f9
--text-secondary:#94a3b8
--text-muted:    #64748b

/* Status */
--color-critical: #dc2626
--color-high:     #f59e0b
--color-medium:   #3b82f6
--color-low:      #22c55e
--color-neutral:  #64748b
```

### Typography Scale (define in `tokens.css`)

```css
--text-xs:   11px  /* meta, labels */
--text-sm:   13px  /* table rows, badges */
--text-base: 14px  /* body */
--text-lg:   16px  /* card headers */
--text-xl:   20px  /* page titles */
--text-2xl:  24px  /* hero numbers */
--text-3xl:  32px  /* KPI values */
```

### Spacing Scale

```css
--space-1: 4px
--space-2: 8px
--space-3: 12px
--space-4: 16px
--space-5: 20px
--space-6: 24px
--space-8: 32px
```

---

## Layout Architecture

### Unified Shell Pattern

Every authenticated page must follow this structure:

```php
// Controller method
ob_start();
require __DIR__ . '/../views/section/page.php';
$content = ob_get_clean();

$pageTitle   = 'Page Title';   // required
$currentPage = 'page-slug';    // used for sidebar active state
// optional:
$extraCss    = ['page-specific.css'];
$extraJs     = ['page-specific.js'];

require __DIR__ . '/../views/layouts/main.php';
```

The view file (`section/page.php`) contains ONLY the content area HTML. No `<html>`, no `<head>`, no sidebar. `main.php` renders everything.

### Sidebar Sections by Role

```
ALL authenticated:
  MY DAY       → my-tasks, my-day, calendar, notifications, activity, search
  TASKS        → tasks, projects, my-workspace

canManage() (admin, ceo, manager):
  OPERATIONS   → stores, health, operations/today
  BILLS        → bills (all stores), bill templates
  PLAYBOOKS    → franchise playbooks

canAdmin() (admin, ceo) — OPERATIONAL:
  STORE COMMAND → store/{id}, store-command
  EXECUTIVE     → scorecard, boardroom, war-room, control-tower

isAdmin() only — TECHNICAL:
  ADMIN         → users, data-hygiene, integrations, extensions, releases
  SECURITY      → vault, rotation, audit-logs
  PENALTIES     → penalty admin (isAdmin only)

isCeo() — CEO ONLY sidebar additions:
  ACCOUNTABILITY → /ceo/penalties (read-only)
  FINANCE        → /finance/overview (CFO panel)
```

### Content Width

```css
.page-content         { max-width: 1400px; margin: 0 auto; padding: 24px 20px; }
.page-content--narrow { max-width: 900px; margin: 0 auto; padding: 24px 20px; }
.page-content--wide   { max-width: 100%; padding: 24px 20px; }
```

---

## Drawer System

### Specification

All lists must use drawer-first navigation:

```
List view click → Open right drawer → Show detail + actions
```

Navigate-away only for: full edit forms, settings pages.

### Implementation

Extend `assets/js/task-drawer.js` with entity-specific loaders:

```javascript
// Single drawer system for all entities
window.openTaskDrawer  = (id) => drawerLoad('/api/tasks/'  + id + '/detail');
window.openBillDrawer  = (id) => drawerLoad('/api/bills/'  + id + '/detail');
window.openUserDrawer  = (id) => drawerLoad('/api/users/'  + id + '/detail');
window.openStoreDrawer = (id) => drawerLoad('/api/stores/' + id + '/detail');

function drawerLoad(url) {
    document.getElementById('taskDrawerOverlay').classList.add('open');
    document.getElementById('taskDrawerInner').innerHTML = '<div class="drawer-loading">Loading…</div>';
    fetch(url).then(r => r.json()).then(data => renderDrawer(data));
}
```

### Required API Endpoints (new)

| Endpoint | Returns |
|----------|---------|
| `GET /api/bills/{id}/detail` | Bill + payments + store + history |
| `GET /api/users/{id}/detail` | User + stats + task load + store |
| `GET /api/stores/{id}/detail` | Store + bills + tasks + health |

### Drawer Close Behavior

```javascript
// All drawers: ESC closes, backdrop click closes, browser back closes
document.addEventListener('keydown', e => e.key === 'Escape' && closeAllDrawers());
document.getElementById('taskDrawerOverlay')
    .addEventListener('click', e => e.target === e.currentTarget && closeAllDrawers());
// Push state for browser back:
history.pushState({ drawer: true }, '', '#drawer');
window.addEventListener('popstate', closeAllDrawers);
```

---

## KPI → Action Flow

Every KPI card follows this flow:

```
[KPI Card] → click
  → [Drilldown page: list of source records, sidebar intact]
    → click row
      → [Drawer: record detail + action buttons]
        → click action
          → [In-drawer form OR direct API call]
            → drawer refreshes
```

### Drilldown Standard

All drilldown views wrap their content in main.php (not drilldown/layout.php standalone):

```php
// In each drilldown view file:
$ddBreadcrumb = '<a href="' . APP_URL . '/overview">Overview</a> → Overdue Bills';
// $ddTitle, $ddCount, $ddRiskLevel already set
ob_start();
include __DIR__ . '/layout_inner.php'; // just the table+header, no page shell
$content = ob_get_clean();
require __DIR__ . '/../layouts/main.php';
```

---

## Executive Pages Specification

### `/overview` (Command Center) — Enhance Existing
Add "Store Command" row: 4 stores, each showing top alert (bill/task) + owner.

### `/control-tower` — Wrap in main.php
Add sidebar. Keep existing digest content.

### `/operations/today` — Wrap in main.php
Already has controller. Confirm main.php wrapper.

### `/manager/command` — Full Rebuild
- Move DB queries to `ManagerCommandController`
- Wrap in main.php
- Show: own stores only, team load per member, bills due this week

### `/action-center` — Wrap in main.php
Keep existing content. Add sidebar.

### `/company/calendar` — Wrap in main.php
Keep existing calendar. Add sidebar.

### `/finance/overview` (NEW — Finance CFO Panel)
New route. Shows:
- Total bills this month: paid vs outstanding
- By category (bar chart or table)
- By store (horizontal bars)
- Upcoming due in 7/14/30 days
- Overdue total + count

### `/health` (Store Health) — Wrap in main.php
Keep existing health checks. Add sidebar.

### `/ceo/war-room` — Wrap in main.php
Move from header.php orphan to main.php.

---

## Bill / Payment UI

### Store-Level Bill View (`/bills/store/{id}`)
Already store-scoped. Enhance:
- Replace navigate-to-detail with `openBillDrawer(id)` on row click
- Add status summary bar: Pending X / Paid Y / Overdue Z

### Company Aggregate (`/bills`)
Show all stores in tabs or filter. Add summary cards per store.

### Finance CFO Panel (`/finance/overview`)
Per spec above.

### Required Bill Fields (already enforced in BillController)
- category (✅ 20 options)
- store_id (✅)
- due_date (✅)
- repeat_type / frequency (✅)
- assigned_to (✅ owner)
- approval_required (✅ checker/approver)

---

## Empty / Error States

### Standard Empty State Component

```php
// In any view where records may be empty:
<?php if (empty($records)): ?>
<div class="empty-state">
    <div class="empty-state__icon"><?= tf_icon('inbox', 32) ?></div>
    <div class="empty-state__title">No records found</div>
    <div class="empty-state__body"><?= $emptyMessage ?? 'Nothing to show here.' ?></div>
    <?php if (!empty($emptyAction)): ?>
    <a href="<?= $emptyAction['url'] ?>" class="btn btn-primary btn-sm"><?= $emptyAction['label'] ?></a>
    <?php endif; ?>
</div>
<?php endif; ?>
```

CSS in `ux-unified.css`:
```css
.empty-state { text-align:center; padding:48px 24px; color:var(--text-muted); }
.empty-state__icon { margin-bottom:12px; opacity:.4; }
.empty-state__title { font-size:var(--text-lg); font-weight:600; color:var(--text-secondary); margin-bottom:6px; }
.empty-state__body { font-size:var(--text-sm); }
```

### SQLSTATE Guard
Already in place (index.php exception handler → generic message). No raw error to user.

---

## File Structure After Rebuild

```
assets/
  css/
    tokens.css          ← design tokens (extend)
    layout.css          ← sidebar + topbar (keep)
    components.css      ← NEW: merge ux-unified + executive-ui + ceo-readability
    task-drawer.css     ← extend to handle all entity drawers
    pages/              ← page-specific CSS (keep isolated)
  js/
    task-drawer.js      ← extend to openBillDrawer, openUserDrawer, openStoreDrawer
    layout.js           ← sidebar toggle + topbar (keep)
    app.js              ← page init (keep)

views/
  layouts/
    main.php            ← ONLY layout used (header.php deprecated)
  partials/             ← shared partials (empty-state.php, status-badge.php)
  [all pages]           ← content only, wrapped by main.php in controllers
```

---

## Rollout Checklist

### P0 (Week 1)
- [ ] Wrap all orphan pages in main.php (18 pages)
- [ ] Fix exception_queue.php CSS (Tailwind → custom)
- [ ] Fix drilldown pages (keep sidebar via main.php)
- [ ] Verify penalty views render correctly

### P1 (Week 2-3)
- [ ] Unified drawer: bill + user + store
- [ ] New API: /api/bills/{id}/detail, /api/users/{id}/detail, /api/stores/{id}/detail
- [ ] Store command section on /overview
- [ ] Finance CFO Panel (/finance/overview)
- [ ] Manager Command: move to controller + wrap in main.php
- [ ] CEO sidebar: remove vendors/procurement
- [ ] Rebuild exception_queue to design system

### P2 (Week 4+)
- [ ] Consolidate CSS files
- [ ] Typography tokens applied everywhere
- [ ] Empty state component in all views
- [ ] Mobile bottom navigation
- [ ] Drawer animations
