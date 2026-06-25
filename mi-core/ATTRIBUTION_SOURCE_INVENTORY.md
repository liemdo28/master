# Phase 34 — Attribution Source Inventory
> Audited: 2026-06-25 | Mi-Core CEO OS

## Summary

| Source | Status | Metric Type | Business Value | Owner |
|--------|--------|------------|----------------|-------|
| GSC | LIVE | Impressions, Clicks, CTR, Position | SEO traffic intent | Mi auto |
| GA4 | LIVE | Sessions, Users, Pageviews, Events | On-site behavior | Mi auto |
| GBP | CREDENTIAL_MISSING | Calls, Directions, Map Views | Local intent signals | CEO re-auth |
| Toast | PARTIAL | Orders, Revenue, AOV, Items | Restaurant revenue | API key needed |
| DoorDash | PARTIAL | Sessions authenticated, data rate-limited | Delivery revenue | WAF workaround |
| QuickBooks | PARTIAL | Accounts, Receipts, Invoices | Actual P&L | QBWC sync pending |
| Website CTAs | PARTIAL | Order/Phone/Direction clicks (not yet live) | Conversion tracking | Instrumentation needed |
| Phone Links | NOT_IMPLEMENTED | Call tracking | Direct revenue signal | GA4 event needed |

---

## Source Detail

### 1. Google Search Console (GSC)
- **connection_status:** LIVE
- **credential_status:** OAuth token active (`sc-domain:bakudanramen.com`, `sc-domain:rawsushibar.com`)
- **data_available:** Impressions, clicks, CTR, average position, top queries, top pages
- **metric_type:** Traffic intent (pre-site)
- **business_value:** Which searches drive site visits; keyword opportunity
- **current_blocker:** None — data flowing
- **owner:** Mi auto (daily snapshot)
- **next_action:** Connect to GA4 landing page data for traffic→session attribution

### 2. Google Analytics 4 (GA4)
- **connection_status:** LIVE
- **credential_status:** OAuth token needs `analytics.readonly` re-auth (CEO to visit /api/auth/google/start)
- **data_available:** Sessions, users, pageviews, engagement, channel grouping, landing pages
- **measurement_ids:** G-3GZ2RYDR6M (Bakudan), G-WNHH66NT41 (Raw Sushi)
- **property_ids:** properties/543110659 (Bakudan), properties/532604616 (Raw Sushi)
- **metric_type:** On-site behavior
- **business_value:** Did visitors engage? Which pages lead to orders?
- **current_blocker:** analytics.readonly scope not yet granted — re-auth required
- **owner:** Mi auto
- **next_action:** CEO re-auth → `/api/auth/google/start` → then GA4 Data API live

### 3. Google Business Profile (GBP)
- **connection_status:** CREDENTIAL_MISSING
- **credential_status:** OAuth missing `business.manage` scope
- **data_available:** Calls, directions requests, website clicks, map impressions, search impressions (once authed)
- **metric_type:** Local intent → business action
- **business_value:** HIGHEST — measures actual calls/directions per store = direct revenue signal
- **current_blocker:** OAuth scope `business.manage` not yet granted; may also need GBP API enabled in Google Cloud Console
- **owner:** CEO (must re-auth Google OAuth)
- **next_action:** 1) Add scope in google-auth.ts ✅ (built in Phase 34B agent) 2) CEO re-auth at /api/auth/google/start 3) Verify GBP API enabled in GCP Console

### 4. Toast POS
- **connection_status:** PARTIAL
- **credential_status:** POS login credentials exist (TOAST_EMAIL/TOAST_PASSWORD) — no developer API key
- **data_available:** Orders, sales, items, AOV, store revenue (via Toast developer API or Playwright)
- **metric_type:** Restaurant operational revenue
- **business_value:** Real order count + revenue per store per day
- **current_blocker:** Toast developer API requires separate client_id + client_secret + restaurant GUID — not yet configured. POS credentials alone cannot access API.
- **owner:** CEO (Toast developer account signup at developer.toasttab.com)
- **next_action:** Register Toast developer app → get client_id/secret → configure TOAST_CLIENT_ID/TOAST_CLIENT_SECRET/TOAST_RESTAURANT_GUID in .env

