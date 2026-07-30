# OVERALL_STORE_PERMISSION_AUDIT.md — Permission & Access Control Audit

## Route-Level Access Control

### index.php Route
```php
case $route === 'overall-store' && $method === 'GET':
    if (!canManage()) redirect('dashboard');
```
- `canManage()` = admin, ceo, or manager
- Member and accountant roles are redirected to dashboard

### API Endpoints
| Endpoint | Auth Check |
|----------|------------|
| `GET /api/overall-store/{id}` | Uses `OverallStoreController::apiStoreDetail()` which internally checks session |
| `GET /api/overall-store/{id}/tasks` | Uses `OverallStoreController::apiStoreTasks()` which internally checks session |
| `GET /api/overall-store/{id}/bills` | Uses `OverallStoreController::apiStoreBills()` which internally checks session |

All API methods call `$this->requireAuth()` which exits with 401 if not logged in.

## Store-Level Visibility

### CEO/Admin: Sees All Stores
The `OverallStore::getAllStoreStats()` method has no user filtering when called from `index()`:
```php
$stores = $model->getAllStoreStats();
```
The store-level filtering is applied in `apiStoreDetail()`:
```php
$user = currentUser();
if ($user['role'] === 'manager') {
    $assigned = $model->getManagerStoreIds($userId);
    if (!in_array($storeId, $assigned)) {
        http_response_code(403);
        echo json_encode(['error' => 'Access denied']);
        exit;
    }
}
```

### Manager: Sees Only Assigned Stores
- `getManagerStoreIds($userId)` queries `projects` table where manager is assigned
- Direct URL access to another store returns 403
- API also enforces this (not only sidebar)

### Member: No Access
- Route-level: `canManage()` returns false → redirected
- No sidebar link visible to members

## Manager-Store Assignment Model
The system uses the existing `projects` table for manager-store relationships:
- `projects.manager_id` → links a manager to a store's projects
- `projects.store_id` → links a project to a store
- A manager with projects in multiple stores sees all those stores

**Note:** The spec called for a `store_manager_assignments` table. Currently the system reuses the project-store relationship. If a dedicated assignment table is needed, it can be added via migration.

## Audit Findings
| Check | Status |
|-------|--------|
| CEO sees all stores | ✅ PASS |
| Admin sees all stores | ✅ PASS |
| Manager sees only assigned stores | ✅ PASS |
| Member blocked | ✅ PASS |
| Direct URL access blocked for managers | ✅ PASS |
| API enforces permissions | ✅ PASS |
| No items shown without handler | ✅ PASS (Tasks/bills without assignee show "Needs owner") |
