# QA FAILURE REPORT — 2026-06-03
## Target: https://preview.dashboard.bakudanramen.com

---

## Executive Summary

| Field | Value |
|-------|-------|
| Run date | 2026-06-03 13:12 ICT |
| Command | `npm run qa` |
| Total tests | 15 |
| Passed | 7 |
| Failed | 1 |
| Skipped | 7 |
| Bugs filed | 1 P1 |

---

## Failed Test: 02 - Task Create

**File:** `qa/playwright/02-task-create.spec.ts:93`
**Severity:** P1
**Bug report:** `docs/qa/P1_TASK_CREATE_MODAL_OVERLAY.md`

### Error

```
TimeoutError: locator.click: Timeout 15000ms exceeded.
Call log:
  - locator resolved to <button class="create-new-btn" data-action="toggle-create-dropdown">…</button>
  - <div id="createTaskModal" class="modal-overlay ct-modal open">…</div> intercepts pointer events
```

### Root Cause (preliminary)

The submit button inside `#createTaskModal` is covered by the modal overlay div. The Playwright locator `.first()` matches the wrong element — the floating "Create New" dropdown button instead of the modal's submit button. This is either:
- A **test spec selector bug** — the locator needs to be scoped to the modal's inner content
- An **app CSS bug** — z-index / pointer-events on the modal overlay layer blocks the button

### Cascade Impact

7 downstream tests (03–09, 11) skipped because task creation is a prerequisite.

---

## Test Coverage

| # | Scenario | Status | Evidence |
|---|----------|--------|----------|
| 1 | Login / auto-login | ✅ PASS | `qa/artifacts/test-results/00-auth-setup-*/test-failed-1.png` |
| 2 | Dashboard loads | ✅ PASS | `qa/artifacts/test-results/01-login-*/test-failed-1.png` |
| 3 | /tasks loads | ✅ PASS | Same session as above |
| 4 | Create task | ❌ FAIL | `qa/artifacts/test-results/02-task-create-*/` |
| 5 | Save task | ⏭ SKIP | Cascade |
| 6 | Reload task | ✅ PASS | Independent test |
| 7 | Submit for review | ⏭ SKIP | Cascade |
| 8 | Reviewer approve/reject | ⏭ SKIP | Cascade |
| 9 | Approver accept | ⏭ SKIP | Cascade |
| 10 | Attachments | ⏭ SKIP | Cascade |
| 11 | Comments + @mentions | ⏭ SKIP | Cascade |
| 12 | Notifications | ✅ PASS | `qa/artifacts/test-results/10-notifications-*/` |

---

## Artifacts

| Type | Location |
|------|----------|
| Screenshot (failure) | `qa/artifacts/test-results/02-task-create-02---Task-Create-create-a-new-task-workflow/test-failed-1.png` |
| Video (failure) | `qa/artifacts/test-results/02-task-create-02---Task-Create-create-a-new-task-workflow/video.webm` |
| Trace (failure) | `qa/artifacts/test-results/02-task-create-02---Task-Create-create-a-new-task-workflow/trace.zip` |
| Error analysis | `qa/artifacts/test-results/02-task-create-02---Task-Create-create-a-new-task-workflow/error-context.md` |
| Console + network logs | Embedded in trace.zip (use `npx playwright show-trace`) |
| SQL evidence template | `docs/qa/SQL_EVIDENCE.md` |
| Playwright JSON results | `qa/reports/results.json` |
| Playwright HTML report | `qa/reports/html/` |

---

## Action Required

1. Investigate `docs/qa/P1_TASK_CREATE_MODAL_OVERLAY.md` — determine if this is a CSS issue in the app or a selector issue in the test spec
2. Fix the blocker to unblock the workflow cascade
3. Re-run `npm run qa` to complete the full 12-step workflow
4. Collect SQL evidence against `docs/qa/SQL_EVIDENCE.md`
