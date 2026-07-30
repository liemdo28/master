# LOGIN_ROOT_CAUSE.md — P0 Login Page Root Cause Analysis

**Date:** 2026-06-22
**Production URL:** https://dashboard.bakudanramen.com/login
**Status:** ✅ FIXED AND DEPLOYED (commit a720835)

---

## Root Cause Determination

### Classification

**Category:** E — Database schema mismatch (column name mismatch)

The production `remember_tokens` table was created with a different column name than what the PHP code expected, causing an SQL exception when "Remember Me" is used.

**NOT:**
- A. AuthController failure (logic is correct)
- B. Session failure (sessions work fine)
- C. CSRF failure (CSRF validation works)
- D. Database query failure (queries work when column names match)
- F. Missing column (column exists — wrong name)
- G. Environment variable failure (June 16 issue, resolved externally)
- H. Autoload failure

---

## Exact Details

### File
`controllers/AuthController.php`

### Lines affected
- `setRememberToken()` — line 67
- `clearRememberToken()` — line 84
- `resetUserPassword()` — line 179
- `adminUpdateUser()` — line 229
- `updateSettings()` — line 289

### Exception
```
PDOException: SQLSTATE[42S22]: Column not found: 1054 Unknown column 'token_hash' in 'field list'
```

### SQL Statement (from `setRememberToken()`)
```sql
INSERT INTO remember_tokens (user_id, token_hash, expires_at) VALUES (?,?,?)
```

### Trigger Mechanism

1. `run_missing_migrations.php` created `remember_tokens` on production with:
   ```sql
   CREATE TABLE remember_tokens (
     id INT AUTO_INCREMENT PRIMARY KEY,
     user_id INT NOT NULL,
     token VARCHAR(255) NOT NULL,          -- ← wrong column name
     expires_at DATETIME NOT NULL,
     created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
   )
   ```

2. `database/migrations/2026_06_15_remember_tokens.sql` (correct schema):
   ```sql
   CREATE TABLE remember_tokens (
     id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
     user_id INT UNSIGNED NOT NULL,
     token_hash VARCHAR(64) NOT NULL,      -- ← correct column name
     expires_at DATETIME NOT NULL,
     created_at DATETIME DEFAULT CURRENT_TIMESTAMP
   )
   ```

3. `AuthController::setRememberToken()` queries for `token_hash` column:
   ```sql
   INSERT INTO remember_tokens (user_id, token_hash, expires_at) VALUES (?,?,?)
   ```
   → **Unknown column 'token_hash'** → `PDOException` → exception handler → "Something went wrong"

4. This only occurs when **"Remember Me" is checked** during login.

---

## Why `/login` GET worked but POST failed

| Request type | What happens | Result |
|---|---|---|
| GET /login | Render login form — no DB query | HTTP 200 ✅ |
| POST /login (no Remember Me) | Verify credentials → success → redirect | HTTP 302 ✅ |
| POST /login (Remember Me checked) | Verify credentials → setRememberToken() → **exception** | HTTP 500 ❌ |

---

## Resolution

**Fix applied:** commit `a720835`
**File:** `controllers/AuthController.php`

Added dynamic column name detection in `setRememberToken()` and `clearRememberToken()`:
```php
// Detect which column exists in production schema
$col = $db->columnExists('remember_tokens', 'token_hash') ? 'token_hash' : 'token';
$db->execute("INSERT INTO remember_tokens (user_id, {$col}, expires_at) VALUES (?,?,?)", [...]);
```

Also added `tableExists()` guards in `resetUserPassword()`, `adminUpdateUser()`, and `updateSettings()`.

**Deployed:** ✅ `DEPLOY_OK` — production running commit `a720835`

---

## Recommended Permanent Fix

The `run_missing_migrations.php` script used a different column name (`token`) than the proper migration (`2026_06_15_remember_tokens.sql` with `token_hash`). These two migration sources should be aligned.

Recommended action: rename the production column or standardize the migration:
```sql
ALTER TABLE remember_tokens CHANGE COLUMN token token_hash VARCHAR(64) NOT NULL;
```

This would allow dropping the `columnExists()` workaround and using `token_hash` consistently.
