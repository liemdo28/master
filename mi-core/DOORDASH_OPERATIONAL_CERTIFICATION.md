# DoorDash Operational Certification

**Generated:** 2026-06-27T09:58:00Z
**Phase:** 10.4 Real Operational Proof
**Certification result:** `DOORDASH_PARTIAL`

---

## Certification Result

**Status: `DOORDASH_PARTIAL`**

DoorDash agent is online and the Chromium runtime resolver is fixed. The scrape now reaches the authentication gate and returns `CREDENTIALS_REQUIRED` for all configured accounts because no live session or runtime credentials are configured. DoorDash is not certified.

---

## PM2 Process Status

| Process | Status | Evidence |
|---------|--------|----------|
| mi-doordash-agent | online | `mi-core/evidence/phase10-4-real-operational-proof/doordash-pm2-describe.txt` |

Source: `pm2 describe mi-doordash-agent` at 2026-06-27T09:57:59Z

---

## Chromium Runtime Fix — Applied and Verified

- **Fix applied:** `scraper.js` now resolves Chromium from environment variables, local Playwright installs, Puppeteer cache, Chrome, or Edge.
- **Failure mode fixed:** missing/incorrect Playwright Chromium path.
- **Runtime evidence:** `mi-core/evidence/phase10-4-real-operational-proof/doordash-agent-tail-redacted.log`
- **Current status:** browser path blocker fixed; live account session remains blocked.

---

## Portal Access — Blocked by Missing Live Session

- Last scrape: `2026-06-27T09:53:20.288Z`
- Health endpoint: `status=ok`, `accounts=4`, `has_cache=true`
- All 4 accounts returned `CREDENTIALS_REQUIRED`
- No forbidden actions were attempted.
- No spend, campaign edit, menu edit, or production mutation was attempted.

---

## Account Registry

| ID | Brand | Label | Status |
|----|-------|-------|--------|
| bakudan-1 | Bakudan Ramen | B1 | blocked (`CREDENTIALS_REQUIRED`) |
| bakudan-2 | Bakudan Ramen | B2 | blocked (`CREDENTIALS_REQUIRED`) |
| bakudan-3 | Bakudan Ramen | B3 | blocked (`CREDENTIALS_REQUIRED`) |
| raw-sushi | Raw Sushi Bar | Raw | blocked (`CREDENTIALS_REQUIRED`) |

---

## Approval Gate Proof

- Read-only scrape: true
- Forbidden actions attempted: 0
- Result: PASS

---

## What Is Working

- DoorDash agent online and reachable at localhost:3460
- Chromium runtime resolution works on this machine
- 4 accounts registered in account registry
- Approval gate prevents write operations
- No budget changes, campaign edits, or spend actions attempted

## Remaining Blockers

1. **Live DoorDash access** — provide a valid read-only session or approved runtime credentials.
2. **Campaign visibility proof** — not proven because the scrape cannot reach authenticated merchant pages.
3. **Campaign metadata** — not collected from a live account.

## Required to Reach `DOORDASH_CERTIFIED`

| # | Action | Owner |
|---|--------|-------|
| 1 | Provide CEO-approved read-only DoorDash session or credentials | CEO |
| 2 | Run scrape until campaign pages are visible | Operator |
| 3 | Store runtime log, screenshot, and campaign metadata evidence | Operator |

## Final Contribution

`MI_COMPANY_OS_PARTIAL` — DoorDash is PARTIAL, contributing correctly to the partial operational state.
