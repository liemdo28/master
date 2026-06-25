# DoorDash Attribution Connector — Phase 34E
**Generated:** 2026-06-25

## Agent Status

| Field | Value |
|-------|-------|
| Agent URL | http://100.111.97.25:3460 (Laptop1 / Tailscale) |
| Health status | `ok` (running: false — idle between scrapes) |
| Last run | 2026-06-24T21:51:19.810Z |
| Last error | null |
| Accounts configured | 4 (B1, B2, B3, Raw) |
| Cache present | true |

## Accounts

| ID | Email | Brand | Label |
|----|-------|-------|-------|
| bakudan-1 | bakudanramen210@gmail.com | Bakudan Ramen | B1 |
| bakudan-2 | info@bakudanramen.com | Bakudan Ramen | B2 |
| bakudan-3 | gm@bakudanramen.com | Bakudan Ramen | B3 |
| raw-sushi | h.oang.d.le@gmail.com | Raw Sushi Bar | Raw |

## What Data Is Available vs Blocked

### Blocked by DoorDash Rate Limiting / WAF

All 4 accounts return `"raw_text_snippet": "Rate limit exceeded"` on the analytics page:
- `orders_today`: null
- `orders_week`: null
- `revenue_today`: null
- `revenue_week`: null
- `avg_rating`: null
- `total_reviews`: null

The scraper navigates to `https://merchant-portal.doordash.com/analytics` and extracts DOM text. DoorDash is returning a **rate-limit response** before any analytics data loads — this is a WAF/Cloudflare bot-detection challenge triggered by Playwright automation, not a login credential failure.

### What CAN Be Read

- Login flow executes (email, password, optional 2FA via Gmail OTP) — session cookies saved for 8h
- Page URL confirms authenticated state (no redirect to identity/login)
- Page screenshot saved to `services/doordash-agent/data/sessions/<accountId>-analytics.png`

### What Is Blocked

- `/analytics` page — **Rate limit exceeded** (WAF blocks headless browser DOM extraction)
- `/home` page — same WAF block
- `/reports` page — same WAF block
- Campaign spend: **BLOCKED**
- Orders/revenue metrics: **BLOCKED**

## Root Cause

DoorDash merchant portal uses Cloudflare with browser fingerprinting. Playwright with `--disable-blink-features=AutomationControlled` and a spoofed user-agent passes initial login but gets rate-limited on data pages. The scraper takes screenshots before the DOM is available. The `raw_text_snippet` reads "Rate limit exceeded" from the Cloudflare interstitial, not from real portal content.

## Read Adapter

`server/src/executive-intelligence/connectors/doordash/doordash-read-adapter.ts`

- `getHealthStatus()` — proxies to `/health` — WORKING
- `getMetrics()` — proxies to `/metrics` — RETURNS NULLS (WAF blocked)
- `getProfitLoss()` — sums `revenue_today` from metrics — RETURNS 0 (no data)
- `getRecentTransactions()` — returns empty array (not implemented)
- `triggerScrape()` — POSTs to `/scrape` — triggers run but data still null

## Safe Workaround Plan

### Option A — DoorDash Merchant API (Recommended)
DoorDash offers an official Merchant API for partners. Apply at https://developer.doordash.com/en-US/docs/merchant/
- Provides: orders, revenue, menu data via REST
- No WAF risk
- Requires: business verification + API key per account

### Option B — Manual CSV Export + Ingest
- Export reports from merchant portal UI (human-driven, not automated)
- Drop CSV into `services/doordash-agent/data/uploads/`
- Agent parses CSV and serves via `/metrics`

### Option C — Reduce Scrape Frequency + Rotate Accounts
- Scrape only 1 account per 6h window (not all 4 back-to-back)
- Add random delays 10–30s between page actions
- Use residential proxy to bypass Cloudflare fingerprint
- Risk: still fragile, may violate ToS

### Option D — Email Report Parsing
- DoorDash sends weekly performance email summaries to merchant emails
- Gmail OTP module already connected; extend to parse DoorDash report emails
- Extract revenue/orders from email HTML

## Status

**DOORDASH_AUTHENTICATED_WAF_BLOCKED**

- Authentication: PASS (login flow works, sessions saved)
- Data extraction: FAIL (rate-limit/WAF on all analytics pages)
- Metrics available: 0 of 6 (orders_today, orders_week, revenue_today, revenue_week, avg_rating, total_reviews)
- Recommended next step: Apply for DoorDash Merchant API (Option A)
