# Overall Store — Permission Audit
**Date:** 2026-06-22

---

## Route Guards

### Page Route: `GET /overall-store`
```php
case $route === 'overall-store' && $method === 'GET':
    if (!canManage()) redirect('dashboard');
    (new OverallStoreController())->index();
    break;
```
- `canManage()` = Admin + CEO + Manager only
- Member, Accountant → redirect to `/dashboard`

### API Route: `GET /api/overall-store/{id}`
```php
if (!isLoggedIn() || !canManage()) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Access denied']);
    exit;
}
```
Applied in `apiStoreDetail()`, `apiStoreTasks()`, `apiStoreBills()`.

---

## Role Matrix

| Role | `/overall-store` | `/api/overall-store/*` | Stores visible |
|------|-----------------|----------------------|----------------|
| Admin | ✅ 200 | ✅ 200 | All active stores |
| CEO | ✅ 200 | ✅ 200 | All active stores |
| Manager | ✅ 200 | ✅ 200 (assigned only) | Assigned stores only |
| Accountant | ❌ Redirect → /dashboard | ❌ 403 | None |
| Member | ❌ Redirect → /dashboard | ❌ 403 | None |
| Guest (not logged in) | ❌ Redirect → /login | ❌ 403 | None |

---

## Manager Store Scoping

Managers see only stores they are assigned to, enforced in two places:

**1. Page view (model layer):**
```php
if (strtolower($role) === 'manager') {
    $managerClause = " AND (EXISTS (
        SELECT 1 FROM store_manager_assignments sma
        WHERE sma.store_id = s.id AND sma.user_id = ?
    ) OR s.manager_id = ?)";
}
```

**2. API methods (controller layer):**
```php
if (strtolower($role) === 'manager') {
    $accessibleIds = $this->model->getAccessibleStoreIds($userId, $role);
    if (!in_array((int)$storeId, $accessibleIds)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Access denied to this store']);
        exit;
    }
}
```

Manager assignment sources:
- `store_manager_assignments.user_id = manager_id` (assignment table)
- `stores.manager_id = manager_id` (legacy direct assignment)

---

## Sidebar Visibility
```php
<?php if (canManage()): ?>
<a href=".../overall-store">Overall Store</a>
<?php endif; ?>
```
Route guard and sidebar guard are consistent (`canManage()`).

---

## Security Notes
- No IDOR risk: manager cannot access other stores via direct URL (double-checked in controller)
- API auth check runs before any DB query
- `isLoggedIn()` checked before `canManage()` on all API methods
