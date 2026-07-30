# Multi-Store Access Model
**Phase 11.9 — CEO Operational Alignment**
**Date:** 2026-05-30

---

## Current Model

```
users.store_id → stores.id (one-to-one)
```

**Problem:** CEO rejected. Real org has users working across multiple stores.

---

## Required Model

```
User ↔ Store (many-to-many via user_stores)
```

### Roles Across Stores

| Role | Access Pattern |
|------|---------------|
| GM (General Manager) | All stores |
| Operations | All stores |
| Accounting | All stores |
| Marketing | All stores |
| Executive (CEO) | All stores |
| Store Manager | 1-2 stores |
| Member | 1 store |

---

## Migration

```sql
CREATE TABLE IF NOT EXISTS user_stores (
    id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id    INT UNSIGNED NOT NULL,
    store_id   INT UNSIGNED NOT NULL,
    role       VARCHAR(50) DEFAULT 'member',
    is_primary TINYINT(1) DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_user_store (user_id, store_id),
    INDEX idx_us_store (store_id),
    INDEX idx_us_user (user_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Migrate existing data
INSERT IGNORE INTO user_stores (user_id, store_id, is_primary)
SELECT id, store_id, 1 FROM users WHERE store_id IS NOT NULL;
```

---

## Query Pattern Change

**Before:**
```sql
WHERE u.store_id = ?
```

**After:**
```sql
WHERE u.id IN (SELECT user_id FROM user_stores WHERE store_id = ?)
```

Or for "user's stores":
```sql
WHERE store_id IN (SELECT store_id FROM user_stores WHERE user_id = ?)
```

---

## Impact Assessment

| File | Change Required |
|------|----------------|
| `views/manager/command.php` | Already fixed (uses store_id subquery) |
| `models/StoreCommand.php` | Already fixed (graceful fallback) |
| `controllers/StoreCommandController.php` | Minor: team query |
| `models/User.php` | Add `getStores()` method |
| `models/Store.php` | Add `getUsers()` method |

---

## Implementation Priority

Phase 11.9 scope: Architecture document only. Implementation in Phase 12.
