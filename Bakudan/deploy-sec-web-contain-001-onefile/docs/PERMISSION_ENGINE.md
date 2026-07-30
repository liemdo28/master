# Permission Engine Architecture
**Phase 12 — P1**
**Date:** 2026-05-30

---

## Current State

Hard-coded role checks:
```php
canAdmin()   // role IN ('admin', 'ceo')
canManage()  // role IN ('admin', 'ceo', 'manager')
isAdmin()    // role === 'admin'
```

Sidebar visibility tied to role functions in PHP.

---

## Target State

Permission-driven visibility. Roles become optional labels. Access controlled by explicit permission grants.

---

## Permission Types

| Permission | Description |
|-----------|-------------|
| `read` | View module/data |
| `comment` | Add comments/notes |
| `edit` | Modify data |
| `approve` | Approve workflows |
| `publish` | Publish releases |
| `admin` | Full control |

---

## Schema

```sql
CREATE TABLE permissions (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    module      VARCHAR(50) NOT NULL,
    action      ENUM('read','comment','edit','approve','publish','admin') NOT NULL,
    UNIQUE KEY uk_perm (module, action)
);

CREATE TABLE user_permissions (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id         INT UNSIGNED NOT NULL,
    permission_id   INT UNSIGNED NOT NULL,
    granted_by      INT UNSIGNED DEFAULT NULL,
    granted_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_user_perm (user_id, permission_id),
    INDEX idx_up_user (user_id)
);

CREATE TABLE role_permissions (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    role            VARCHAR(50) NOT NULL,
    permission_id   INT UNSIGNED NOT NULL,
    UNIQUE KEY uk_role_perm (role, permission_id)
);
```

---

## Modules

```
overview, control_tower, operations_today, manager_command,
action_center, company_calendar, tasks, projects, workspace,
notifications, activity, search, team, stores, store_command,
checklists, releases, walkthrough_library, adoption_metrics,
health, bills, vendors, budget, playbooks, scorecard, boardroom,
users, data_hygiene, integrations, penalties, extensions
```

---

## Permission Check Function

```php
function userCan(string $module, string $action = 'read', ?int $userId = null): bool
{
    $userId = $userId ?? ($_SESSION['user_id'] ?? 0);
    if (!$userId) return false;
    
    $db = Database::getInstance();
    $user = currentUser();
    
    // Check user-level permission
    $direct = $db->fetch(
        "SELECT 1 FROM user_permissions up
         JOIN permissions p ON up.permission_id = p.id
         WHERE up.user_id = ? AND p.module = ? AND p.action = ?",
        [$userId, $module, $action]
    );
    if ($direct) return true;
    
    // Check role-level permission
    $role = $user['role'] ?? 'member';
    $roleCheck = $db->fetch(
        "SELECT 1 FROM role_permissions rp
         JOIN permissions p ON rp.permission_id = p.id
         WHERE rp.role = ? AND p.module = ? AND p.action = ?",
        [$role, $module, $action]
    );
    return (bool)$roleCheck;
}
```

---

## Sidebar Integration

```php
// Replace hard-coded canAdmin()/canManage() with:
<?php if (userCan('control_tower')): ?>
    <a href="/control-tower">Control Tower</a>
<?php endif; ?>
```

---

## Module Visibility Rules

Users only see modules they have `read` permission for:
- Hidden from sidebar
- Hidden from search results
- Hidden from command palette
- Returns 403 if accessed directly

---

## Migration from Current System

### Phase 1: Seed role_permissions from current behavior

```sql
-- Admin gets everything
INSERT INTO role_permissions (role, permission_id)
SELECT 'admin', id FROM permissions;

-- CEO gets everything
INSERT INTO role_permissions (role, permission_id)
SELECT 'ceo', id FROM permissions;

-- Manager gets read + edit on operational modules
INSERT INTO role_permissions (role, permission_id)
SELECT 'manager', id FROM permissions
WHERE action IN ('read', 'comment', 'edit')
  AND module NOT IN ('users', 'data_hygiene', 'integrations');

-- Member gets read on personal modules only
INSERT INTO role_permissions (role, permission_id)
SELECT 'member', id FROM permissions
WHERE action = 'read'
  AND module IN ('tasks', 'projects', 'workspace', 'notifications', 'activity', 'search', 'calendar');
```

### Phase 2: Admin UI for permission management

Route: `/admin/permissions`
- View all users and their effective permissions
- Grant/revoke per user
- Bulk assign by role

---

## Implementation Priority

Phase 12. Non-blocking for current publish. Current role-based system works correctly.
