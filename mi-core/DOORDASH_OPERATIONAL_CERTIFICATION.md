# DoorDash Operational Certification

**Generated:** 2026-06-27T10:52:00Z
**Phase:** 10.4 Real Operational Proof
**Certification result:** `DOORDASH_PARTIAL`

---

## Certification Result

**Status: `DOORDASH_PARTIAL`**

CEO-approved read-only access is accepted. DoorDash agent is online, Chromium runtime resolution is fixed, and saved read-only merchant sessions are used without committing cookies or credentials. One account currently proves live portal visibility; the remaining accounts still timeout intermittently and campaign metadata is not fully collected. DoorDash is not certified.

---

## PM2 Process Status

| Process | Status | Evidence |
|---------|--------|----------|
| mi-doordash-agent | online | `mi-core/evidence/phase10-4-ceo-approved-access/doordash-health-after-ceo-approval.json` |

Source: health endpoint at 2026-06-27T10:52:37Z

---

## Chromium Runtime Fix — Applied and Verified

- **Fix applied:** `scraper.js` now resolves Chromium from environment variables, local Playwright installs, Puppeteer cache, Chrome, or Edge.
- **Session fix applied:** saved session TTL is configurable through `DD_SESSION_MAX_AGE_HOURS` and defaults to 168 hours.
- **Route fix applied:** scraper now uses valid `/merchant/...` read-only routes instead of the 404 `/reports` route.
- **Data safety fix applied:** portal text is redacted before writing raw evidence.
- **Cache fix applied:** last useful account data is preserved when a later scrape attempt fails.
- **Failure mode fixed:** missing/incorrect Playwright Chromium path.
- **Runtime evidence:** `mi-core/evidence/phase10-4-ceo-approved-access/doordash-live-session-tail-redacted.txt`
- **Current status:** browser path and saved-session TTL blockers fixed; portal load remains intermittent.

---

## Portal Access — Partially Proven

- Last scrape: `2026-06-27T10:50:57.293Z`
- Health endpoint: `status=ok`, `accounts=4`, `has_cache=true`
- `bakudan-1` restored session cookies, reached the merchant portal, and stored a read-only account visibility record.
- `bakudan-2`, `bakudan-3`, and `raw-sushi` restored sessions but timed out during merchant portal navigation in the latest batch.
- No forbidden actions were attempted.
- No spend, campaign edit, menu edit, or production mutation was attempted.

---

## Account Registry

| ID | Brand | Label | Status |
|----|-------|-------|--------|
| bakudan-1 | Bakudan Ramen | B1 | partial live visibility (`/merchant/home`, HTTP 200) |
| bakudan-2 | Bakudan Ramen | B2 | timeout in latest batch |
| bakudan-3 | Bakudan Ramen | B3 | timeout in latest batch; previous run reached authenticated merchant portal |
| raw-sushi | Raw Sushi Bar | Raw | timeout in latest batch; previous run reached authenticated merchant portal |

---

## Approval Gate Proof

- Read-only scrape: true
- Forbidden actions attempted: 0
- Result: PASS

---

## What Is Working

- DoorDash agent online and reachable at localhost:3460
- Chromium runtime resolution works on this machine
- Saved session reuse works without committing credentials
- Valid merchant route prefix is identified
- 4 accounts registered in account registry
- Approval gate prevents write operations
- No budget changes, campaign edits, or spend actions attempted

## Remaining Blockers

1. **All-account stability** — 3/4 accounts timed out in the latest batch.
2. **Campaign visibility proof** — not fully proven; B1 reached merchant portal visibility, but campaign data did not render into metrics.
3. **Campaign metadata** — not collected from a live account.
4. **Portal latency** — merchant portal navigation can exceed 20 seconds and still needs a more resilient read-only extraction path.

## Required to Reach `DOORDASH_CERTIFIED`

| # | Action | Owner |
|---|--------|-------|
| 1 | Stabilize read-only portal extraction for all four sessions | Operator |
| 2 | Prove campaign page visibility or certified no-campaign state | Operator |
| 3 | Store runtime log, screenshot, and campaign metadata evidence | Operator |

## Final Contribution

`MI_COMPANY_OS_PARTIAL` — DoorDash is PARTIAL, contributing correctly to the partial operational state.
