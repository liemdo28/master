# REVENUE_KPI_FRAMEWORK.md

> Phase 29F — Revenue KPI Framework
> Generated: 2026-06-24 20:48 Asia/Saigon
> Mission: Build the company revenue dashboard model

---

## Purpose

Every KPI must answer: "Does this move revenue?" If not, it does not belong on this dashboard.

---

## KPI Master Table

| # | KPI | Source | Owner | Update Frequency | Current Status | Confidence |
|---|-----|--------|-------|------------------|----------------|------------|
| 1 | Organic Clicks | Google Search Console | SEO Lead | Weekly | **LIVE** — Bakudan: 587, Raw Sushi: 361 | HIGH |
| 2 | Impressions | Google Search Console | SEO Lead | Weekly | **LIVE** — Bakudan: 11,174, Raw Sushi: 28,736 | HIGH |
| 3 | CTR | Google Search Console | SEO Lead | Weekly | **LIVE** — Bakudan: 5.3%, Raw Sushi: 1.3% | HIGH |
| 4 | Calls (GBP) | Google Business Profile | Operations | Daily | **BLOCKED** — no GBP API key | ZERO |
| 5 | Directions (GBP) | Google Business Profile | Operations | Daily | **BLOCKED** — no GBP API key | ZERO |
| 6 | Website Clicks (GBP) | Google Business Profile | Operations | Daily | **BLOCKED** — no GBP API key | ZERO |
| 7 | Orders (Toast POS) | Toast POS | Finance | Daily | **NOT INTEGRATED** | ZERO |
| 8 | Revenue ($) | QuickBooks Desktop | Finance | Monthly | **MANUAL EXPORT ONLY** | LOW |
| 9 | Reviews (count + rating) | GBP + Yelp + DoorDash | Operations | Weekly | **SEMI-AUTOMATED** — code exists | MEDIUM |
| 10 | Labor Cost % | QuickBooks + POS | Finance | Bi-weekly | **NOT INTEGRATED** | ZERO |
| 11 | Food Cost % | QuickBooks + POS | Finance | Bi-weekly | **NOT INTEGRATED** | ZERO |
| 12 | Avg Order Value | Toast POS | Finance | Daily | **NOT INTEGRATED** | ZERO |

---

## KPI Confidence Tiers

### Tier 1: LIVE (High Confidence)
These KPIs have real, verified data from live sources:

- **Organic Clicks (Bakudan):** 587/month from GSC aggregate
- **Organic Clicks (Raw Sushi):** 361/month from GSC aggregate
- **Impressions (Bakudan):** 11,174/month from GSC aggregate
- **Impressions (Raw Sushi):** 28,736/month from GSC aggregate
- **CTR (Bakudan):** 5.3% from GSC aggregate
- **CTR (Raw Sushi):** 1.3% from GSC aggregate

### Tier 2: SEMI-AUTOMATED (Medium Confidence)
Code exists but live execution not verified:

- **Review count/rating:** `review-automation-system` has worker code, daily report script
- **Review response time:** Policy exists (24h SLA for negative reviews)

### Tier 3: NOT INTEGRATED (Zero Confidence)
No data pipeline exists:

- **GBP calls/directions/clicks:** Needs GBP API key
- **Toast POS orders:** No API integration
- **Revenue ($):** QuickBooks Desktop only, no API
- **Labor cost %:** No POS integration
- **Food cost %:** No POS integration

---

## Revenue Attribution Model

```
Search Impression (GSC)
    ↓
Click to Website (GSC CTR)
    ↓
Website Visit (GA4 — NOT YET CONFIGURED)
    ↓
  ├── Call (Phone CTA — NOW ON ORDER PAGE)
  ├── Direction Request (GBP — BLOCKED)
  ├── Online Order (Toast — NOT INTEGRATED)
  └── Exit (No conversion)
    ↓
Revenue (QuickBooks — MANUAL)
```

**Gap Analysis:** The full funnel is broken between "Website Visit" and "Revenue". GA4 is not configured, Toast has no API integration, and QuickBooks requires manual export.

---

## What Is Measurable TODAY

| Yes, right now | No, blocked |
|----------------|-------------|
| Organic traffic trend (GSC) | Actual revenue per channel |
| SEO CTR improvement | Online order volume |
| Landing page rankings | Phone call volume |
| SERP impression growth | Labor cost ratio |
| Review velocity | Food cost ratio |
| Revenue growth (QuickBooks monthly) | Avg order value |

---

## Recommended Immediate Actions

1. **GA4 Setup (30 min):** Add GA4 tracking code to all Bakudan + Raw Sushi pages → unlock session/conversion data
2. **GBP API Key (1 hour):** Request from Google Cloud Console → unlock calls/directions/clicks
3. **Call Tracking (1 day):** Set up call tracking number → measure phone conversion

These three actions would move 5 KPIs from ZERO to MEDIUM confidence.
