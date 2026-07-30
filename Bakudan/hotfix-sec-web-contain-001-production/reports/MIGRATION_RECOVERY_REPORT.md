# PHASE 13.8B — MIGRATION RECOVERY REPORT

**Date:** 2026-06-17  
**Scope:** Validate existence of critical tables and columns in code and migrations  
**Method:** Static analysis of SQL migrations and PHP model SQL references

---

## CRITICAL TABLES — CODE-TO-SCHEMA MAPPING

### 1. `bills` — Referenced in code, defined in migrations

**Code references (SQL queries in PHP):**
- `OverdueResolverService::overdueBillCount()` → `SELECT COUNT(*) FROM bills WHERE due_date < CURDATE() AND status != 'paid'`
- `OverdueResolverService::tasks()` → `SELECT t.id, t.title, t.visibility... FROM tasks t WHERE...`
- `BillController::index()` → `Store::allActive()` → `SELECT * FROM stores WHERE is_active = 1`

**Migration that creates it:** `database/migrations/2026_03_05_tracking_bills.sql`  
**Subsequent ALTERs:** `2026_03_06_bill_upgrades.sql`, `2026_05_29_task_bill_finance_upgrade.sql`, `2026_06_10_bill_registry_upgrade.sql`, `2026_06_16_deduplicate_bills.sql`

**Required columns in `bills`:**
| Column | Type | Migration |
|--------|------|-----------|
| id | INT AUTO_INCREMENT PK | `2026_03_05_tracking_bills.sql` |
| store_id | INT NOT NULL | `2026_03_05_tracking_bills.sql` |
| title | VARCHAR(255) NOT NULL | `2026_03_05_tracking_bills.sql` |
| vendor | VARCHAR(255) NULL | `2026_03_05_tracking_bills.sql` |
| amount | DECIMAL(12,2) NULL | `2026_03_05_tracking_bills.sql` |
| due_date | DATE NOT NULL | `2026_03_05_tracking_bills.sql` |
| status | ENUM('pending','paid','overdue') | `2026_03_05_tracking_bills.sql` |
| note | TEXT NULL | `2026_03_05_tracking_bills.sql` |
| color | VARCHAR(20) NULL | `2026_03_05_tracking_bills.sql` |
| created_by | INT NULL | `2026_03_05_tracking_bills.sql` |
| reminded_at | DATETIME NULL | `2026_03_05_tracking_bills.sql` |
| is_recurring | TINYINT(1) DEFAULT 0 | `2026_03_05_tracking_bills.sql` |
| recurrence_type | VARCHAR(50) NULL | `2026_03_05_tracking_bills.sql` |
| recurrence_config | JSON NULL | `2026_03_05_tracking_bills.sql` |
| created_at | DATETIME DEFAULT CURRENT_TIMESTAMP | `2026_03_05_tracking_bills.sql` |
| category | VARCHAR(50) NULL | `2026_03_06_bill_upgrades.sql` |
| frequency | VARCHAR(20) NULL | `2026_03_06_bill_upgrades.sql` |
| next_due_date | DATE NULL | `2026_03_06_bill_upgrades.sql` |
| last_amount | DECIMAL(12,2) NULL | `2026_03_06_bill_upgrades.sql` |
| avg_amount | DECIMAL(12,2) NULL | `2026_03_06_bill_upgrades.sql` |
| is_critical | TINYINT(1) DEFAULT 0 | `2026_03_06_bill_upgrades.sql` |
| paid_at | DATETIME NULL | `2026_03_06_bill_upgrades.sql` |
| paid_by | INT NULL | `2026_03_06_bill_upgrades.sql` |

**Status:** MUST exist or every page referencing overdue bills fails with SQLSTATE[42S02].

---

### 2. `stores` — Referenced in code, defined in migrations

**Code references:**
- `Store::allActive()` → `SELECT * FROM stores WHERE is_active = 1`
- `StoreCommand::getAllStores()` → `SELECT s.* FROM stores s LEFT JOIN...`
- `Shift::all()` → `SELECT s.*, u.name... FROM shifts s JOIN stores...`
- `Employee::all()` → `SELECT e.*, u.name... FROM employees e JOIN stores...`
- `ControlTowerController::getOverallHealth()` → `SELECT s.id FROM stores s...`
- `ManagerCommandController::getStoreOverview()` → `SELECT s.id, s.name... FROM stores s...`

