# UI CURRENT STATE AUDIT
**Date:** 2026-06-16
**Scope:** All authenticated views + layout system

---

## 1. Layout System

| Shell | File | Used By | Status |
|-------|------|---------|--------|
| Main shell | `views/layouts/main.php` | ~120 views | ✅ Primary shell |
| Orphan header | `views/layouts/header.php` | ~12 views | ❌ No sidebar, no topbar |
| No layout | — | ~20 views | ❌ Raw HTML output |

### Pages NOT on main.php shell (broken isolation)

```
views/admin/ai-decisions.php          → header.php (orphan)
views/admin/command-center.php        → header.php (orphan)
views/admin/memory.php                → header.php (orphan)
views/admin/notifications.php        → header.php (orphan)
views/admin/predictions.php          → header.php (orphan)
views/admin/workflows.php             → header.php (orphan)
views/ceo/war-room.php               → header.php (orphan)
views/action-center/index.php        → NO layout
views/activity/index.php             → NO layout (raw ob_get_clean wrapped)
views/control-tower/index.php        → NO layout
views/company/calendar.php           → NO layout
views/drilldown/*.php (9 files)      → drilldown/layout.php (own shell — no sidebar)
views/manager/command.php            → NO layout (raw PHP + inline HTML)
views/dashboard/exception_queue.php → NO layout (Tailwind CSS mixed in)
views/dashboard/task_type_view.php  → NO layout
views/health/index.php               → NO layout
views/employee/my-day.php            → NO layout
```

---

## 2. CSS System Fragmentation

15 CSS files loaded inconsistently:

| File | Purpose | Problem |
|------|---------|---------|
| `tokens.css` | Design tokens (colors, spacing) | Not imported on orphan pages |
| `base.css` | Reset + base | Partial coverage |
| `layout.css` | Sidebar + topbar | Only via main.php |
| `style.css` | Entry point | Imports others inconsistently |
| `ux-unified.css` | Card/table/badge system | Not used on all pages |
| `ceo-readability.css` | CEO text styles | CEO pages only |
| `executive-ui.css` | Executive cards | Partial use |
| `task-drawer.css` | Task drawer | Only on pages that include it |
| `detail-drawer.css` | Detail drawer | New — not consistent |
| `workflow-command-center.css` | Workflow cards | Orphan pages |

**Critical**: `views/dashboard/exception_queue.php` uses **Tailwind CSS classes** (`p-6`, `space-y-6`, `text-white`, `text-2xl`) while the rest of the app uses custom CSS with `var(--color-*)` tokens. These two systems are incompatible.

---

## 3. Drawer System Fragmentation

| Drawer | File | Pages Using It |
|--------|------|----------------|
| Task drawer (sidebar) | `task-drawer.js` + `task-drawer.css` | Projects, Calendar |
| Detail drawer (right panel) | `detail-drawer.js` + `detail-drawer.css` | Some dashboard pages |
| Inline custom drawer | Defined per-page | Penalty config, team view |
| None | Navigate to detail page | Most bill/task list pages |

**Result**: Clicking a task in `/projects` opens a drawer. Clicking a task in `/my-tasks` navigates to `/tasks/{id}`. Inconsistent experience.

---

## 4. KPI Drilldown Consistency

| Page | KPIs Clickable | Drilldown Target |
|------|---------------|-----------------|
| `/overview` | ✅ 9 cards | `drilldown/layout.php` (no sidebar) |
| `/dashboard` (CEO) | Partial | Some link to overview |
| `/control-tower` | ❌ Unknown | No layout |
| `/operations/today` | ❌ Unknown | No layout |
| `/manager/command` | ❌ Unknown | Raw PHP, no standard shell |

Drilldown pages use `views/drilldown/layout.php` — a standalone page with NO sidebar. User loses navigation context when drilling into records.

---

## 5. Role-Based Sidebar (Current State)

The sidebar in `main.php` uses these gates:

```php
canAdmin()  = admin OR ceo        // CEO sees EXECUTIVE + SECURITY sections
isAdmin()   = admin only          // ADMIN section (fixed this session)
canManage() = admin OR ceo OR manager
isCeo()     = ceo only            // Used in only 1 route check
```

**Current CEO sidebar** (after today's fix):
- Operations, Team, Stores, Vendors (via canManage)
- Bills, Tasks, Calendar
- EXECUTIVE (Scorecard, Boardroom)
- SECURITY (Credential Vault, Password Rotation, Audit Logs)
- ~~ADMIN section~~ (now hidden from CEO)

**Problem**: CEO still sees Vendors, Procurement items — these are operational-admin, not executive.

---

## 6. Executive Pages — Individual Status

| Page | Route | Layout | Quality |
|------|-------|--------|---------|
| Overview | `/overview` | main.php ✅ | Good — command center style |
| Control Tower | `/control-tower` | ❌ NO LAYOUT | Shows CEO digest but no sidebar |
| Operations Today | `/operations/today` | main.php ✅ | Exists |
| Manager Command | `/manager/command` | ❌ NO LAYOUT | Raw DB query in view |
| Action Center | `/action-center` | ❌ NO LAYOUT | Partial implementation |
| Company Calendar | `/company/calendar` | ❌ NO LAYOUT | No sidebar |
| Finance CFO Panel | Not implemented | — | MISSING |
| Store Health | `/health` | ❌ NO LAYOUT | No sidebar |
| Team Load | `/overview` (embedded) | main.php ✅ | Embedded in overview |
| CEO War Room | `/ceo/war-room` | header.php (orphan) | No sidebar |
| Exception Queue | `/exception-queue` | ❌ NO LAYOUT | Tailwind CSS (wrong system) |

---

## 7. Bill/Payment UI

| View | Store-Level | Category Filter | Drawer |
|------|------------|----------------|--------|
| `/bills/store/{id}` | ✅ per store | ✅ | ❌ navigate |
| `/bills` (all stores) | ⚠️ store column | ✅ | ❌ navigate |
| Bill templates | ✅ | ✅ | ❌ navigate |
| Drilldown overdue | ✅ | ✅ | ❌ navigate |

No drawer — clicking a bill always navigates to a separate page. No company-level aggregate summary page exists.

---

## 8. Empty / Error States

| Scenario | Current Behavior |
|---------|-----------------|
| SQLSTATE error | Generic PHP error or exception handler message |
| Missing table | `tableExists()` guard → empty array → blank UI |
| No data | Some pages show "No records", some show nothing |
| Missing migration | Blank section (no indication of what's wrong) |
| PHP exception in prod | Replaced with "internal error" (fixed this session) |

Empty states exist on some pages (`overview.php` has empty state), missing on others (`exception_queue.php`, `task_type_view.php` has partial).

---

## Summary Score

| Category | Score | Issues |
|---------|-------|--------|
| Layout consistency | 3/10 | ~50 pages not on main.php |
| CSS consistency | 4/10 | 15 files, two systems (custom + Tailwind) |
| Drawer consistency | 3/10 | 3 drawer systems, mostly navigate-away |
| Role-based UI | 6/10 | Fixed this session, still some CEO leakage |
| KPI drilldown | 7/10 | Exist but lose sidebar context |
| Executive pages | 4/10 | 5/9 have no proper layout |
| Empty states | 5/10 | Inconsistent, some blank |
| Bill/payment UI | 7/10 | Store-level exists, no drawer |
