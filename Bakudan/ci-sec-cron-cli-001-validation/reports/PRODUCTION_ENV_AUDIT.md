# PHASE 13.8C — PRODUCTION ENVIRONMENT AUDIT

**Date:** 2026-06-17  
**Scope:** DB_HOST, DB_NAME, DB_USER, DB_PASS validation  
**Method:** Static analysis of config/database.php + error log evidence + .env.example

---

## 1. ENVIRONMENT CONFIGURATION

### From `config/database.php` (fallback defaults):

| Constant | Default Value | Loaded From |
|----------|--------------|-------------|
| DB_HOST | `mysql-taskflow.bakudanramen.com` | `$_ENV['DB_HOST']` or `getenv('DB_HOST')` |
| DB_PORT | `3306` | `$_ENV['DB_PORT']` or `getenv('DB_PORT')` |
| DB_NAME | `taskflow_db` | `$_ENV['DB_NAME']` or `getenv('DB_NAME')` |
| DB_USER | `liemdo` | `$_ENV['DB_USER']` or `getenv('DB_USER')` |
| DB_PASS | `''` (empty string) | `$_ENV['DB_PASS']` or `getenv('DB_PASS')` |
| APP_ENV | auto-detected | `safety_get_env()` |

### Env File Resolution Order:

1. `$_SERVER['APP_ENV_FILE']` (forced file)
2. `.env.preview` (if subdomain matches `preview|draft|staging`)
3. `.env` (fallback)

---

## 2. PRODUCTION EVIDENCE

### Error Log Evidence (from `logs/errors/php-errors.log`):

| Timestamp | Error | Evidence |
|-----------|-------|----------|
| 29-May-2026 10:07:45 | `[CONFIG] Missing required environment variables: DB_PASS` | **12 occurrences** — .env not deployed |
| 16-Jun-2026 15:24:16 UTC | `[CONFIG] Missing required environment variables: DB_PASS` | **Still missing** 18 days later |

### Production Config Behavior:

```
database.php line 76-117: fail-fast mechanism
  IF (not CLI) AND (not localhost) AND (DB_PASS is empty):
    → HTTP 503
    → "Service Unavailable — The application is misconfigured"
    → exit(1)
```

**This means:** If `.env` is not deployed with `DB_PASS`, every request returns HTTP 503.

### Production Auth Failure:

```
06-Jun-2026 18:32:09 — SQLSTATE[42S02]: Table 'bakudan_preview.users' doesn't exist
  at User.php:75 (findByEmail)
  at AuthController.php:32 (login)
```

**This means:** Preview environment's `users` table does not exist. Login is broken.

---

## 3. ENVIRONMENT STATUS MATRIX

| Variable | Production | Preview | Local |
|----------|-----------|---------|-------|
| DB_HOST | `mysql-taskflow.bakudanramen.com` | (from .env.preview) | `localhost` |
| DB_PORT | `3306` | `3306` | `3306` |
| DB_NAME | `taskflow_db` | `bakudan_preview` | `taskflow_db` |
| DB_USER | `liemdo` | (from .env.preview) | `root` |
| DB_PASS | **⚠️ MISSING** | (from .env.preview) | `''` |
| `.env` exists | **❌ NO** (in local repo) | `.env.preview` | **❌ NO** |
| PHP CLI | Server PHP | Server PHP | **❌ NOT FOUND** |

---

## 4. CRITICAL BLOCKERS

### BLOCKER 1: `.env` file missing from local repo

The `.env` file is not present in the project directory (`dir .env` → "File Not Found").  
This is expected — `.env` is typically in `.gitignore`. But it MUST exist on:
- Production server (deployed via CI/CD or manual upload)
- Local development machine
- Preview server

### BLOCKER 2: `DB_PASS` empty in production

Error log shows `[CONFIG] Missing required environment variables: DB_PASS` at:
- 2026-05-29 10:07:45 (12 times)
- 2026-06-16 15:24:16 (1 time, most recent)

**Impact:** Every request returns HTTP 503 with "Service Unavailable" message.

### BLOCKER 3: PHP CLI not available locally

`C:\xampp\php\php.exe` does not exist on this Windows machine.  
Cannot run `migrate.php`, `verify-schema.php`, or any PHP scripts locally.

