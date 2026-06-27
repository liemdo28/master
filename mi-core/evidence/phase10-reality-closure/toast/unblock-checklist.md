# Toast Unblock Checklist

**Generated:** 2026-06-27T06:49:00Z
**Phase:** 10.3 Final Connector Closure
**Owner:** CEO

## Current Status: `TOAST_BLOCKED`

## Why Toast Is Blocked

| Issue | Evidence |
|-------|----------|
| No Toast REST endpoint in mi-core | `GET /api/toast/status` → 404 |
| No TOAST_API_KEY in .env | .env checked — only email/password |
| No Toast connector in visibility API | `/api/visibility/connectors` has no Toast |
| No human-approved live access proof | Not provided by CEO |

## Unblock Options

### Option A: Toast REST API Key (Preferred) ⭐

**Steps:**
1. [ ] CEO registers for Toast Developer account at `developers.toast.com`
2. [ ] CEO creates a Toast API project and generates a read-only API key
3. [ ] CEO adds `TOAST_API_KEY=<key>` to mi-core/.env
4. [ ] Dev3 creates `/api/toast/status` endpoint using Toast REST API
5. [ ] Dev3 creates `/api/toast/sales` endpoint for sales data
6. [ ] Dev3 creates `/api/toast/reports` endpoint for reporting
7. [ ] Verify login: `curl http://localhost:4001/api/toast/status` returns 200
8. [ ] Capture account visibility proof (JSON output)
9. [ ] Capture sales/report availability proof
10. [ ] Mark TOAST_CERTIFIED or TOAST_PARTIAL

**Required evidence for certification:**
- `login-proof.json` — successful API login
- `account-visibility-proof.json` — account info visible
- Screenshot of Toast dashboard

### Option B: Playwright Scraping (If no API key available)

**Prerequisite:** CEO formally approves `hoangdle@gmail.com / B@kudan@2` for scraping

**Steps:**
1. [ ] CEO approval email/ Slack message confirming credentials
2. [ ] Dev1/Dev3 creates Toast Playwright scraper (similar to doordash-agent)
3. [ ] Test scrape: capture screenshot of Toast dashboard
4. [ ] Verify sales data visible: orders, revenue, tips
5. [ ] Verify reports accessible: daily summary, sales by item
6. [ ] Confirm no mutations — read-only only
7. [ ] Mark TOAST_PARTIAL (scrape-based is PARTIAL, not CERTIFIED)

**Required evidence:**
- CEO approval message
- `login-proof.json` — successful login screenshot
- `account-visibility-proof.json` — account visible

### Option C: Formal Exclusion

If Toast POS is not relevant to the MI_COMPANY_OS_OPERATIONAL scope:

1. [ ] CEO writes formal exclusion request
2. [ ] Document what percentage of revenue comes from Toast POS vs DoorDash/ QB
3. [ ] Mark TOAST_EXCLUDED in MI_COMPANY_OS_OPERATIONAL_CERTIFICATION.md
4. [ ] Toast does not count against MI_COMPANY_OS_OPERATIONAL

## No Fake Access

**This checklist is the ONLY acceptable path to Toast certification.**
Do NOT fabricate Toast access evidence.
Do NOT claim TOAST_CERTIFIED without real proof.
Do NOT use credentials without CEO's formal approval.

## Current .env Credentials (Not Yet Approved)

```
TOAST_EMAIL=hoangdle@gmail.com
TOAST_PASSWORD=B@kudan@2
```

These credentials exist in .env but have NOT been:
- Tested with Playwright
- Confirmed as valid by Toast
- Formally approved by CEO for use in mi-core