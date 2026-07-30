# QA AUTOMATION REPORT — Dashboard.bakudanramen.com
**Playwright QA suite status for the Bakudan Dashboard.**
*Last updated: 2026-06-04 16:18 (Asia/Saigon, UTC+7)*

---

## 1. QA Suite Overview

| Suite | File | Tests | Last Run | Result |
|------|------|-------|----------|--------|
| Auth Setup | `qa/playwright/00-auth-setup.spec.ts` | 1 | 2026-06-04 | PASS |
| Login | `qa/playwright/01-login.spec.ts` | 2 | 2026-06-04 | PASS |
| Task Create/Save/Reload | `qa/playwright/02-task-create.spec.ts` to `04-task-reload.spec.ts` | 4 | 2026-06-04 | PASS |
| Workflow (Submit/Review/Approve) | `qa/playwright/05-submit-review.spec.ts` to `07-approver-accept.spec.ts` | 3 | 2026-06-04 | PASS |
| Attachments | `qa/playwright/08-attachments.spec.ts` | 1 | 2026-06-04 | SKIP (Phase 2) |
| Mentions | `qa/playwright/09-mentions.spec.ts` | 1 | 2026-06-04 | SKIP (Phase 2) |
| Notifications | `qa/playwright/10-notifications.spec.ts` | 2 | 2026-06-04 | PASS |
| Workflow DB | `qa/playwright/11-workflow-db.spec.ts` | 1 | 2026-06-04 | PASS |
| **Phase 1 API** | `qa/playwright/12-workflow-api.spec.ts` | 5 | 2026-06-04 | PASS |
| **Phase 1 Page** | `qa/playwright/13-command-center-page.spec.ts` | 3 | 2026-06-04 | PASS |
| **Screenshot Capture** | `qa/playwright/capture-command-center.ts` | 4 views | 2026-06-04 | READY |

**Total:** 15 test files | ~28 tests | **13 PASS, 2 SKIP, 0 FAIL**

---

## 2. Run Commands

### Run all tests
```bash
cd E:\Project\Master\Bakudan\dashboard.bakudanramen.com
npm run qa
```

### Run Phase 0 workflow only
```bash
npx playwright test qa/playwright --grep="workflow"
```

### Run Phase 1 API only
```bash
npx playwright test qa/playwright/12-workflow-api.spec.ts
```

### Capture screenshots
```bash
npx playwright test qa/playwright/capture-command-center.ts
```

### Open HTML report
```bash
npx playwright show-report qa/reports/html
```

---

## 3. Test Fixtures

**File:** `qa/playwright/fixtures.ts`

Provides:
- `page` — Playwright page object
- `evidence` — Screenshot + console log collector
- `saveWorkflowState()` / `loadWorkflowState()` — cross-test state sharing

---

## 4. Environment Config

| Env | Base URL | Test User | Password |
|-----|---------|----------|----------|
| Preview | `https://preview.dashboard.bakudanramen.com` | `qa.bot@bakudanramen.com` | `QA-Preview-2026!` |

---

## 5. Artifact Locations

| Artifact | Path |
|----------|------|
| Screenshots (Phase 0) | `qa/artifacts/2026-06-04/*.png` |
| Screenshots (Phase 1) | `qa/artifacts/command-center/*.png` (from `capture-command-center.ts`) |
| HTML Report | `qa/reports/html/index.html` |
| JSON Report | `qa/reports/QA_RUN_2026-06-04.json` |
| Video | `qa/artifacts/video/` |

---

## 6. CI/CD Status

| Check | Status | Notes |
|-------|--------|-------|
| Local `npm run qa` | ✅ Ready | Run from project root |
| GitHub Actions | ❌ Not configured | Manual run only |
| Preview auto-deploy + QA | ⚠️ Manual | `deploy_preview.php` + `npm run qa` run sequentially |
| Pre-deploy check | ✅ Ready | `preview_db_health.php` before every deploy |

---

## 7. Quick Answers

> **"Run QA on Dashboard"**
> `npm run qa` — runs all Playwright tests.

> **"Is QA passing?"**
> Last run (2026-06-04): 13 PASS, 2 SKIP, 0 FAIL. Overall: ✅ GREEN.

> **"Capture screenshots of Command Center"**
> `npx playwright test qa/playwright/capture-command-center.ts`
> Output: `qa/artifacts/command-center/01-my-work.png` through `04-critical.png`

> **"Open QA report"**
> `npx playwright show-report qa/reports/html`