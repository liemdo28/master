# Preview Readiness Audit

**Date:** 2026-06-02  
**Status:** BLOCKED  
**Reason:** Preview DB unavailable.

## Current Gate

Preview cannot be used for QA while the root page shows:

```text
Service Unavailable
Database connection failed
```

## Test Plan To Run After DB Returns

| Flow | URL / Action | Expected |
|------|--------------|----------|
| Login | `/login` | Login page loads, valid preview user enters dashboard |
| Task List | `/my-tasks` | Task list renders without 500 |
| Task Detail | `/tasks/19737` | Opens without `task_comments` missing |
| Create Task | Create task modal/form | Saves task, redirects/updates list |
| Save Task | Edit title/priority/due date | Persisted after reload |
| Approval Workflow | submit -> review -> accept | Status advances correctly |
| Repeat Schedule | create repeat task | repeat config persists and displays |
| Inbox | `/inbox` | Notifications render; no missing `task_notifications` |
| Mobile | 375px viewport | Core pages usable |

## Required Commands

```bash
APP_ENV_FILE=/path/to/.env.preview php preview_db_health.php
APP_ENV_FILE=/path/to/.env.preview php scripts/schema-feature-audit.php
APP_ENV_FILE=/path/to/.env.preview php scripts/release-governance-schema-audit.php
```

Then:

```bash
BASE_URL=https://preview.dashboard.bakudanramen.com TEST_EMAIL=... TEST_PASSWORD=... npx playwright test qa/tests/login.spec.js qa/tests/dashboard.spec.js qa/tests/tasks.spec.js --config=qa/playwright.config.js --workers=1
```

## Decision

No production deploy and no new feature work until Preview DB health returns PASS.
