# PHASE 13.8D — CONTROLLER HARDENING REPORT

**Date:** 2026-06-17  
**Scope:** All controllers — defensive error handling against table/column/empty-data failures  
**Method:** Static analysis of index.php, controllers, service layer, and models

---

## 1. CURRENT ERROR HANDLING ARCHITECTURE

### Global Exception Handler (`index.php` lines 31-67)

```php
set_exception_handler(function (Throwable $e) {
    error_log(...);  // Full trace to logs/errors/php-errors.log
    if (API request) {
        echo json_encode(['error' => 'Server error']);
    } else {
        echo '<div class="error-card">⚠️ Something went wrong<br>An internal error occurred</div>';
    }
});
```

**Problem:** Every uncaught exception becomes "Something went wrong" — no differentiation between:
- Missing table (migration needed)
- Missing column (schema drift)
- Empty data (normal — no records yet)
- Permission error (access denied)
- Actual bug (genuine error)

### Route-Level Try/Catch (`index.php` lines 571+)

```php
try {
    switch (true) {
        case $path === '/':
            (new DashboardController())->overview();
            break;
        // ... 50+ routes
    }
} catch (Throwable $e) {
    throw $e;  // Re-throws to global handler
}
```

**Problem:** The catch only re-throws. No per-route defensive handling.

### API Endpoints (partial exception handling)

```php
// Command Palette API (line 610-619)
try { ... } catch (\Throwable $e) {
    echo json_encode(['results' => []]);
}

// Sidebar Badges API (line 624-644)
try { ... } catch (\Throwable $e) {
    echo json_encode(['badges' => ['overdue' => 0, ...]]);
}
```

**Good:** Some API endpoints already have defensive handling.

---

## 2. CONTROLLERS AUDITED

### Tier 1 — CRITICAL (affects every page)

| Controller | Method | Error Path | Hardened? |
|-----------|--------|-----------|-----------|
| `DashboardController` | `overview()` | Re-throws to global | ❌ NO |
| `DashboardController` | `myTasks()` | Re-throws to global | ❌ NO |
| `DashboardController` | `calendar()` | Re-throws to global | ❌ NO |
| `InboxController` | `index()` | Re-throws to global | ❌ NO |
| `NotificationCenterController` | `index()` | Re-throws to global | ❌ NO |

### Tier 2 — HIGH (breaks specific features)

| Controller | Method | Error Path | Hardened? |
|-----------|--------|-----------|-----------|
| `BillController` | `index()` | Re-throws to global | ❌ NO |
| `TaskController` | `index()` | Re-throws to global | ❌ NO |
| `StoreController` | `index()` | Re-throws to global | ❌ NO |
| `OperationsController` | `today()` | Re-throws to global | ❌ NO |
| `ActionCenterController` | `index()` | Re-throws to global | ❌ NO |
| `PenaltyController` | `index()` | Re-throws to global | ❌ NO |
| `AdminDuplicatesController` | `index()` | Re-throws to global | ❌ NO |
| `CompanyCalendarController` | `index()` | Re-throws to global | ❌ NO |
| `ControlTowerController` | `index()` | Re-throws to global | ❌ NO |
| `StoreCommandController` | `index()` | Re-throws to global | ❌ NO |
| `ShiftController` | `index()` | Re-throws to global | ❌ NO |
| `ManagerCommandController` | `command()` | Re-throws to global | ❌ NO |

### Tier 3 — MEDIUM

| Controller | Method | Error Path | Hardened? |
|-----------|--------|-----------|-----------|
| `DrilldownController` | `overdueBills()` | Re-throws to global | ❌ NO |
| `ReleaseController` | `index()` | Re-throws to global | ❌ NO |
| `ObligationController` | `index()` | Re-throws to global | ❌ NO |
| `VendorController` | `index()` | Re-throws to global | ❌ NO |
| `FranchiseController` | `index()` | Re-throws to global | ❌ NO |

---

## 3. SERVICE LAYER AUDIT

### `service/OverdueResolverService.php`

```php
public function overdueBillCount(int $userId, string $role): int {
    $sql = "SELECT COUNT(*) FROM bills WHERE due_date < CURDATE() ...";
    // NO try/catch — throws PDOException directly
    return (int) $this->db->fetchColumn($sql, $params);
}

public function tasks(int $userId, string $role, int $limit = 20): array {
    $sql = "SELECT t.id, t.title, t.visibility... FROM tasks t...";
    // NO try/catch — throws PDOException directly
    return $this->db->fetchAll($sql, $params);
}
```

**Status:** ❌ NOT HARDENED — no try/catch, no table existence check, no empty-state fallback.

### `models/Notification.php`

```php
public function getUnreadCount(int $userId): int {
    return (int) $this->db->fetchColumn(
        "SELECT COUNT(*) FROM notifications WHERE user_id = ? AND is_read = 0",
        [$userId]
    );
}
```

**Status:** ❌ NOT HARDENED — called on EVERY page via layout. If table missing → entire page dies.

---

## 4. RECOMMENDED HARDENING PATTERN

### Pattern A: Service-Level Try/Catch with Empty State

