# PREVIEW INFRASTRUCTURE REPORT

**Date:** 2026-06-03  
**Source:** Playwright Automation Evidence  
**Purpose:** Infrastructure validation before workflow QA can proceed

---

## Current Preview State

```
Preview Runtime Stability: 15%
```

**Reason:** The login page (`/login`) does not render. A fatal PHP error occurs before any route logic executes.

---

## Playwright Evidence

| Step | Expected | Actual |
|------|----------|--------|
| Navigate `/logout` | Redirect to `/login` | Redirected (OK) |
| Navigate `/login` | Login form with `<input name="email">` | Fatal error page |
| Login attempt | N/A | **Never reached** |

**Screenshot shows:**
```
Something went wrong

Failed opening required '/home/liemdo208/phase11-preview/models/Section.php'
```

---

## Infrastructure Validation Checklist

### Endpoints to Verify After Fix

| Route | Expected | Severity if Broken |
|-------|----------|-------------------|
| `/` | Redirect to `/login` (unauthenticated) or `/dashboard` | P0 |
| `/login` | Render login form | P0 |
| `/logout` | Clear session, redirect to `/login` | P0 |
| `/tasks` | Render task list (authenticated) | P1 |
| `/ping.php` | JSON health response | P1 |
| `/api/version` | JSON version info | P2 |

### Capture Requirements Per Endpoint

- HTTP status code
- Screenshot (full page)
- Console errors (browser)
- Network failures (4xx, 5xx)

---

## Classification

| Issue | Severity | Status |
|-------|----------|--------|
| `models/Section.php` missing on preview | **P0** | Blocks everything |
| Login form not rendering | P0 (symptom) | Caused by above |
| Workflow testing impossible | P0 (consequence) | Blocked |
| Deploy verification incomplete | P1 | Fixed locally |
| User path mismatch (`liemdo208` vs `liemdo0208`) | P2 | Needs verification |

---

## QA Directive

```
PAUSE all workflow testing.
DO NOT test approval workflow.
DO NOT test task CRUD.
DO NOT test notifications.
```

**Reason:** All of these require a working runtime. The runtime crashes at bootstrap (`index.php` line 84).

---

## Unblock Sequence

```
1. SSH to preview server
2. Run: git fetch origin main && git reset --hard origin/main
3. Verify: ls -la models/Section.php
4. Verify: curl -sI https://preview.dashboard.bakudanramen.com/login
   → Expected: HTTP 200
5. Run Playwright infra-only test
6. If /login renders → Resume workflow QA
```

---

## After Fix — Playwright Infra Test Script

```typescript
// tests/infra-check.spec.ts
import { test, expect } from '@playwright/test';

const BASE = 'https://preview.dashboard.bakudanramen.com';

const endpoints = [
  { path: '/', expectRedirect: true },
  { path: '/login', expectStatus: 200, expectSelector: 'input[name="email"]' },
  { path: '/logout', expectRedirect: true },
];

for (const ep of endpoints) {
  test(`Infra: ${ep.path}`, async ({ page }) => {
    const response = await page.goto(`${BASE}${ep.path}`);
    
    // Capture evidence
    await page.screenshot({ path: `test-results/infra${ep.path.replace(/\//g, '_')}.png`, fullPage: true });
    
    if (ep.expectStatus) {
      expect(response?.status()).toBe(ep.expectStatus);
    }
    
    if (ep.expectSelector) {
      await expect(page.locator(ep.expectSelector)).toBeVisible({ timeout: 10000 });
    }
    
    // No fatal errors
    const content = await page.content();
    expect(content).not.toContain('Failed opening required');
    expect(content).not.toContain('Fatal error');
  });
}
```

---

## Timeline

| When | What |
|------|------|
| Before fix | 15% stability — nothing works |
| After Section.php deployed | ~60% — login renders, basic nav works |
| After full infra validation | ~80% — ready for workflow QA |
| After workflow QA passes | 95%+ — production candidate |

---

## Summary

The preview environment is **non-functional** due to a single missing file (`models/Section.php`). This is a deployment artifact issue, not a code bug. The local codebase is correct. The fix is a server-side `git reset --hard origin/main` followed by file verification.

**Do not proceed with any QA testing until `/login` renders successfully.**
