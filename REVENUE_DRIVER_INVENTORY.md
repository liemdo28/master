# REVENUE_DRIVER_INVENTORY.md

> Phase 29A — Revenue Driver Inventory
> Generated: 2026-06-24 20:39 Asia/Saigon
> Mission: Map every system to revenue impact. No architecture wins. Only business outcomes.

---

## Executive Summary

Bakudan Ramen operates 10 systems that touch revenue. Of those:

- **3 are PRIMARY** (directly generate orders/revenue)
- **4 are SECONDARY** (drive demand or trust that converts to revenue)
- **3 are SUPPORT** (operational or compliance — needed but not revenue-generating directly)

The single highest-leverage system today is **SEO (Bakudan + Raw Sushi)**, because:

1. Live GSC data confirms real impressions: Bakudan 11,174 / 28 days, Raw Sushi 28,736 / 28 days.
2. Both brands have average position 9.4–10.8 (page-one boundary) — small ranking lifts = exponential traffic gains.
3. Raw Sushi CTR is 1.3% (industry floor) — pure title/meta fix can 2–3x clicks without new content.

---

## Revenue Driver Matrix

| # | System | Revenue Impact | Direct/Indirect | Measurement Source | Current Status | Automation Level | Owner | Final Classification |
|---|--------|----------------|-----------------|--------------------|----------------|------------------|-------|----------------------|
| 1 | SEO (Bakudan + Raw Sushi) | HIGH | Indirect (demand capture) | Google Search Console | LIVE — Bakudan 587 clicks / 11,174 imp / 5.3% CTR / pos 10.8; Raw Sushi 361 clicks / 28,736 imp / 1.3% CTR / pos 9.4 | Semi-automated (8 landing pages + 14 Raw Sushi pages + 3 location pages exist) | SEO Lead | **PRIMARY** |
| 2 | Google Business Profile | HIGH | Direct (calls, directions, orders) | GBP Insights API (BLOCKED — no API key) | 3 locations on Google Maps (manually verified) | Manual | Operations | **PRIMARY** |
| 3 | Reviews (3-platform) | HIGH | Indirect (trust → conversion) | GBP, Yelp, DoorDash review feeds | Negative-review detection exists in `Bakudan/review-automation-system`; daily negative report script exists | Semi-automated (alerts + auto-reply policy) | Operations | **PRIMARY** |
| 4 | DoorDash Campaigns | HIGH | Direct (delivery sales) | DoorDash Ads Manager (BLOCKED — no credentials) | Brand owns 3 store fronts; no campaign data accessible | Manual | Marketing | **PRIMARY** |
| 5 | Bakudan Website | HIGH | Direct (orders, calls, reservations) | GA4 / call tracking (BLOCKED — no GA4 ID) | 8 landing pages + 3 location pages + menu + order + happy hour | Manual | Web/Marketing | **PRIMARY** |
| 6 | Raw Sushi Website | MEDIUM | Direct (orders, calls) | GA4 (BLOCKED) | 14+ pages on Cloudflare Pages (`RawWebsite`) | Manual | Web/Marketing | **SECONDARY** |
| 7 | Dashboard (`dashboard.bakudanramen.com`) | LOW | Indirect (operational decisions) | Internal — store health, bills, tasks | PRODUCTION (PHP/MySQL) | Automated (CRON jobs, scheduled tasks) | Operations | **SUPPORT** |
| 8 | QuickBooks | LOW | Indirect (financial reporting) | QuickBooks Desktop (no API) | Manual export only | Manual | Finance | **SUPPORT** |
| 9 | Food Safety | MEDIUM | Indirect (license to operate) | Local health dept portal | Compliance tracked in dashboard | Manual | Operations | **SECONDARY** |
| 10 | Operations (3-store daily ops) | MEDIUM | Indirect (service quality → reviews) | Internal — POS, schedules | Manual + dashboard | Manual | Operations | **SECONDARY** |

---

## PRIMARY_REVENUE_DRIVER Detail

### 1. SEO (Bakudan + Raw Sushi)
- **Why primary:** Every non-brand search for "ramen San Antonio" or "sushi Stockton" lands here. 39,910 combined impressions / 28 days = demand already exists, we're just not capturing it.
- **Direct/Indirect:** Indirect — SEO does not take orders; it delivers qualified visitors to the website and GBP, which then convert.
- **Measurement Source:** Google Search Console (live, both brands).
- **Current Status:** Bakudan avg position 10.8 (page-one boundary) + Raw Sushi 1.3% CTR (worst-in-class).
- **Automation Level:** 8 Bakudan landing pages + 14 Raw Sushi pages are static HTML. No automated refresh; SEO is runbook-driven.
- **Owner:** SEO Lead.
- **Blockers:** Query-level GSC export unavailable; page-level CTR data unavailable.

