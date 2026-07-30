# UI COMPONENT INVENTORY
**Date:** 2026-06-16
**Purpose:** Catalog all reusable UI components and their current state

---

## Layout Components

### Main Shell (`views/layouts/main.php`)
- Sidebar with collapsible groups
- Topbar with notifications + search
- Create Task modal (`#createTaskModal`)
- Version info panel (canAdmin only)
- Telegram shortcut
- Inbox shortcut
- Role-based sidebar sections
- **Status:** ✅ Implemented — needs role cleanup

### Orphan Shell (`views/layouts/header.php` + `footer.php`)
- Basic HTML head + script includes
- No sidebar, no topbar, no navigation context
- **Status:** ❌ Legacy — migrate pages to main.php

### Drilldown Layout (`views/drilldown/layout.php`)
- Breadcrumb back to Overview
- Risk badge (critical/high/medium/low)
- Count header
- Filter bar slot
- Summary bar slot
- Content table slot
- **Status:** ⚠️ Good pattern, but no sidebar — loses navigation

---

## Card Components

### KPI Tile (`.cc-kpi-tile`)
- Defined in `overview.php` inline CSS
- Used: Overview, CEO dashboard
- Fields: number, label, sublabel, color accent
- **Status:** ⚠️ Inline CSS — move to `ux-unified.css`

### Risk Panel (`.cc-risk-panel`)
- Defined in `overview.php` inline CSS
- Used: Overview command center
- **Status:** ⚠️ Inline CSS

### Summary Card (`.dd-summary-card`)
- Defined in `drilldown/layout.php`
- Used: All drilldown pages
- **Status:** ✅ Consistent on drilldowns

### Alert/Badge (`.alert`, `.sb-badge`, `.status-badge`)
- Defined in `layout.css` + `ux-unified.css`
- Used: Most pages via main.php
- **Status:** ✅ Mostly consistent

---

## Table Components

### Standard Table (`.table`, `.table-striped`)
- Defined in `layout.css`
- Used: Most list pages
- **Status:** ✅ Base exists

### Drill Table (`.dd-table`)
- Defined in `drilldown/layout.php`
- Used: Drilldown pages only
- Clickable rows → navigate to detail
- **Status:** ⚠️ Navigates away — should open drawer

### Admin Table (various)
- Inconsistent per-page styling
- Some use `.table`, some use inline `<table style="...">`
- **Status:** ❌ Not unified

---

## Drawer Components

### Task Drawer (`task-drawer.js` + `task-drawer.css`)
- Right-side slide panel
- Loads task detail via AJAX (`/api/tasks/{id}/detail`)
- ESC close ✅, backdrop close ✅
- Used on: Projects board, Calendar
- **Status:** ✅ Implemented — needs wider rollout

### Detail Drawer (`detail-drawer.js` + `detail-drawer.css`)
- Generic right-side panel
- Newer implementation (2026-06-15)
- Used on: Some dashboard pages
- **Status:** ✅ New — needs adoption

### Custom Per-Page Drawer
- `.pc-detail-drawer` in `penalty_config.php`
- Custom user drawer in `team.php`
- **Status:** ❌ Isolated — should use shared drawer

### No Drawer (navigate-away)
- Bills list → `/bills/store/{id}`
- Task list → `/tasks/{id}`
- Users list → `/admin/users/{id}`
- Store list → `/store/{id}`
- **Status:** ❌ P1 work — all lists should use drawer first

---

## Form Components

### Quick Task Modal (`#createTaskModal`)
- In `main.php` — available on all pages
- Fields: title, description, project, section, status, assignee, priority, due_date, approval
- Duplicate check on submit ✅
- **Status:** ✅ Good

### Bill Create Form (in `views/bills/store.php`)
- Store-scoped
- Duplicate check on submit ✅
- Categories: ✅ (fixed this session — 20 categories)
- **Status:** ✅ Good

### Inline Edit Forms
- Scattered per-page
- No unified form component
- **Status:** ❌ Not unified

---

## Navigation Components

### Sidebar Groups
```
OPERATIONS    canManage()
STORES        canAdmin()
PLAYBOOKS     all
SECURITY      canAdmin()
TASKS         all
MY DAY        all
EXECUTIVE     canAdmin()
ADMIN         isAdmin() only ← fixed this session
```
**Status:** ✅ Fixed this session

### Breadcrumb
- Exists on drilldown pages
- Missing from most other pages
- **Status:** ❌ Inconsistent

### Empty States

| Pattern | Used In | Status |
|---------|---------|--------|
| "No records found" text | Most list pages | ✅ |
| Illustrated empty state | Overview | ✅ |
| Blank (nothing) | Some pages | ❌ Fix needed |
| SQLSTATE dump | Production guard in index.php | ✅ Fixed |

---

## Notification / Alert System

| Type | Component | Status |
|------|-----------|--------|
| Flash messages | `.alert-success`, `.alert-error` | ✅ |
| Popup notifications | `task_notifications` table | ✅ |
| Telegram reminders | `cron.php` daily | ✅ |
| Sidebar badge | `.sb-badge` | ✅ |
| Inline warning | `.alert` | ✅ |
| Toast / snackbar | Not implemented | ❌ |

---

## Component Priority for Rebuild

| Component | Priority | Effort | Impact |
|-----------|---------|--------|--------|
| Wrap orphan pages in main.php | P0 | Medium | High |
| Unified drawer (extend task-drawer.js) | P1 | Medium | High |
| Remove inline CSS from views | P1 | Low | Medium |
| Migrate Tailwind → custom CSS (exception_queue) | P0 | Low | High |
| Drilldowns → open drawer not navigate | P1 | Medium | High |
| Unified table component | P2 | Medium | Medium |
| Toast/snackbar notifications | P2 | Low | Low |
| Breadcrumb component | P2 | Low | Low |