**Required columns in `stores`:**
| Column | Type | Migration |
|--------|------|-----------|
| id | INT AUTO_INCREMENT PK | `2026_03_05_tracking_bills.sql` |
| name | VARCHAR(255) NOT NULL | `2026_03_05_tracking_bills.sql` |
| address | VARCHAR(255) NULL | `2026_03_05_tracking_bills.sql` |
| color | VARCHAR(20) NULL | `2026_03_05_tracking_bills.sql` |
| is_active | TINYINT(1) DEFAULT 1 | `2026_03_05_tracking_bills.sql` |
| created_at | DATETIME DEFAULT CURRENT_TIMESTAMP | `2026_03_05_tracking_bills.sql` |
| business_id | INT NULL | `sql/schema_v5.sql` |
| type | ENUM('store','office','warehouse','virtual') | `sql/schema_v5.sql` |
| region_id | INT UNSIGNED NULL | `2026_05_29_franchise_platform.sql` |
| district_id | INT UNSIGNED NULL | `2026_05_29_franchise_platform.sql` |
| store_code | VARCHAR(20) NULL | `2026_05_29_franchise_platform.sql` |
| phone | VARCHAR(30) NULL | `2026_05_29_franchise_platform.sql` |
| email | VARCHAR(255) NULL | `2026_05_29_franchise_platform.sql` |
| manager_id | INT UNSIGNED NULL | `2026_05_29_franchise_platform.sql` |

**Status:** MUST exist or 10+ pages fail.

---

### 3. `notifications` — Referenced in code, defined in migrations

**Code references:**
- `Notification::getUnreadCount()` → `SELECT COUNT(*) FROM notifications WHERE user_id = ? AND is_read = 0`
- Called on EVERY page via `views/layouts/main.php` line 4

**Required columns in `notifications`:**
| Column | Type | Migration |
|--------|------|-----------|
| id | INT AUTO_INCREMENT PK | `sql/schema_v2.sql` |
| user_id | INT NOT NULL | `sql/schema_v2.sql` |
| title | VARCHAR(255) NOT NULL | `sql/schema_v2.sql` |
| body | TEXT NULL | `sql/schema_v2.sql` |
| type | VARCHAR(50) NOT NULL | `sql/schema_v2.sql` |
| is_read | TINYINT(1) DEFAULT 0 | `sql/schema_v2.sql` |
| link | VARCHAR(255) NULL | `sql/schema_v2.sql` |
| sender_id | INT NULL | `database/migrations/2026_06_11_phase13_penalty_accountability.sql` (or later) |
| created_at | DATETIME DEFAULT CURRENT_TIMESTAMP | `sql/schema_v2.sql` |

**Status:** MUST exist or every page fails on layout render.

---

### 4. `task_stores` — Referenced in code, defined in migrations

**Code references:**
- `TaskController::store()` → `SELECT * FROM task_stores WHERE task_id = ?`
- Used in email job for task assignment

**Required columns:**
| Column | Type | Migration |
|--------|------|-----------|
| id | INT AUTO_INCREMENT PK | `2026_03_05_tracking_bills.sql` |
| task_id | INT NOT NULL | `2026_03_05_tracking_bills.sql` |
| store_id | INT NOT NULL | `2026_03_05_tracking_bills.sql` |

**Status:** MUST exist or task-store linking fails.

---

### 5. `tasks.visibility` column

**Code reference:** `OverdueResolverService::tasks()` → `SELECT t.id, t.title, t.visibility...`
**Migration:** `2026_04_12_task_schema_columns.sql` or `2026_04_08_task_overhaul.sql`
**Status:** MUST exist or overview page crashes.

---

### 6. `tasks.submitted_at` column

