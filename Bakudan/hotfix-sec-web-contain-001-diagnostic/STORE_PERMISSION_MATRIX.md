# STORE PERMISSION MATRIX

**Date:** 2026-06-22  
**Status:** ✅ PASS

## Role → Store Access

| Action | Admin | CEO | Manager | Member |
|--------|-------|-----|---------|--------|
| View all stores | ✅ | ✅ | ❌ | ❌ |
| View assigned stores | ✅ | ✅ | ✅ | ❌ |
| Edit all stores | ✅ | ❌ | ❌ | ❌ |
| Assign managers | ✅ | ❌ | ❌ | ❌ |
| View store health | ✅ | ✅ | ✅ | ❌ |
| View store tasks | ✅ | ✅ | ✅ (assigned only) | ✅ (own tasks) |
| View store bills | ✅ | ✅ | ✅ (assigned only) | ❌ |
| View store employees | ✅ | ✅ | ✅ (assigned only) | ❌ |
| Store Command Center | ✅ | ✅ | ✅ | ❌ |
| Health Score refresh | ✅ | ✅ | ✅ | ❌ |

## Implementation

### StoreCommandModel::getAllStores()
```php
// Manager role: only see assigned stores
if ($currentUserRole === 'manager' && $currentUserId !== null) {
    $whereExtra = " AND (
        EXISTS (SELECT 1 FROM store_manager_assignments sma WHERE sma.store_id = s.id AND sma.user_id = ?)
        OR s.manager_id = ?
    )";
}
```

### StoreCommandController::requireManager()
```php
// Redirects non-admin/manager/CEO users to dashboard
if (!canManage()) {
    header('Location: /dashboard');
    exit;
}
```

### store_manager_assignments Table
- Links users to stores with role (primary_manager, assistant_manager, viewer)
- Supports one manager → multiple stores (David manages B1, B2, B3)
- Supports multiple managers → one store (via different role assignments)

## Migration Required
Run `sql/migration_store_command_recovery.sql` to create the `store_manager_assignments` table.
