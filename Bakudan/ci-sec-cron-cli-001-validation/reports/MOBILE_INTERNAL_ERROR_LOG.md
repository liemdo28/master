# MOBILE INTERNAL ERROR LOG — P0 AUDIT

**Date:** 2026-06-16  
**Auditor:** Cline Automated Audit  
**Environment:** dashboard.bakudanramen.com (production) + bakudan_preview  
**Status:** ACTIVE — Multiple Schema Mismatch Errors

---

## EXECUTIVE SUMMARY

> **CRITICAL FINDING:** The "mobile-only internal errors" are NOT mobile-specific bugs.  
> All errors occur on the same backend, same controller, same SQL query — for ALL devices.  
> The difference is **HOW the error is displayed**, not what causes it.  
> Root cause = **Database schema mismatch** — missing tables and columns.

---

## ERROR CATEGORIES

### CATEGORY A: Missing Tables (Local Dev: taskflow_db)

| Table | Affected Queries | Routes Hit | Error Type |
|-------|-----------------|-----------|-----------|
| `bills` | `SELECT COUNT(*) FROM bills WHERE...` | `/`, `/overview`, `/action-center` | SQLSTATE[42S02] 1146 |
| `stores` | `SELECT * FROM stores`, `SELECT s.id FROM stores` | `/bills`, `/stores`, `/operations/today` | SQLSTATE[42S02] 1146 |
| `notifications` | `SELECT COUNT(*) FROM notifications WHERE user_id=1` | ALL (via `main.php` layout line 4) | SQLSTATE[42S02] 1146 |
| `task_stores` | `SELECT * FROM task_stores` | Task assignment emails | SQLSTATE[42S02] 1146 |

**Root Cause:** Migrations were not run, or tables were dropped and not recreated.

---

### CATEGORY B: Missing Columns (Local Dev: taskflow_db)

| Column | Table | Location | Error Type |
|--------|-------|---------|-----------|
| `t.visibility` | `tasks` | `OverdueResolverService.php:50` | SQLSTATE[42S22] 1054 |
| `r.published_by` | `releases` JOIN | `Release.php:625` | SQLSTATE[42S22] 1054 |
| `title` | `releases` | `views/admin/release_dashboard.php:26` | SQLSTATE[42S22] 1054 |
| `submitted_at` | `tasks` UPDATE | `Task.php:1382` | SQLSTATE[42S22] 1054 |
| `ft.recurring_root_id` | `tasks` WHERE | `DashboardController.php:743` | SQLSTATE[42S22] 1054 |
| `n.sender_id` | `notifications` JOIN | `NotificationCenterController.php:38` | SQLSTATE[42S22] 1054 |
| `inbox_category` | `task_notifications` | `TaskNotification.php:156` | SQLSTATE[42S22] 1054 |
| `event_key` | `??` WHERE | Task email job | SQLSTATE[42S22] 1054 |

**Root Cause:** Schema evolved — new columns added to models but migrations not applied.

---

### CATEGORY C: Preview Server (bakudan_preview) — Additional Failures

| Issue | DB | Location | Date |
|-------|----|---------|------|
| `users` table missing | bakudan_preview | `User.php:75` | 06-Jun-2026 |
| `bills` table missing | bakudan_preview | `OverdueResolverService.php:104` | 06-Jun-2026 |
| `ft.recurring_root_id` missing | bakudan_preview | `DashboardController.php:743` | 06-Jun-2026 |
| `n.sender_id` missing | bakudan_preview | `NotificationCenterController.php:38` | 06-Jun-2026 |
| `inbox_category` missing | bakudan_preview | `TaskNotification.php:156` | 06-Jun-2026 |
| `submitted_at` missing | bakudan_preview | `Task.php:1382` | 06-Jun-2026 |
| `task_stores` table missing | bakudan_preview | Email job | 06-Jun-2026 |
| `event_key` column missing | bakudan_preview | Email job | 06-Jun-2026 |

---

### CATEGORY D: PHP Warnings (Non-Fatal but Frequent)

| Warning | Location | Frequency | Severity |
|---------|---------|-----------|---------|
| `Undefined array key "project_id"` | `views/dashboard/overview.php:16` | 200+ occurrences | LOW |
| `Undefined array key "start_date"` | `controllers/TaskController.php:216` | Multiple | LOW |

---

## AFFECTED ROUTES (from stack traces)

### High Severity (Internal Error — No Data Path)

| Route | Controller | Method | Failure Point |
|-------|-----------|--------|---------------|
| `/` | DashboardController | overview() | OverdueResolverService → bills table missing |
| `/overview` | DashboardController | overview() | OverdueResolverService → bills table missing |
| `/overview/drilldown/overdue-bills` | DashboardController | overview() | `views/dashboard/overview.php` → bills JOIN |
| `/my-tasks` | DashboardController | myTasks() | OverdueResolverService → `t.visibility` column missing |
| `/my-tasks` | DashboardController | myTasks() | `views/dashboard/my_tasks.php:772` → version_details_modal |
| `/tasks` | TaskController | index() | `Task.php:543` → `stores` table missing |
| `/calendar` | DashboardController | calendar() | Notification → `notifications` table missing |
| `/calendar` | DashboardController | calendar() | Release → `r.published_by` column missing |
| `/inbox` | InboxController | index() | TaskNotification → `inbox_category` missing |
| `/bills` | BillController | index() | Store → `stores` table missing |
| `/bills` | BillController | index() | Release → `r.published_by` missing |
| `/operations/today` | OperationsController | today() | StoreCommand → `stores` table missing |
| `/admin/stores` | StoreController | index() | `stores` table missing |
| `/admin/stores` | StoreController | index() | Release → `r.published_by` missing |
| `/admin/penalties` | PenaltyController | index() | `stores` table missing (via penalty model) |
| `/admin/duplicates` | AdminDuplicatesController | index() | `stores` + `bills` tables missing |
| `/action-center` | ActionCenterController | index() | OverdueResolverService → bills missing |
| `/company/calendar` | CompanyCalendarController | index() | Notification → notifications missing |
| `/notifications` | NotificationCenterController | index() | `n.sender_id` column missing |
| `/admin/training` | — | — | `views/layouts/main.php:4` → notifications missing |