**Code reference:** `Task::submitTask()` → `UPDATE tasks SET submitted_at = NOW() WHERE id = ?`
**Migration:** `2026_06_02_p0_task_detail_schema_sync.sql` (ADD COLUMN `submitted_at` DATETIME NULL)
**Status:** MUST exist or task approval workflow fails.

---

### 7. `tasks.recurring_root_id` column

**Code reference:** `DashboardController::overview()` → `SELECT COUNT(*) FROM tasks WHERE ft.recurring_root_id IS NULL`
**Migration:** `2026_04_08_task_overhaul.sql` or `2026_05_28_recurrence_completion_mode.sql`
**Status:** MUST exist or overview page crashes.

---

### 8. `releases.title` column

**Code reference:** `views/admin/release_dashboard.php` → `SELECT id, version, title FROM releases`
**Migration:** `2026_05_29_release_management_v2.sql` (ADD COLUMN `title` VARCHAR(255) DEFAULT NULL)
**Status:** MUST exist or release dashboard crashes.

---

### 9. `releases.published_by` column

**Code reference:** `Release::getCurrentLiveVersion()` → `SELECT r.*, u.name... FROM releases r LEFT JOIN users u ON r.published_by = u.id`
**Migration:** `2026_05_29_release_management.sql` (included in CREATE TABLE)
**Status:** MUST exist or layout crashes (affects every page via `views/layouts/main.php:589`).

---

### 10. `notifications.sender_id` column

**Code reference:** `NotificationCenterController::index()` → `SELECT n.*, u.name FROM notifications n LEFT JOIN users u ON n.sender_id = u.id`
**Migration:** `2026_06_11_phase13_penalty_accountability.sql` or later migration
**Status:** MUST exist or notifications page crashes.

---

### 11. `task_notifications.inbox_category` column

**Code reference:** `TaskNotification::getCounts()` → `SELECT inbox_category, COUNT(*)... FROM task_notifications WHERE user_id = ? GROUP BY inbox_category`
**Migration:** `2026_06_11_task_notifications_inbox_category.sql`
**Status:** MUST exist or inbox page crashes.

---

### 12. `tasks.approver_id` column

**Code reference:** `TaskApprovalController::submit()` → `SELECT approver_id FROM tasks WHERE id = ?`
**Migration:** `2026_06_03_approver_id_column.sql`
**Status:** MUST exist or approval workflow fails.

---

## MIGRATION FILE LOCATIONS

All critical columns ARE defined in migration files in `database/migrations/`:

| Migration File | What It Adds | Priority |
|---------------|--------------|---------|
| `2026_03_05_tracking_bills.sql` | stores, bills, task_stores tables | P0 |
| `sql/schema_v2.sql` | notifications table | P0 |
| `2026_04_08_task_overhaul.sql` | tasks.recurring_root_id | P0 |
| `2026_04_12_task_schema_columns.sql` | tasks.visibility | P0 |
| `2026_05_29_release_management.sql` | releases table (with published_by) | P0 |
| `2026_05_29_release_management_v2.sql` | releases.title | P0 |
| `2026_06_02_p0_task_detail_schema_sync.sql` | tasks.submitted_at + 14 cols | P0 |
| `2026_06_03_approver_id_column.sql` | tasks.approver_id | P0 |
| `2026_06_11_task_notifications_inbox_category.sql` | task_notifications.inbox_category | P1 |
| `2026_06_11_phase13_penalty_accountability.sql` | notifications.sender_id | P1 |

**KEY FINDING:** The migrations EXIST but have NOT been run against the actual database.
All missing columns have corresponding migration files that add them.
The fix is to run `php migrate.php` — not to write new migrations.

---

## RECOVERY COMMANDS

Once PHP CLI is available:

```bash
# 1. Create local .env with DB_PASS
cp .env.example .env
# Edit .env to set DB_PASS

# 2. Run all migrations against local DB
php migrate.php

# 3. Verify schema
php scripts/verify-schema.php

# 4. For production — SSH to server and run
ssh dreamhost 'cd ~/repo/dashboard && php migrate.php'

# 5. For preview — SSH and run against bakudan_preview
ssh dreamhost 'cd ~/repo/dashboard && APP_ENV=preview php migrate.php'
```

---
