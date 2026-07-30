# Fixed Issues — dashboard.bakudanramen.com
**Session:** 2026-05-20  
**All changes deployed via GitHub Actions (rsync)**

---

## Stabilization Additions — 2026-05-20

| # | File | Fix |
|---|---|---|
| 10 | `assets/js/app.js` | Added `TaskFlowRuntime` with timeout fetch, request de-dupe, visibility-aware intervals, and frontend error telemetry |
| 11 | `assets/js/app.js` | Hardened notification loading with AbortController, hidden-tab skip, retry backoff, null-safe list access, and non-silent failures |
| 12 | `assets/js/app.js` | Throttled viewport resize handling via `requestAnimationFrame` |
| 13 | `assets/js/layout.js` | Hardened create dropdown/task modal against missing DOM nodes |
| 14 | `assets/js/layout.js` | Hardened sidebar badge polling with timeout, abort, hidden-tab skip, retry backoff, and telemetry |
| 15 | `index.php` | Added bounded `/api/client-log` frontend observability endpoint |
| 16 | `index.php` | Added baseline security headers: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` |
| 17 | `service/OpenAIService.php` | Removed PHP 8.4 deprecation warnings from fallback HTTP response header parsing |
| 18 | `scripts/stress-test.sh` | Added one-command local PHP server stress run, runtime log export, 100x navigation spam, 20-tab simulation, and telemetry failure recovery checks |
| 19 | `reports/dependency-audit.md` | Added source/runtime dependency audit explaining PHP stack and non-applicability of npm/Next checks |

---

## PHP Fixes

| # | File | Fix | Commit |
|---|------|-----|--------|
| 1 | `controllers/AuthController.php` | Remove duplicate `deleteUser()` method | `00d98d0` |
| 2 | `views/layouts/main.php` | Add missing `endif` for `sidebarProjects` if-block | `8b5d2a0` |
| 3 | `models/Task.php` | Add missing `canEdit()` method | `9932bdb` |
| 4 | `models/Task.php` | Restore 10 missing recurring task methods | `9911b11` |
| 5 | `index.php` | Add global exception handler (no blank pages) | This session |
| 6 | `index.php` | Wrap router in try-catch | This session |
| 7 | `index.php` | Set `display_errors=0`, `log_errors=1` | This session |
| 8 | `.gitignore` | Exclude runtime log files | This session |
| 9 | `logs/.htaccess` | Protect log files from public access | This session |

---

## JavaScript Fixes

| # | File | Fix |
|---|------|-----|
| 1 | `assets/js/app.js` | `apiRequest()`: throw on non-2xx HTTP responses |
| 2 | `assets/js/app.js` | `apiRequest()`: add `signal` parameter for AbortController |
| 3 | `assets/js/app.js` | `markAllNotifRead()`: add `.catch()` handler |
| 4 | `assets/js/app.js` | Notification poller: add `_notifPollerStarted` guard |
| 5 | `assets/js/app.js` | Add global `unhandledrejection` logger |
| 6 | `assets/js/layout.js` | Remove duplicate `toggle-sb-system` event handler |
| 7 | `assets/js/layout.js` | Badge poller: add `_sbBadgePollerStarted` guard |
| 8 | `assets/js/task-drawer.js` | Add `AbortController` to cancel stale `fetchDay()` requests |
| 9 | `assets/js/task-drawer.js` | Pass `signal` through `fetchDay()` to fetch() |

---

## Infrastructure

| # | Change |
|----|--------|
| 1 | Created `logs/errors/` directory with `.htaccess` protection |
| 2 | Created `logs/performance/` directory |
| 3 | Created `reports/` directory |
| 4 | Created `scripts/stress-test.sh` (one-command health check) |

---

## How to Run Stress Test

```bash
# Basic (public pages only):
./scripts/stress-test.sh

# With authenticated session (full test):
./scripts/stress-test.sh https://dashboard.bakudanramen.com 'PHPSESSID=your_session_id'
```