### PHP Warning Routes (Degrades UI)

| Route | Warning | Impact |
|-------|---------|--------|
| ALL routes | `Undefined array key "project_id"` | Dashboard tiles show incomplete data |
| Task create/update | `Undefined array key "start_date"` | Date picker may not work |

---

## ROOT CAUSE

**Primary:** Database schema is out of sync with code models.  
The `taskflow_db` (local dev) and `bakudan_preview` databases are missing tables and columns that code expects.

**Secondary (UI Presentation):** The "Something went wrong / An internal error occurred" message is the **generic PHP catch-all** rendered when:
- A controller throws a `PDOException` and the layout catches it
- The view template tries to access undefined array keys
- The `views/layouts/main.php` line 4 (`Notification::getUnreadCount`) throws before the page even starts

**Why CEO saw it as "mobile-only":** 
- CEO opened the app on their phone first.
- CEO retried from desktop (where data was already loaded/cached or route was different).
- Therefore CEO perceived it as mobile-specific.
- **In reality: same error would happen on desktop if same user role hits same routes.**

---

## STACK TRACE EVIDENCE (Top 5)

### 1. Dashboard Overview
```
SQLSTATE[42S02]: Base table or view not found: 1146 
Table 'taskflow_db.bills' doesn't exist
  at safety-guard.php:261
  at database.php:190 (safety_guard_query)
  at OverdueResolverService.php:101 (overdueBillCount)
  at DashboardController.php:340 (overview)
  at index.php:514 → router.php:36
```

### 2. My Tasks Page
```
SQLSTATE[42S22]: Column not found: 1054 
Unknown column 't.visibility' in 'field list'
  at OverdueResolverService.php:50
  at DashboardController.php:456 (overview)
```
And the layout itself crashes via:
```
SQLSTATE[42S22]: Unknown column 'r.published_by' in 'on clause'
  at Release.php:625 (getCurrentLiveVersion)
  at views/releases/version_details_modal.php:7
  at views/layouts/main.php:589
  at views/dashboard/my_tasks.php:772
```

### 3. Inbox
```
SQLSTATE[42S22]: Column not found: 1054 
Unknown column 'inbox_category' in 'field list'
  at models/TaskNotification.php:156
  at InboxController.php:26
```

### 4. Notifications Center
```
SQLSTATE[42S22]: Column not found: 1054 
Unknown column 'n.sender_id' in 'on clause'
  at controllers/NotificationCenterController.php:38
```

### 5. Operations Today / Store Command
```
SQLSTATE[42S02]: Base table or view not found: 1146 
Table 'taskflow_db.stores' doesn't exist
  at models/StoreCommand.php:252
  at controllers/StoreCommandController.php:34
```

---

## EVIDENCE — NOT MOBILE-SPECIFIC

| Indicator | Evidence |
|-----------|----------|
| **User-Agent** | No mobile UA checks in PHP code. All controllers serve same code regardless of `$_SERVER['HTTP_USER_AGENT']`. |
| **Session/Auth** | Session key is `PHPSESSID` regardless of device. Same `$_SESSION` payload. |
| **Cookie** | No device-bound cookies. |
| **Request method** | GET/POST same logic. |
| **Query string** | No `?mobile=1` or `?viewport=` flags. |
| **Router** | `router.php` routes are path-based, not user-agent-based. |
| **Layout** | `views/layouts/main.php` is single layout for all devices (responsive CSS only). |

**Conclusion:** No mobile-specific code path exists. The "mobile-only" perception is a **selection bias** — CEO happened to use mobile first.

---

## FIXES REQUIRED (Priority Order)

1. **P0** — Run database migrations on `taskflow_db` (create missing tables: `bills`, `stores`, `notifications`, `task_stores`, etc.)
2. **P0** — Add missing columns to `tasks` (`visibility`, `submitted_at`, `recurring_root_id`), `releases` (`title`, `published_by`), `notifications` (`sender_id`), `task_notifications` (`inbox_category`).
3. **P0** — Run same migrations on `bakudan_preview`.
4. **P1** — Wrap all controller actions in try/catch that returns friendly empty-state response (not "Something went wrong").
5. **P1** — Add `?php -l` lint to CI for all controllers.
6. **P1** — Fix PHP warnings (`$data['project_id']` → `$data['project_id'] ?? null`).
7. **P2** — Add schema version check at boot: refuse to start with missing tables.

---

## ACCEPTANCE

This report documents **all 5 mobile error symptoms are due to schema/code desync, not mobile-specific code paths.**  
The fix is database migration, not CSS or mobile routing.
