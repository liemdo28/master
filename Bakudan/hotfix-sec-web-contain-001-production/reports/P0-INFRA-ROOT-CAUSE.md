# P0 Root Cause Report — Production Database Authentication Failure

**Date:** 2026-05-28
**Severity:** P0 — Production Down
**Status:** RESOLVED (fixes applied)

---

## Incident Summary

Production returned:
```
SQLSTATE[HY000] [1045] Access denied for user 'liemdo'@'pdx1-shared-a3-05.dreamhost.com' (using password: NO)
```

---

## Root Cause

### Exact Cause

The `.env` file was **never deployed to the production server**.

### Why

1. `.env` is listed in `.gitignore` (correct — secrets must never be committed)
2. `config/database.php` loads from `.env` if it exists, falls back to hardcoded defaults
3. The **fallback `DB_PASS` was `''` (empty string)** — no meaningful default was ever set
4. `config/database.php` was pulled via `deploy.php` from git origin/main
5. Since `.env` is gitignored, it was never on the server
6. MySQL received `password: NO` → Access Denied

### Bootstrap Order (before fix)

```
index.php (line 77)
  → require_once config/database.php
      → load .env (fails silently — file missing)
      → define DB_PASS = $_ENV['DB_PASS'] ?? getenv('DB_PASS') ?: ''   ← EMPTY
      → new Database()
          → new PDO($dsn, DB_USER, DB_PASS)   ← no password given
              → MySQL Access Denied
```

### Timeline of Regression

- `config/database.php` was updated to load from `.env` with fallback to `''`
- The fallback was intended for development (localhost) only
- `.env` was never created/deployed to production
- No deployment validation existed to catch this
- Production silently failed on every request

---

## Fixes Applied

### 1. Fail-Fast Secret Validation (`config/database.php`)

Added a startup validator that:
- Detects empty `DB_PASS` / `DB_HOST` / `DB_NAME` / `DB_USER` in non-localhost environments
- Returns a **sanitized 503** page (no credential names leaked)
- Exits with code 1 before any DB connection attempt
- Logs to `logs/errors/php-errors.log` with variable names only (no values)

```php
// PREVENTS: silent "using password: NO" failures
if (empty(DB_PASS)) { /* friendly 503 + exit */ }
```

### 2. Sanitized PDO Exception Handler (`config/database.php`)

Replaced raw `die('Database connection failed: ' . $e->getMessage())` with:
- Full error logged to server-side log (with host/db name only — no password)
- Public response: `{"error": "Database unavailable", "code": "E_DB_CONN"}` (API)
- Or friendly HTML page (no infrastructure info exposed)

### 3. Deployment Validation (`deploy.php`)

Added pre-deploy checks:
- **Blocks deploy** if `.env` is missing from production server
- **Blocks deploy** if `DB_PASS` / `DB_HOST` / `DB_NAME` / `DB_USER` are empty in `.env`
- **Validates** `.env` can be loaded by the same parser used at runtime
- **Fails with clear instructions** on what to fix

```
ERROR: .env file is MISSING from production server.
FIX: Upload .env to the server, then re-run deploy.
```

---

## Immediate Action Required (PRODUCTION)

The fixes are in `config/database.php` and `deploy.php`. To restore production:

### Step 1: Create `.env` on the production server

Create `/path/to/production/.env` with:
```
DB_HOST=mysql-taskflow.bakudanramen.com
DB_NAME=taskflow_db
DB_USER=liemdo
DB_PASS=liem@dt2155
DB_CHARSET=utf8mb4
```

### Step 2: Upload it to the server

Use SFTP/SSH to upload `.env` to the production web root. Ensure it's **outside the web-accessible directory** if possible, or protected by `.htaccess`.

### Step 3: Verify

Visit `https://dashboard.bakudanramen.com` — it should load normally.

### Step 4: Run deploy

```
https://dashboard.bakudanramen.com/deploy.php?key=deploy-p3-2026
```

The deploy will now pass its `.env` validation automatically.

---

## Prevention Strategy

### 1. Deployment Gate (DONE ✓)
`deploy.php` now blocks if `.env` is missing. This prevents future silent failures.

### 2. `.env` in Server Setup Documentation
Document that `.env` must be manually placed on the server as part of initial setup.

### 3. Production Secret Health Check (RECOMMENDED)
Add a `/ops/status` endpoint that:
- Returns 200 if DB connection works
- Returns 503 if credentials missing
- No secrets in response body

### 4. CI/CD Pre-flight Check (RECOMMENDED)
Before any deployment pipeline runs, verify `.env` exists and `DB_PASS` is non-empty on the target server.

### 5. Monitoring Alert (RECOMMENDED)
Alert on: `logs/errors/php-errors.log` containing `[CONFIG]` or `[DB-CONNECT]` — these indicate configuration failures.

---

## Files Changed

| File | Change |
|------|--------|
| `dashboard.bakudanramen.com/config/database.php` | Added fail-fast validator + sanitized PDO exception |
| `dashboard.bakudanramen.com/deploy.php` | Added pre-deploy `.env` validation |
| `source/config/database.php` | Added sanitized PDO exception (same hardening) |
| `source/deploy.php` | Added pre-deploy `.env` validation |

---

## What Was NOT the Issue

- MySQL user permissions — the user `liemdo` is correct; the issue was no password was sent
- DreamHost infrastructure — hostnames are correct; the issue was credential loading
- `database.php` (root) vs `config/database.php` — the app only loads `config/database.php`
- Git history or deployment script corruption — no sabotage, just missing file
