# P1 BUG REPORT — Task Create: Submit Button Covered by Modal Overlay

| Field | Value |
|-------|-------|
| **Severity** | P1 |
| **Status** | OPEN |
| **Detected** | 2026-06-03 13:12 ICT |
| **Environment** | https://preview.dashboard.bakudanramen.com |
| **Affected Tests** | 02-task-create (cascades to 03–09, 11) |
| **Test file** | `qa/playwright/02-task-create.spec.ts:93` |

---

## Summary

When the Create Task modal (`#createTaskModal`) is open, Playwright cannot click the submit/save button inside it. The modal overlay div (`<div id="createTaskModal" class="modal-overlay ct-modal open">`) intercepts pointer events on the entire modal surface, blocking interaction with the submit button.

## Root Cause

The submit button locator resolves to `<button class="create-new-btn" data-action="toggle-create-dropdown">` — the **wrong element**. The actual submit button inside the modal matches a CSS selector that is somehow being shadowed or not properly targeted, while the overlay div covers it and captures all clicks.

Likely causes:
1. **Z-index / stacking context**: Modal overlay z-index higher than the button's z-index, or button rendered below overlay in stacking order
2. **Wrong button selector**: The modal's actual submit button has a different selector than what the test targets — the locator `.first()` picks up the floating "Create New" dropdown button instead of the modal's submit button
3. **CSS class mismatch**: Modal may use different internal structure than expected by the test selectors

## Evidence

| Artifact | Path |
|----------|------|
| **Screenshot** | `qa/artifacts/test-results/02-task-create-02---Task-Create-create-a-new-task-workflow/test-failed-1.png` |
| **Video** | `qa/artifacts/test-results/02-task-create-02---Task-Create-create-a-new-task-workflow/video.webm` |
| **Trace** | `qa/artifacts/test-results/02-task-create-02---Task-Create-create-a-new-task-workflow/trace.zip` |
| **Error context** | `qa/artifacts/test-results/02-task-create-02---Task-Create-create-a-new-task-workflow/error-context.md` |

## Error

```
TimeoutError: locator.click: Timeout 15000ms exceeded.
Call log:
  - waiting for locator('#createTaskModal button[type="submit"],
    .modal button[type="submit"], button:has-text("Save"),
    button:has-text("Create")').first()
  - locator resolved to <button class="create-new-btn" data-action="toggle-create-dropdown">…</button>
  - <div id="createTaskModal" class="modal-overlay ct-modal open">…</div> intercepts pointer events
```

## QA Results Impact

| Test | Status | Reason |
|------|--------|--------|
| 00 - Auth setup | PASS | |
| 01a - Dashboard loads | PASS | |
| 01b - Logout | PASS | |
| 01c - Invalid credentials | PASS | |
| **02 - Task Create** | **FAILED** | Modal overlay blocks submit button click |
| 03 - Task Save | SKIPPED | Cascade (no taskId) |
| 04 - Task Reload | PASS | |
| 05 - Task Submit | SKIPPED | Cascade (no taskId) |
| 06 - Reviewer Approve | SKIPPED | Cascade (no taskId) |
| 07 - Approver Accept | SKIPPED | Cascade (no taskId) |
| 08 - Attachments | SKIPPED | Cascade (no taskId) |
| 09 - Comments + @mentions | SKIPPED | Cascade (no taskId) |
| 10a - Notifications UI | PASS | |
| 10b - Notifications API | PASS | |
| 11 - DB Validation | SKIPPED | Cascade (no task created) |

**Total: 7 PASSED, 1 FAILED, 7 SKIPPED**

## Fix Required

### Option A — Fix button selector (preferred, if it's a test issue)
The locator needs to target the button inside `#createTaskModal` more specifically. Use `.modal-content` or the modal body's submit button directly:

```ts
// Replace the broad button locator with modal-specific targeting
const submitBtn = page.locator('#createTaskModal .modal-content button[type="submit"], #createTaskModal .ct-modal-footer button:has-text("Save")').first();
```

Or use the exact button text inside the modal:
```ts
const submitBtn = page.locator('#createTaskModal').locator('button:has-text("Save")').first();
```

### Option B — Fix z-index (if it's an app CSS issue)
Inspect the modal's CSS and ensure:
- `#createTaskModal` (overlay) has `pointer-events: none` on the overlay background but `pointer-events: auto` on the modal content
- The submit button has higher z-index than any overlay backdrop
- Modal content is rendered above the overlay layer

```css
/* Ensure overlay background doesn't block buttons */
#createTaskModal.modal-overlay {
  pointer-events: none;
}
#createTaskModal .modal-content,
#createTaskModal .ct-modal-body,
#createTaskModal .ct-modal-footer {
  pointer-events: auto;
  position: relative;
  z-index: 10;
}
```

### Option C — Use JavaScript click (workaround)
```ts
await page.evaluate(() => {
  const btn = document.querySelector('#createTaskModal button[type="submit"]');
  if (btn) (btn as HTMLElement).click();
});
```

## Related Issues

- `docs/qa/P1_DASHBOARD_NETWORKIDLE_TIMEOUT.md` — Previous QA run, different failure (test infrastructure)
- `docs/qa/P1_SESSION_LOST_TASK_CREATE.md` — Previous QA run, session cascade (test infrastructure)

## Investigation Steps

1. Open `qa/artifacts/test-results/02-task-create-02---Task-Create-create-a-new-task-workflow/trace.zip` with `npx playwright show-trace`
2. Inspect the DOM snapshot at failure time to find the exact button inside `#createTaskModal`
3. Compare with the test's locator strategy
4. If app issue: check CSS z-index / pointer-events on modal
5. If test issue: update the button locator to be more specific