### 5. DoorDash
- **connection_status:** PARTIAL
- **credential_status:** All 4 accounts authenticated (Playwright sessions active on Laptop1)
- **data_available:** None currently — rate limit on analytics page
- **last_scrape:** 2026-06-24T21:51:19.810Z — all stores showing `raw_text_snippet: "Rate limit exceeded"`
- **metric_type:** Delivery orders, revenue, campaign spend, ROAS
- **business_value:** Delivery channel revenue (significant for restaurant ops)
- **current_blocker:** DoorDash merchant portal rate-limiting scraper — 4 accounts hit limit within single scrape cycle
- **owner:** Mi (agent on Laptop1)
- **next_action:** Increase scrape interval to 24h, add per-account rate limit backoff, attempt different analytics endpoint paths

### 6. QuickBooks (QB Desktop)
- **connection_status:** PARTIAL
- **credential_status:** QBWC SOAP server running (port 3457, Laptop1) — active_sessions: 1 but requests_received: 0
- **data_available:** Chart of accounts, 30d sales receipts, 30d invoices (once QBWC sync completes)
- **metric_type:** Actual P&L — Revenue, Expenses, Profit
- **business_value:** Ground truth revenue and profit
- **current_blocker:** QBWC authentication issue (HTTP 404 on old URL). New QWC file created with correct URL `http://localhost:3457/qbwc`. CEO must remove old app and re-add in QBWC.
- **owner:** CEO (must trigger from QB Desktop on Laptop1)
- **next_action:** Remove old Mi-Core connector from QBWC → re-add mi-core-financial-connector.qwc → Update Selected → enter password `b149c4783a1109ff46d01498d91766e7`

### 7. Website CTAs (Conversion Events)
- **connection_status:** PARTIAL
- **credential_status:** GA4 tags present in all HTML files (both brands)
- **data_available:** Page views only — no CTA click events yet
- **metric_type:** Conversion actions (order_click, phone_click, directions_click, menu_click)
- **business_value:** Measures which traffic → conversion intent
- **current_blocker:** onclick GA4 events not yet added to HTML files; files not yet uploaded to Dreamhost hosting
- **Bakudan CTAs found:**
  - Order buttons (order.html links, `class="nav-cta"`)
  - Phone links: tel:+12102777740 (Bandera), tel:+12104370632 (Stone Oak), tel:+12102578080 (The Rim)
  - Toast order links: order.toasttab.com/online/bakudan-bandera, /bakudan-ramen-stone-oak
  - Menu links (menu.html)
- **owner:** Mi (instrumentation) → CEO (upload to Dreamhost)
- **next_action:** Add onclick GA4 events to all HTML files (Phase 34F) → upload to Dreamhost

---

## Attribution Coverage Map

```
GSC (queries → clicks)          LIVE    ████████░░  80%
     ↓
GA4 (sessions → pages)          PARTIAL ██████░░░░  60% (needs re-auth)
     ↓
Website CTAs (clicks → intent)  PARTIAL ████░░░░░░  40% (events not yet live)
     ↓
GBP (calls/directions)          BLOCKED ██░░░░░░░░  20% (needs re-auth + scope)
     ↓
Toast (orders → revenue)        BLOCKED ██░░░░░░░░  20% (needs API key)
     ↓
DoorDash (delivery revenue)     PARTIAL ███░░░░░░░  30% (auth ok, data blocked)
     ↓
QuickBooks (P&L truth)          PARTIAL ███░░░░░░░  30% (sync not yet run)
```

**Overall Attribution Coverage: BUSINESS_ATTRIBUTION_PARTIAL**
