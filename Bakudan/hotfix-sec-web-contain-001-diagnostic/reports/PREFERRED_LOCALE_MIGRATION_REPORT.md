# Preferred Locale Migration Report

**Date:** 2026-06-22

## Migration: Add `preferred_locale` to `users` table

### Column Definition
| Property | Value |
|----------|-------|
| Table | `users` |
| Column | `preferred_locale` |
| Type | `VARCHAR(10)` |
| Default | `en-US` |
| Allowed Values | `en-US`, `es-US`, `vi-VN` |
| Position | After `role` |

### Migration Script
`migrate_preferred_locale.php` — idempotent (checks if column exists first)

### Deploy Gate Integration
`deploy.php` now includes `users.preferred_locale` in the `$requiredColumns` schema check.

### Verification
- `Database::columnExists('users', 'preferred_locale')` check in migration script
- Schema gate in deploy.php blocks deploy if column is missing

### Rollback
```sql
ALTER TABLE users DROP COLUMN preferred_locale;
```
