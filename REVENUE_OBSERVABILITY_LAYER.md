# REVENUE_OBSERVABILITY_LAYER.md

> Phase 30 — Revenue Observability Layer
> Generated: 2026-06-24 20:55 Asia/Saigon
> Mission: Move from Traffic Intelligence → Revenue Intelligence
> Core Question: **"Did revenue increase?"** (not "Did traffic increase?")

---

## Executive Summary

This document is the bridge between Phase 29 (which proved Mi can execute growth actions) and Phase 30 (which proves Mi can **observe** whether those actions actually moved revenue).

**Honest Status Today:**
- 5 of 5 required integrations: **BLOCKED** (no credentials/API access)
- Without these, Mi can identify opportunities but cannot answer "Did revenue increase?"
- This document maps exactly what is needed and what would be possible with each integration unlocked

**The 5 Required Integrations:**

| # | Source | Connection Status | Data Availability | Revenue Relevance | Update Frequency | Dashboard Integration |
|---|--------|-------------------|-------------------|-------------------|------------------|----------------------|
| 1 | **GA4** | NOT CONNECTED | NONE (no tracking code) | HIGH — sessions, conversions, funnel | Real-time | Pending |
| 2 | **Google Business Profile** | NOT CONNECTED | NONE (no API key) | HIGH — calls, directions = direct revenue events | Real-time | Pending |
| 3 | **DoorDash** | NOT CONNECTED | NONE (no credentials) | HIGH — 30-40% of delivery sales | Hourly | Pending |
| 4 | **Toast** | NOT CONNECTED | NONE (no API access) | HIGHEST — orders, AOV, revenue attribution | Real-time | Pending |
| 5 | **QuickBooks** | MANUAL EXPORT ONLY | Desktop only, no API | HIGH — revenue, labor, food cost, profit | Monthly manual | Pending |

---

## Integration 1: GA4 (Google Analytics 4)

### Connection Status
- **Status:** NOT CONNECTED
- **Reason:** No GA4 property ID has been created or added to any Bakudan or Raw Sushi page
- **Blocker resolution:** 15 minutes — create property, add tracking code to all pages

### Data Availability
- **Sessions:** NONE (no tracking)
- **Page views:** NONE
- **Bounce rate:** NONE
- **Conversions:** NONE
- **User demographics:** NONE

### Revenue Relevance
- **HIGH** — without GA4, the entire middle of the funnel is invisible
- Cannot measure: impression → click → session → conversion
- Without this, all SEO/website changes are flying blind

### Update Frequency
- Real-time (with GA4 property)
- Standard: every 5 minutes for active sessions
- Reports: hourly aggregations

### Dashboard Integration Path
| Step | Action | Owner | Time |
|------|--------|-------|------|
| 1 | Create GA4 property in Google Analytics | CEO/IT | 10 min |
| 2 | Get Measurement ID (G-XXXXXXXX) | — | — |
| 3 | Add `<script>` to all Bakudan pages | Mi | 20 min |
| 4 | Add `<script>` to all Raw Sushi pages | Mi | 20 min |
| 5 | Configure conversion events (phone click, order click) | Mi | 30 min |
| 6 | Build dashboard widget pulling from GA4 Data API | Mi | 4 hours |

### What Becomes Visible (After Unblock)
- Sessions per page
- Bounce rate
- Conversion rate (calls + orders)
- User journey: which page → which action
- Mobile vs desktop split
- Geographic distribution

---

## Integration 2: Google Business Profile (GBP)

### Connection Status
- **Status:** NOT CONNECTED
- **Reason:** No Google Business Profile API key
- **3 locations verified live on Google Maps:** Bandera, Stone Oak, The Rim
- **Blocker resolution:** 1 hour — create Google Cloud project, enable GBP API, generate key

### Data Availability
- **Phone calls:** NOT TRACKED (no API)
- **Direction requests:** NOT TRACKED
- **Website clicks:** NOT TRACKED
- **Photo views:** NOT TRACKED
- **Search queries:** NOT TRACKED
- **Reviews:** PARTIALLY — code exists in `review-automation-system` but not activated

### Revenue Relevance
- **HIGH** — 88% of mobile "near me" searches result in a call or visit within 24 hours
- For 3 Bakudan locations, GBP is the single most important local search surface
- Without GBP data, "calls" KPI = 0 confidence

### Update Frequency
- Real-time (with API)
- GBP Insights typically lags 24-48 hours
- Reviews: near real-time

### Dashboard Integration Path
| Step | Action | Owner | Time |
|------|--------|-------|------|
| 1 | Create Google Cloud project | CEO/IT | 15 min |
| 2 | Enable Business Profile API | CEO/IT | 5 min |
| 3 | Create service account, download JSON key | CEO/IT | 15 min |
| 4 | Grant access to all 3 GBP locations | Operations | 15 min |
| 5 | Build API client to pull daily metrics | Mi | 4 hours |
| 6 | Schedule daily sync job | Mi | 2 hours |
| 7 | Build dashboard widget | Mi | 4 hours |

