# Final Bug Report — dashboard.bakudanramen.com
**Date:** 2026-05-20  
**Stack:** PHP 8.0+ MVC, MySQL, Vanilla JS, DreamHost Shared Hosting  
**Audit scope:** All PHP controllers, models, views, helpers, JS assets

---

## 2026-05-20 Stabilization Update

| Issue | Root Cause | Fix Applied | Verification |
|---|---|---|---|
| Notification polling could spam hidden tabs and keep stale requests alive | `setInterval(loadNotifications, 30000)` ran regardless of visibility and never aborted in-flight requests | Added `TaskFlowRuntime.timeoutFetch()`, AbortController de-dupe, visibility-aware scheduling, retry backoff, and frontend error logging | `node --check assets/js/*.js` |
| Sidebar badge polling could duplicate work and silently fail | Poller had no timeout/backoff and swallowed errors | Added visibility skip, request abort, exponential backoff, and telemetry logging | `node --check assets/js/*.js` |
| Random component crash when layout elements are absent | Direct `getElementById(...).classList` access on optional dropdown/modal nodes | Added null-safe guards for create dropdown/task modal and sidebar toggle | `node --check assets/js/*.js` |
| Frontend white-page errors were hard to diagnose | Browser runtime errors only logged to console | Added bounded `/api/client-log` endpoint writing to `logs/errors/frontend-errors.log` | `php -l index.php` |
| PHP 8.4 deprecation warning during syntax/audit runs | Fallback OpenAI HTTP code read used deprecated local `$http_response_header` variable | Switched to `http_get_last_response_headers()` when available | `php -l service/OpenAIService.php` |
| Stress script did not satisfy one-command local testing | Script defaulted to production URL and did not start a debug server | `./scripts/stress-test.sh` now starts a local PHP server, writes `logs/runtime-debug.log`, runs nav spam, tab simulation, telemetry checks, and PHP syntax scan | `bash -n scripts/stress-test.sh` |
| Missing baseline security headers | Entry point did not emit `X-Content-Type-Options`, `X-Frame-Options`, or `Referrer-Policy` | Added headers globally in `index.php` | `./scripts/stress-test.sh` |

## Current Scope Reality Check

- This repository is not a React/Next dashboard. It is PHP MVC + vanilla JS. Hydration mismatch and React Profiler checks are not applicable.
- There is no `package.json` or `composer.json`; dependency audit is source/runtime based and documented in `reports/dependency-audit.md`.
- Authenticated deep-page/API stress still requires a valid `PHPSESSID` cookie.

---

## Critical Bugs Fixed (Session)

### BUG-001 — `Cannot redeclare AuthController::deleteUser()`
- **File:** `controllers/AuthController.php:381`
- **Root cause:** `deleteUser()` method defined twice (duplicate at line 381, original at 352)
- **Symptom:** Fatal PHP error on ALL pages
- **Fix:** Removed duplicate method block (lines 381–387)
- **Commit:** `00d98d0`

---

### BUG-002 — `Parse error: unexpected end of file` in `main.php`
- **File:** `views/layouts/main.php:681`
- **Root cause:** A recent commit added `if (!empty($sidebarProjects)):` at line 234 but omitted the closing `<?php endif; ?>`
- **Symptom:** Fatal PHP parse error on ALL pages
- **Fix:** Added `<?php endif; ?>` before closing `</nav>` tag
- **Commit:** `8b5d2a0`

---

### BUG-003 — `Call to undefined method Task::canEdit()`
- **File:** `controllers/TaskController.php:49`, `controllers/api/v1/TaskApiController.php:562`, `controllers/api/v1/UploadApiController.php:29`
- **Root cause:** `canEdit()` method called in 3 controllers but never defined in `Task` model
- **Symptom:** Fatal error on `/tasks/{id}` page
- **Fix:** Added `canEdit(int $taskId, int $userId): bool` method to `models/Task.php`
- **Commit:** `9932bdb`

---