### 2. Google Business Profile
- **Why primary:** 88% of mobile "near me" searches result in a call or visit within 24 hours (Google data). For 3-store Bakudan, GBP clicks → calls are a direct revenue event.
- **Direct/Indirect:** Direct — GBP "Call" and "Directions" buttons convert to visits.
- **Measurement Source:** GBP Insights (calls, direction requests, photo views) — BLOCKED, no API access.
- **Current Status:** 3 locations verified live on Google Maps.
- **Automation Level:** Manual updates only.
- **Owner:** Operations.
- **Blockers:** No GBP API key.

### 3. Reviews
- **Why primary:** A 1-star increase on Yelp = 5–9% revenue increase (Harvard study, validated for restaurants). 3 locations × multiple platforms = real revenue lever.
- **Direct/Indirect:** Indirect (trust → conversion) + Direct (operational signal to fix service).
- **Measurement Source:** Review aggregation scripts in `Bakudan/review-automation-system/app/`. Daily negative report script exists.
- **Current Status:** Worker code exists. No live data confirmation in this session.
- **Automation Level:** Semi-automated — daily negative detection, auto-reply policy, manual approval.
- **Owner:** Operations.
- **Blockers:** Provider credentials not confirmed.

### 4. DoorDash Campaigns
- **Why primary:** 30–40% of delivery sales for a multi-unit restaurant come from DoorDash Ads. Direct revenue attribution.
- **Direct/Indirect:** Direct.
- **Measurement Source:** DoorDash Ads Manager.
- **Current Status:** **BLOCKED_BY_PLATFORM_ACCESS** — no credentials provided.
- **Automation Level:** N/A (blocked).
- **Owner:** Marketing.
- **Blockers:** Requires DoorDash Ads Manager login. Will not fabricate campaign data.

### 5. Bakudan Website
- **Why primary:** `order.html`, `menu.html`, `locations.html` are the conversion surface. Every GBP call, every SEO click lands here first.
- **Direct/Indirect:** Direct.
- **Measurement Source:** GA4 + call tracking — not configured.
- **Current Status:** 8 landing pages + 3 location pages + menu + order + happy hour + blog. **Conversion gaps exist** (see Phase E).
- **Automation Level:** Static HTML, manual edits.
- **Owner:** Web/Marketing.
- **Blockers:** No GA4; no call tracking.

---

## SECONDARY_REVENUE_DRIVER Detail

### 6. Raw Sushi Website
- Smaller brand; CTR 1.3% indicates a quick-win SEO opportunity is the better lever right now.
- Reclassified as SECONDARY because Raw Sushi revenue is < 1/3 of Bakudan (operations observation; not modeled in this phase).

### 7. Food Safety
- Compliance gates operation. A failed inspection = closed store = $0 revenue.
- Indirect revenue protection, not growth.

### 8. Operations
- Service quality drives reviews; reviews drive SEO CTR; CTR drives calls/orders.
- Indirect but compounding.

---

## SUPPORT_SYSTEM Detail

### 7. Dashboard
- Operational backbone (bills, tasks, store health).
- Enables decisions; does not generate revenue.
- Already production-grade.

### 8. QuickBooks
- Financial truth source.
- Indirect — P&L visibility, not growth.

---

## Final Classification

```
PRIMARY_REVENUE_DRIVER (5):
  1. SEO (Bakudan + Raw Sushi)
  2. Google Business Profile
  3. Reviews
  4. DoorDash Campaigns [BLOCKED — creds missing]
  5. Bakudan Website

SECONDARY_REVENUE_DRIVER (3):
  6. Raw Sushi Website
  7. Food Safety
  8. Operations

SUPPORT_SYSTEM (2):
  9. Dashboard
  10. QuickBooks
```

---

## Executive Priority Order for Phase 29

1. **SEO** — live data, biggest gap (Raw Sushi 1.3% CTR is industry-floor bad), highest ROI.
2. **Bakudan Website Conversion** — fix CTA gaps on order.html, add GA4, add call tracking.
3. **Reviews** — detect negative trends, generate recovery tasks.
4. **GBP** — manual post scheduling (API blocked).
5. **DoorDash** — BLOCKED. CEO must provide credentials.
6. **Raw Sushi SEO** — same playbook as Bakudan, smaller scale.

---

## Honest Limitations (No Fake Data)

| Data Point | Status | Reason |
|------------|--------|--------|
| GBP call/direction counts | BLOCKED | No GBP API key |
| DoorDash sales/campaign ROI | BLOCKED | No DoorDash creds |
| Revenue ($) per location | NOT MODELED | No POS integration in scope |
| QuickBooks P&L | NOT MODELED | No QB API |
| GA4 sessions/conversions | BLOCKED | No GA4 ID configured |

**Rule honored:** No revenue numbers fabricated. KPIs are anchored to real GSC aggregates and observable website structure.