### What Becomes Visible (After Unblock)
- Daily calls per location
- Daily direction requests per location
- Daily website clicks per location
- Top search queries (what users typed to find Bakudan)
- Photo view count
- Review count + rating trend

---

## Integration 3: DoorDash

### Connection Status
- **Status:** NOT CONNECTED
- **Reason:** No DoorDash Ads Manager credentials provided
- **Code exists:** `Agent/doordash-compaigns/` (Node.js + SQLite + Python QA agent)
- **Runbooks exist:** DOORDASH_PRODUCTION_PILOT_RUNBOOK, DOORDASH_ROLLBACK_RUNBOOK
- **Blocker resolution:** 10 minutes — CEO provides login

### Data Availability
- **Campaign data:** NONE
- **ROAS:** NONE
- **Spend:** NONE
- **Orders from ads:** NONE
- **Conversion data:** NONE
- **Menu performance:** NONE

### Revenue Relevance
- **HIGH** — DoorDash = 30-40% of delivery sales for multi-unit restaurants
- Industry ROAS: 2.5x–4.0x (every $1 in ads → $2.50-$4.00 in revenue)
- Without DoorDash data, $X0,000+/month of revenue is invisible

### Update Frequency
- Hourly (with API)
- Campaign data: real-time
- Order attribution: real-time
- Settlement reports: daily

### Dashboard Integration Path
| Step | Action | Owner | Time |
|------|--------|-------|------|
| 1 | CEO provides Ads Manager login | CEO | 5 min |
| 2 | Export campaign history CSV | Marketing | 10 min |
| 3 | Parse CSV into structured format | Mi | 2 hours |
| 4 | Schedule daily campaign refresh | Mi | 2 hours |
| 5 | Build ROAS widget | Mi | 4 hours |
| 6 | Build campaign health alerts | Mi | 4 hours |

### What Becomes Visible (After Unblock)
- Active campaign list
- Daily spend per campaign
- Daily orders per campaign
- ROAS per campaign
- Top-performing menu items
- Geographic delivery heatmap
- Time-of-day order distribution

---

## Integration 4: Toast POS

### Connection Status
- **Status:** NOT CONNECTED
- **Reason:** No Toast developer account or API access
- **Toast is live** — all 3 Bakudan locations already use Toast for orders
- **Blocker resolution:** 2 hours — apply for Toast developer account, get API keys, configure OAuth

### Data Availability
- **Orders:** LIVE on Toast (3 locations) but not accessible via API
- **Revenue ($):** LIVE on Toast (real-time) but not pulled
- **Average order value:** LIVE but not tracked
- **Labor cost:** UNKNOWN (not in Toast)
- **Food cost:** UNKNOWN (not in Toast)
- **Payment data:** LIVE but not pulled

### Revenue Relevance
- **HIGHEST** — Toast is the source of truth for actual revenue
- Without Toast, all revenue numbers in this document are estimates
- Toast is the ONLY way to close the loop: SEO click → phone call → order → revenue

### Update Frequency
- Real-time (with API)
- Orders: real-time stream
- Daily aggregations: every hour
- Settlement: daily

### Dashboard Integration Path
| Step | Action | Owner | Time |
|------|--------|-------|------|
| 1 | Apply for Toast developer account | CEO/IT | 1 hour |
| 2 | Get API key for production environment | Toast | 1-3 days |
| 3 | Configure OAuth 2.0 flow | Mi | 4 hours |
| 4 | Build order ingestion service | Mi | 8 hours |
| 5 | Build daily revenue aggregation | Mi | 4 hours |
| 6 | Build AOV widget | Mi | 4 hours |
| 7 | Build order source attribution (GBP/SEO/Direct) | Mi | 8 hours |

### What Becomes Visible (After Unblock)
- Real-time order count
- Real-time revenue ($)
- Average order value by location
- Order source attribution
- Hourly order distribution
- Menu item performance
- Payment method breakdown
- Refund/void tracking

---

## Integration 5: QuickBooks

### Connection Status
- **Status:** MANUAL EXPORT ONLY
- **Reason:** No QuickBooks API access (Desktop version)
- **Workaround:** Manual CSV export from QuickBooks Desktop
- **Blocker resolution:** Either upgrade to QuickBooks Online (preferred) or set up scheduled export

### Data Availability
- **Revenue:** MANUAL — exported monthly
- **Labor cost:** MANUAL — exported bi-weekly
- **Food cost:** MANUAL — exported bi-weekly
- **P&L:** MANUAL
- **Balance sheet:** MANUAL

### Revenue Relevance
- **HIGH** — QuickBooks is the financial truth source
- Revenue from Toast + labor cost + food cost = profit
- Without QB, we cannot compute profit trend

### Update Frequency
- **With API:** Daily
- **Current:** Monthly (manual export)