### BUG-004 — `Call to undefined method Task::createNextRecurringOccurrence()`
- **File:** `models/Task.php:307`
- **Root cause:** `toggleComplete()` calls `createNextRecurringOccurrence()` and `normalizeRepeatType()` etc., but these private helper methods were missing (stripped in a recent refactor)
- **Symptom:** Fatal error on `/tasks/{id}/toggle` (marking task complete)
- **Fix:** Restored 10 missing methods from backup: `normalizeRepeatType`, `clampRepeatInterval`, `decodeRepeatConfig`, `normalizeRepeatConfig`, `taskDateTime`, `recurrenceRootId`, `recurringSourceTask`, `nextOccurrenceDueDate`, `recurringOccurrenceExists`, `createNextRecurringOccurrence`
- **Commit:** `9911b11`

---

## Issues Fixed (Hardening Session)

### BUG-005 — Blank page on any PHP exception (no error handler)
- **File:** `index.php`
- **Root cause:** PHP exceptions/errors had no global handler — resulted in white/blank page
- **Fix:**
  - Added `set_exception_handler()` → renders user-friendly error page (never blank)
  - Added `set_error_handler()` → logs PHP warnings/notices
  - Changed `display_errors` to `0`, `log_errors` to `1`
  - Log target: `logs/errors/php-errors.log`
  - Wrapped route switch in try-catch
- **Commit:** This session

---

### BUG-006 — JS: `apiRequest()` silently swallows HTTP errors
- **File:** `assets/js/app.js`
- **Root cause:** `fetch().then(r => r.json())` — doesn't check `r.ok`, so 4xx/5xx responses parsed as data silently
- **Fix:** Added `if (!r.ok) throw new Error('HTTP ' + r.status)` before `r.json()`
- **Fix:** Added `AbortController` signal support to `apiRequest()`
- **Fix:** Added global `unhandledrejection` logger

---

### BUG-007 — JS: `markAllNotifRead()` missing `.catch()`
- **File:** `assets/js/app.js:138`
- **Root cause:** Unhandled promise rejection on network failure
- **Fix:** Added `.catch(() => {})` guard

---

### BUG-008 — JS: Duplicate `toggle-sb-system` event handler
- **File:** `assets/js/layout.js`
- **Root cause:** The `toggle-sb-system` action was handled TWICE — once in the main `[data-action]` delegation and once in a separate `addEventListener` block
- **Fix:** Removed the duplicate handler

---

### BUG-009 — JS: Notification poller runs multiple times per page
- **File:** `assets/js/app.js`
- **Root cause:** `setInterval(loadNotifications, 30000)` had no guard — called on every include
- **Fix:** Added `window._notifPollerStarted` guard

---

### BUG-010 — JS: Badge poller has same duplicate risk
- **File:** `assets/js/layout.js`
- **Fix:** Added `window._sbBadgePollerStarted` guard

---

### BUG-011 — JS: Race condition in task-drawer (stale fetch response)
- **File:** `assets/js/task-drawer.js`
- **Root cause:** Rapid navigation through dates could render stale API response (previous date's tasks shown for new date)
- **Fix:** Added `AbortController` — previous in-flight `fetchDay()` is cancelled when a new date is opened

---

## Issues Identified but Not Fixed (Low Priority)

### INFO-001 — N+1 Query pattern in some views
- Some PHP views call DB inside foreach loops (especially penalty/bill views)
- Impact: Slow page load with many records
- Recommendation: Add query caching or batch-load with JOIN
- Priority: Medium

### INFO-002 — No HTTP security headers
- Missing: `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`
- Can be added via `.htaccess`
- Priority: Medium

### INFO-003 — JS addEventListener never removed
- All 40+ event listeners on `document` persist forever
- For a PHP MVC (full page reload navigation), this is not a memory leak concern
- Would be a concern if upgraded to SPA
- Priority: Low

---

## Audit Summary

| Area | Files Checked | Issues Found | Fixed |
|------|---------------|--------------|-------|
| PHP Syntax | 80+ files | 0 remaining | — |
| Controller→Model methods | All controllers | 0 missing | — |
| Route→Controller methods | index.php (1153 lines) | 0 missing | — |
| Fatal errors (runtime) | Production logs | 4 bugs | 4 fixed |
| JS fetch error handling | 7 JS files | 3 bugs | 3 fixed |
| JS race conditions | task-drawer.js | 1 bug | 1 fixed |
| JS duplicate handlers | layout.js | 1 bug | 1 fixed |
| Global error handling | index.php | 1 missing | 1 fixed |
| Log protection | .htaccess | 1 missing | 1 fixed |
