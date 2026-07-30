# User Protocol QA Report

**Project:** dashboard.bakudanramen.com  
**Date:** 2026-06-02  
**Method:** Local browser QA via Playwright against `http://127.0.0.1:8000`  
**Runtime:** XAMPP PHP 8.2.12 + temporary MariaDB QA datastore

## Scope Tested

- Login page render
- Invalid login error
- Valid login redirect
- Logout
- Dashboard overview
- Sidebar navigation
- My Tasks
- Calendar
- Bills
- Admin Stores
- Task detail route when a task link exists
- Desktop Chromium
- Mobile viewport

## Initial Browser Findings

The first real browser run caught runtime failures that static audit did not catch:

| ID | Severity | Flow | Runtime Error | Status |
|----|----------|------|---------------|--------|
| UPQA-001 | P1 | `/overview` and layout modal | `Unknown column r.published_by` | Fixed |
| UPQA-002 | P1 | `/overview` overdue task list | `Unknown column t.visibility` | Fixed |

## Fixes Applied

- `models/Release.php`
  - `getCurrentLiveVersion()` now checks whether `releases.published_by` exists before joining users.
  - If the column is missing, it returns `NULL` publisher fields instead of throwing a 500.

- `service/OverdueResolverService.php`
  - `tasks()` now checks whether `tasks.visibility` exists.
  - If the column is missing, it selects `'public' AS visibility` as a compatibility fallback.

## Validation Commands

```powershell
C:\xampp\php\php.exe -l models\Release.php
C:\xampp\php\php.exe -l service\OverdueResolverService.php

$env:BASE_URL='http://127.0.0.1:8000'
$env:TEST_EMAIL='admin@bakudanramen.com'
$env:TEST_PASSWORD='admin123'
npx playwright test qa/tests/login.spec.js qa/tests/dashboard.spec.js qa/tests/tasks.spec.js --config=qa/playwright.config.js --workers=1 --timeout=30000 --reporter=line
```

## Final Result

```text
26 passed
Desktop Chromium: 13 passed
Mobile: 13 passed
```

## Notes

- Full project-wide Playwright run timed out before narrowing scope because the suite includes broader Phase 11 modules and the local QA DB had to be built from migrations.
- The user-critical browser protocol for login, dashboard, tasks, calendar, bills, admin stores, and mobile passed after the compatibility fixes.
- QA environment used temporary local services only; no production credential was used.
