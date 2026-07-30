# P1 BUG REPORT — Session Lost Before Task Create (Login Page Rendered Instead of /tasks)

| Field | Value |
|-------|-------|
| **Severity** | P1 |
| **Status** | OPEN |
| **Detected** | 2026-06-03 |
| **Environment** | https://preview.dashboard.bakudanramen.com |
| **Affected Tests** | 02-task-create, 03-09 (cascade), 11-db-validate |
| **Test file** | `qa/playwright/02-task-create.spec.ts` |

---

## Summary

When the `02-task-create` test navigates to `/tasks`, the page renders the **login form** instead of the tasks page. The stored Playwright session (from `00-auth-setup`) has become invalid by the time test #2 runs.

The auth-setup test logged in and saved session state successfully. However, when subsequent tests use that stored session, the server returns the login page instead of the authenticated content.

## Root Cause (Probable)

The `01-login.spec.ts` test explicitly **logs out** (navigates to `/logout`) in test case #2 and #3. Since all tests run sequentially in 1 worker, the logout destroys the server-side session. Even though Playwright uses `storageState` (cookies), the PHP session on the server was invalidated by the logout call.

The test order is:
1. `00-auth-setup` → saves session ✓
2. `01-login#dashboard-loads` → uses session (dashboard loads, but times out on networkidle)
3. `01-login#logout` → **LOGS OUT** → destroys server session
4. `01-login#invalid-creds` → logs out again
5. `02-task-create` → uses stale session cookie → server sees invalid session → redirects to login

## Evidence

**Error Context** shows the page snapshot at failure time:
```yaml
- heading "TaskFlow" [level=1]
- heading "Sign in to continue" [level=2]
- textbox "Email"
- textbox "Password"
- button "Sign In"
```

This is the login page, NOT the tasks page.

**Video**: `qa/artifacts/test-results/02-task-create-02---Task-Create-create-a-new-task-workflow/video.webm`
**Screenshot**: `qa/artifacts/test-results/02-task-create-02---Task-Create-create-a-new-task-workflow/test-failed-1.png`
**Trace**: `qa/artifacts/test-results/02-task-create-02---Task-Create-create-a-new-task-workflow/trace.zip`

## Fix Required

Option A — Prevent logout from destroying shared session:
- Move `01-login#logout` and `01-login#invalid-creds` tests to a separate browser context
- Or re-authenticate at the start of `02-task-create.spec.ts`

Option B — Re-login in each workflow test:
```ts
test.beforeEach(async ({ page }) => {
  // Re-authenticate if session expired
  await page.goto('/tasks');
  if (page.url().includes('/login')) {
    await page.fill('input[name="email"]', process.env.QA_EMAIL!);
    await page.fill('input[name="password"]', process.env.QA_PASSWORD!);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/overview**');
  }
});
```

Option C — Restructure test order:
- Move logout/invalid-creds tests to AFTER all workflow tests
- Or run them in a separate project that doesn't share session

## Impact

This failure cascades to ALL workflow tests (03-09, 11) because they depend on `taskId` from test #2.
