# Preview Schema Audit
**Phase 12 — P0-B**
**Date:** 2026-05-30
**Status:** REQUIRES LIVE EXECUTION

---

## Objective

Compare Main schema vs Preview schema. Identify all drift.

---

## Audit Query (Run on Both Environments)

```sql
-- Generate schema inventory
SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
ORDER BY TABLE_NAME, ORDINAL_POSITION;
```

---

## Required Tables (Must Exist on Preview)

| Table | Purpose | Migration Source |
|-------|---------|-----------------|
| `stores` | Store entities | Core |
| `users` | User accounts | Core |
| `user_stores` | Multi-store access (Phase 12) | NEW — create if missing |
| `tasks` | Task management | Core |
| `task_stores` | Task-store junction | Phase 11 |
| `projects` | Project management | Core |
| `project_members` | Project membership | Core |
| `comments` | Task comments | Core |
| `notifications` | User notifications | Core |
| `releases` | Release management | Phase 11 |
| `release_reviews` | Release reviews | Phase 11 |
| `release_audit_log` | Release audit trail | Phase 11 |
| `release_links` | Public review links | Phase 11 |
| `release_freezes` | Deploy freezes | Phase 11 |
| `bills` | Financial tracking | Core |
| `vendors` | Vendor management | Core |
| `employees` | Employee records | Phase 11 |
| `shifts` | Shift scheduling | Phase 11 |
| `training_modules` | Training curriculum | Phase 11 |
| `opening_checklists` | Store opening | Phase 11 |
| `closing_checklists` | Store closing | Phase 11 |
| `incidents` | Incident management | Phase 5 |
| `calendar_events` | Company calendar | Phase 11 |
| `deadline_extensions` | Extension requests | Phase 9 |
| `penalties` | Penalty system | Phase 9 |
| `store_health_scores` | Store health metrics | Phase 11 |

---

## Comparison Script

```bash
#!/bin/bash
# compare_schemas.sh

PROD_SCHEMA=$(mysql -h "$DB_HOST" -u "$DB_USER" -N -e "
  SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
  WHERE TABLE_SCHEMA = '$DB_NAME'
  ORDER BY TABLE_NAME
" 2>/dev/null)

PREVIEW_SCHEMA=$(mysql -h "$PREVIEW_DB_HOST" -u "$PREVIEW_DB_USER" -N -e "
  SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
  WHERE TABLE_SCHEMA = '$PREVIEW_DB_NAME'
  ORDER BY TABLE_NAME
" 2>/dev/null)

echo "=== Tables in Production but NOT in Preview ==="
comm -23 <(echo "$PROD_SCHEMA") <(echo "$PREVIEW_SCHEMA")

echo ""
echo "=== Tables in Preview but NOT in Production ==="
comm -13 <(echo "$PROD_SCHEMA") <(echo "$PREVIEW_SCHEMA")
```

---

## Expected Results After Sync

```
Missing Tables:   0
Missing Columns:  0
Missing Indexes:  0
Schema Drift:     0
```

---

## Fix Procedure

If tables are missing on Preview:

```bash
# Run all migrations on Preview
docker exec bakudan-preview php migrate.php

# Or manually apply specific migrations
mysql -h preview-db -u bakudan bakudan_preview < database/migrations/2026_05_29_phase11_modules.sql
mysql -h preview-db -u bakudan bakudan_preview < database/migrations/2026_05_29_release_management.sql
mysql -h preview-db -u bakudan bakudan_preview < database/migrations/2026_05_29_franchise_platform.sql
```

---

## New Table: user_stores (Phase 12)

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
    INDEX idx_us_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed from existing users.store_id
INSERT IGNORE INTO user_stores (user_id, store_id, is_primary)
SELECT id, store_id, 1 FROM users WHERE store_id IS NOT NULL;
```

---

## Verification

After applying fixes:

```sql
-- Count tables on both
SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE();
-- Must match between Production and Preview
```

**Status: PENDING — Execute on live environments**