### Dashboard Integration Path
| Step | Action | Owner | Time |
|------|--------|-------|------|
| 1 | Decide: QBO migration vs scheduled export | CEO | 1 day |
| 2A. (QBO) Upgrade to QuickBooks Online | Finance | 2-4 weeks |
| 2B. (Export) Build scheduled CSV import | Mi | 4 hours |
| 3 | Build financial dashboard widget | Mi | 8 hours |
| 4 | Compute weekly P&L from line items | Mi | 8 hours |
| 5 | Build profit trend widget | Mi | 4 hours |

### What Becomes Visible (After Unblock)
- Weekly revenue
- Weekly labor cost (% and $)
- Weekly food cost (% and $)
- Net profit
- Profit margin trend
- Cost trend alerts

---

## Required KPIs — Revenue Observability

For each KPI, the source and the data confidence is mapped.

| # | KPI | Primary Source | Current Confidence | After All Unblocks |
|---|-----|----------------|-------------------|-------------------|
| 1 | **Traffic** | GA4 | ZERO | HIGH |
| 2 | **Clicks** | GSC + GA4 | HIGH (GSC only) | HIGH |
| 3 | **CTR** | GSC | HIGH | HIGH |
| 4 | **Calls** | GBP + Call tracking | ZERO | HIGH |
| 5 | **Directions** | GBP | ZERO | HIGH |
| 6 | **Website Clicks** | GBP + GA4 | ZERO | HIGH |
| 7 | **Orders** | Toast | ZERO | HIGH |
| 8 | **Revenue** | Toast + QB | LOW (estimated) | HIGH |
| 9 | **Labor** | QB | LOW (manual) | HIGH |
| 10 | **Food Cost** | QB | LOW (manual) | HIGH |
| 11 | **Profit Trend** | Toast - QB costs | ZERO (not computed) | HIGH |

**Coverage today:** 3 of 11 KPIs have HIGH confidence (GSC-derived)
**Coverage after unblock:** 11 of 11 KPIs HIGH confidence

---

## What Revenue Observability Would Look Like (When Unblocked)

### The CEO's Question: "Why is revenue down this week?"

**Mi's Answer (with full observability):**

```
WEEK REVENUE DOWN 12% — ROOT CAUSE ANALYSIS

1. GSC: Clicks up 5% (traffic not the issue)
2. GA4: Bounce rate on order.html up 18% (new CTA bar maybe causing UX issue)
3. GBP: Calls down 25% from Bandera location
4. GBP: Direction requests down 15% across all 3
5. DoorDash: ROAS down from 3.2x to 2.1x (campaign 14c is underperforming)
6. Toast: AOV down $1.20 (suggesting fewer high-value items)
7. Toast: Bandera order count down 18% — direct match to GBP call drop
8. QB: Labor cost up 6% (overtime spike Tue/Wed)
9. QB: Food cost up 3% (supplier price increase)

ROOT CAUSE: GBP Bandera call drop → drove direct order count drop
SECONDARY: DoorDash campaign 14c erosion

ACTION:
- Audit GBP Bandera listing (was it updated? hours changed?)
- Pause DoorDash campaign 14c
- Investigate labor overtime cause
```

**Without these integrations, Mi CANNOT answer this question today.**

---

## Honest Status

| Capability | Available Today | After Unblock |
|------------|-----------------|---------------|
| Identify SEO opportunities | YES | YES |
| Make source changes | YES | YES |
| Push to production | YES | YES |
| Measure traffic | YES (GSC) | YES |
| Measure calls | NO | YES |
| Measure orders | NO | YES |
| Measure revenue | ESTIMATED | YES (real $) |
| Measure profit | NO | YES |
| Diagnose revenue regression | NO | YES |
| Attribute revenue to channel | NO | YES |

---

## Unblock Path

| Priority | Action | Time | Unblocks |
|----------|--------|------|----------|
| 1 | Create GA4 property + add tracking code | 30 min | Sessions, conversions, bounce rate |
| 2 | GBP API key + service account | 1 hour | Calls, directions, website clicks |
| 3 | DoorDash Ads Manager login | 10 min | Campaign ROAS, spend, orders |
| 4 | Toast developer account + API | 2 hours | Real orders, real revenue, AOV |
| 5 | QuickBooks API or scheduled export | 4 hours / 2-4 weeks | Labor, food cost, profit |

**Total CEO/IT unblock time: ~4 hours**

---

## Conclusion

The 5 integrations are not nice-to-haves. They are the **difference between guessing and knowing**.

- **Today:** Mi can see traffic (GSC). Mi cannot see revenue. Mi can identify growth opportunities but cannot prove they worked.

- **After unblock:** Mi can answer "Did revenue increase?" with real $ data, broken down by channel, location, and time. Mi can diagnose "Why is revenue down?" in minutes, not weeks.

**This document is the unblock contract.** Until these 5 integrations are connected, Phase 30 observability = PARTIAL. After they are connected, Phase 30 observability = OPERATIONAL.
