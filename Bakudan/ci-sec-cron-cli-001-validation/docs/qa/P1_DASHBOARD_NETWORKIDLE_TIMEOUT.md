# P1 BUG REPORT — Dashboard /tasks Times Out on `networkidle`

| Field | Value |
|-------|-------|
| **Severity** | P1 |
| **Status** | OPEN |
| **Detected** | 2026-06-03 |
| **Environment** | https://preview.dashboard.bakudanramen.com |
| **Affected Tests** | 01-dashboard, 02-task-create |
| **Test file** | `qa/playwright/01-login.spec.ts` |

---

## Summary

The `/dashboard` and `/tasks` pages never reach `networkidle` state due to continuous network activity (long-polling, real-time updates, chart data refresh, or SSE connections). This causes the Playwright `waitForLoadState('networkidle')` to timeout after 30 seconds, even though the page has fully loaded and is functional.

## Root Cause

The dashboard/overview page uses continuous network activity:
- Real-time data polling (every 5-30s)
- Possibly SSE/WebSocket connections
- Chart data loading cycles

This prevents `networkidle` from ever resolving within the 30s timeout.

## Evidence

**Screenshot**: `qa/artifacts/test-results/01-login-01---Login-dashboard-loads-after-authentication-workflow/test-failed-1.png`
**Video**: `qa/artifacts/test-results/01-login-01---Login-dashboard-loads-after-authentication-workflow/video.webm`
**Trace**: `qa/artifacts/test-results/01-login-01---Login-dashboard-loads-after-authentication-workflow/trace.zip`

The page snapshot shows the FULL dashboard with all navigation, content, and data loaded correctly. The page is functional — the failure is only in the test waiting for `networkidle`.

## QA Results Impact

| Test | Status | Reason |
|------|--------|--------|
| 01 - dashboard loads | FAILED | networkidle timeout |
| 02 - task create | FAILED | cascade (session expired + tasks page also networkidle) |
| 03-09 - all workflow | FAILED | cascade (depends on task creation) |
| 10 - notifications | PASSED | does not use networkidle |
| 11 - db validate | FAILED | cascade |

## Fix Required

In `qa/playwright/01-login.spec.ts` and `qa/playwright/02-task-create.spec.ts`, replace:
```ts
await page.waitForLoadState('networkidle');
```
With:
```ts
await page.waitForLoadState('domcontentloaded');
// OR
await page.waitForLoadState('load');
```

Or increase timeout and use `waitForTimeout()` after DOM load.

## Prevention

All Playwright specs should avoid `waitForLoadState('networkidle')` on pages that have continuous polling/real-time data. Use `domcontentloaded` or explicit `waitForSelector()` instead.