### BLOCKER 4: Preview database not initialized

The `bakudan_preview` database is missing tables:
- `users` (can't login)
- `bills` (dashboard crashes)
- `task_stores` (task assignment fails)

---

## 5. REQUIRED ACTIONS

### Immediate (P0)

| # | Action | Where | Owner |
|---|--------|-------|-------|
| 1 | Create `.env` from `.env.example` with correct `DB_PASS` | Local + Prod + Preview | DevOps |
| 2 | Upload `.env` to production server | DreamHost | DevOps |
| 3 | Upload `.env.preview` to preview server | DreamHost | DevOps |
| 4 | Restore/install PHP CLI locally | Windows | Developer |

### After env is fixed (P0)

| # | Action | Where | Owner |
|---|--------|-------|-------|
| 5 | Run `php migrate.php` on production | DreamHost SSH | Developer |
| 6 | Run `php migrate.php` on preview | DreamHost SSH | Developer |
| 7 | Run `php scripts/verify-schema.php` on all envs | All | Developer |
| 8 | Verify no 503 errors in logs | All | QA |

### Validation (P1)

| # | Action | Expected Result |
|---|--------|----------------|
| 9 | `curl -I https://dashboard.bakudanramen.com/` | HTTP 200 (not 503) |
| 10 | `curl -I https://preview.dashboard.bakudanramen.com/` | HTTP 200 (not 503) |
| 11 | Local: `php scripts/verify-schema.php` | All checks PASS |

---

## 6. .env.example TEMPLATE

From the project's `.env.example`:

```env
DB_HOST=mysql-taskflow.bakudanramen.com
DB_PORT=3306
DB_NAME=taskflow_db
DB_USER=liemdo
DB_PASS=<SET_THIS_TO_CORRECT_PASSWORD>
APP_URL=https://dashboard.bakudanramen.com
APP_ENV=production
```

**⚠️ NEVER commit `.env` to git.** Deploy securely.

---

## 7. VERIFICATION COMMANDS (once PHP available)

```bash
# Test DB connection
php -r "
  require_once 'config/database.php';
  echo 'Connected to ' . DB_HOST . '/' . DB_NAME . PHP_EOL;
"

# Full schema verification
php scripts/verify-schema.php

# Check specific table
php -r "
  require_once 'config/database.php';
  \$db = Database::getInstance();
  echo 'bills: ' . (\$db->tableExists('bills') ? 'EXISTS' : 'MISSING') . PHP_EOL;
  echo 'stores: ' . (\$db->tableExists('stores') ? 'EXISTS' : 'MISSING') . PHP_EOL;
  echo 'notifications: ' . (\$db->tableExists('notifications') ? 'EXISTS' : 'MISSING') . PHP_EOL;
  echo 'task_stores: ' . (\$db->tableExists('task_stores') ? 'EXISTS' : 'MISSING') . PHP_EOL;
  echo 'tasks.visibility: ' . (\$db->columnExists('tasks', 'visibility') ? 'EXISTS' : 'MISSING') . PHP_EOL;
  echo 'tasks.submitted_at: ' . (\$db->columnExists('tasks', 'submitted_at') ? 'EXISTS' : 'MISSING') . PHP_EOL;
  echo 'tasks.recurring_root_id: ' . (\$db->columnExists('tasks', 'recurring_root_id') ? 'EXISTS' : 'MISSING') . PHP_EOL;
  echo 'releases.title: ' . (\$db->columnExists('releases', 'title') ? 'EXISTS' : 'MISSING') . PHP_EOL;
  echo 'releases.published_by: ' . (\$db->columnExists('releases', 'published_by') ? 'EXISTS' : 'MISSING') . PHP_EOL;
  echo 'notifications.sender_id: ' . (\$db->columnExists('notifications', 'sender_id') ? 'EXISTS' : 'MISSING') . PHP_EOL;
  echo 'task_notifications.inbox_category: ' . (\$db->columnExists('task_notifications', 'inbox_category') ? 'EXISTS' : 'MISSING') . PHP_EOL;
"
```

---

*Generated from static analysis of config/database.php + error log evidence.*