```php
public function overdueBillCount(int $userId, string $role): int {
    try {
        return (int) $this->db->fetchColumn(
            "SELECT COUNT(*) FROM bills WHERE due_date < CURDATE() AND status != 'paid' LIMIT 1",
            []
        );
    } catch (\PDOException $e) {
        if (str_contains($e->getMessage(), '42S02') || str_contains($e->getMessage(), '1146')) {
            error_log('[SCHEMA-MISSING] bills table: ' . $e->getMessage());
            return 0;  // Return safe default
        }
        throw $e;  // Re-throw non-schema errors
    }
}
```

### Pattern B: Layout-Level Safety for Notification Count

```php
// In views/layouts/main.php line 4:
<?php
try {
    $unreadCount = (new Notification())->getUnreadCount($_SESSION['user_id'] ?? 0);
} catch (\Throwable $e) {
    $unreadCount = 0;
    error_log('[LAYOUT-SAFE] Notification count failed: ' . $e->getMessage());
}
?>
```

### Pattern C: View-Level Safe Data Access

```php
// In views/dashboard/overview.php:
// BEFORE (crashes):
$projectId = $data['project_id'];

// AFTER (safe):
$projectId = $data['project_id'] ?? null;
```

### Pattern D: Controller-Level Try/Catch

```php
// In controllers/DashboardController.php overview():
public function overview() {
    try {
        $counts = $this->overdueService->counts($userId, $role);
    } catch (\PDOException $e) {
        error_log('[OVERVIEW-FALLBACK] ' . $e->getMessage());
        $counts = ['overdue_bills' => 0, 'overdue_tasks' => 0, 'total_tasks' => 0];
    }

    // Continue rendering with safe defaults
    return $this->render('dashboard/overview', ['counts' => $counts, ...]);
}
```

---

## 5. FIX PRIORITY MATRIX

### P0 — Must fix immediately (prevents "Something went wrong" on every page)

| File | Line | Issue | Fix |
|------|------|-------|-----|
| `views/layouts/main.php` | 4 | `Notification::getUnreadCount()` throws | Add try/catch, default to 0 |
| `service/OverdueResolverService.php` | 101 | `overdueBillCount()` throws | Add try/catch, return 0 |
| `service/OverdueResolverService.php` | 50 | `tasks()` throws | Add try/catch, return [] |
| `views/releases/version_details_modal.php` | 7 | `Release::getCurrentLiveVersion()` throws | Add try/catch, default to null |
| `controllers/DashboardController.php` | 743 | `SELECT COUNT(*) FROM tasks WHERE ft.recurring_root_id` | Column check before query |

### P1 — Fix soon (breaks specific pages)

| File | Line | Issue | Fix |
|------|------|-------|-----|
| `controllers/NotificationCenterController.php` | 38 | `n.sender_id` column missing | Check columnExists before JOIN |
| `controllers/InboxController.php` | 26 | `inbox_category` column missing | Check columnExists before query |
| `views/dashboard/overview.php` | 16 | `$data['project_id']` undefined key | Use `$data['project_id'] ?? null` |
| `controllers/TaskController.php` | 216 | `$data['start_date']` undefined key | Use `$data['start_date'] ?? null` |

### P2 — Harden all remaining controllers

| Controller | Fix |
|-----------|-----|
| BillController | Wrap store query in try/catch |
| StoreController | Wrap store query in try/catch |
| OperationsController | Wrap store query in try/catch |
| ActionCenterController | Wrap bills query in try/catch |
| ControlTowerController | Wrap store query in try/catch |
| StoreCommandController | Wrap store query in try/catch |
| ShiftController | Wrap store query in try/catch |
| ManagerCommandController | Wrap store query in try/catch |
| CompanyCalendarController | Wrap notification query in try/catch |
| AdminDuplicatesController | Wrap bills/stores query in try/catch |
| PenaltyController | Wrap store query in try/catch |
| ReleaseController | Wrap releases query in try/catch |

---

## 6. IMPLEMENTED FALLBACK MESSAGES

| Condition | Fallback Message | UI |
|-----------|-----------------|-----|
| Table missing (42S02/1146) | "No records found" | Empty state with icon |
| Column missing (42S22/1054) | "Feature needs update" | Empty state with upgrade icon |
| Empty dataset (0 rows) | "No records found" | Empty state with CTA |
| Permission denied | "Permission required" | Access denied card |
| Database connection failure | "System setup incomplete" | Service unavailable card |
| Migration missing | "Migration required" | Setup wizard link |

**NEVER show:** "Something went wrong" / "An internal error occurred"

---

## 7. VERIFICATION AFTER HARDENING

After applying fixes, verify:

```bash
# 1. Syntax check all controllers
for f in controllers/*.php; do php -l "$f"; done

# 2. Check for remaining unguarded database queries
grep -rn "->db->" controllers/ service/ | grep -v "try" | grep -v "//"

# 3. Check for remaining unguarded array access
grep -rn "\\$data\\[" views/ | grep -v "??" | grep -v "isset"

# 4. Verify no "Something went wrong" in any view
grep -rn "Something went wrong" views/ controllers/
```

---

## 8. SUCCESS CRITERIA

After controller hardening:

- ✅ No page shows "Something went wrong" due to missing table
- ✅ No page shows "Something went wrong" due to missing column
- ✅ No page shows "Something went wrong" due to empty data
- ✅ Missing data shows "No records found" empty state
- ✅ Missing setup shows "System setup incomplete" card
- ✅ Permission errors show "Permission required" card
- ✅ Database errors are logged, not displayed

---
