# MARKETING_KPI_REGISTRY

> Generated: 2026-06-26 11:22 Asia/Saigon
> Phase: 4C — Marketing KPI Registry
> Mission: Define CMO-grade KPIs across traffic, engagement, local SEO, campaign, brand

---

## Traffic KPIs

| # | Name | Description | Source | Formula | Frequency | Owner | Availability | Confidence | Blocker |
|---|------|-------------|--------|---------|-----------|-------|--------------|------------|---------|
| T1 | GSC Clicks | Total organic clicks | GSC | `Σ clicks per day` | Daily | SEO Lead | LIVE | HIGH | None |
| T2 | GSC Impressions | Total organic impressions | GSC | `Σ impressions per day` | Daily | SEO Lead | LIVE | HIGH | None |
| T3 | GSC CTR | Click-through rate from organic search | GSC | `clicks / impressions * 100` | Daily | SEO Lead | LIVE | HIGH | None |
| T4 | GSC Avg Position | Average search ranking | GSC | `Σ position / Σ rows` | Daily | SEO Lead | LIVE | HIGH | None |
| T5 | GA4 Users | Unique visitors | GA4 | GA4 reporting | Daily | Analytics | NOT_DEPLOYED | ZERO | GA4 property |
| T6 | GA4 Sessions | Total sessions | GA4 | GA4 reporting | Daily | Analytics | NOT_DEPLOYED | ZERO | GA4 property |
| T7 | Organic Search Sessions | Sessions from organic search channel | GA4 | `sessions WHERE channel = "Organic Search"` | Daily | Analytics | NOT_DEPLOYED | ZERO | GA4 property |
| T8 | Direct Sessions | Sessions from direct | GA4 | `sessions WHERE channel = "Direct"` | Daily | Analytics | NOT_DEPLOYED | ZERO | GA4 property |
| T9 | Referral Sessions | Sessions from referral | GA4 | `sessions WHERE channel = "Referral"` | Daily | Analytics | NOT_DEPLOYED | ZERO | GA4 property |

---

## Engagement KPIs

| # | Name | Description | Source | Formula | Frequency | Owner | Availability | Confidence | Blocker |
|---|------|-------------|--------|---------|-----------|-------|--------------|------------|---------|
| E1 | Pageviews | Total page views | GA4 | `Σ screenPageViews` | Daily | Analytics | NOT_DEPLOYED | ZERO | GA4 property |
| E2 | Engagement Rate | % of engaged sessions | GA4 | `engagedSessions / totalSessions` | Daily | Analytics | NOT_DEPLOYED | ZERO | GA4 property |
| E3 | Bounce Rate | % of non-engaged sessions | GA4 | GA4 metric | Daily | Analytics | NOT_DEPLOYED | ZERO | GA4 property |
| E4 | Avg Session Duration | Average time on site | GA4 | `Σ sessionDuration / sessions` | Daily | Analytics | NOT_DEPLOYED | ZERO | GA4 property |
| E5 | Scroll Depth | Scroll % per page | Custom event in GA4 | event-based | Weekly | Analytics | NOT_DEPLOYED | ZERO | Custom event |
| E6 | Menu Clicks | Clicks to /menu | Custom event | `count(event_name = menu_click)` | Daily | Web Eng | NOT_DEPLOYED | ZERO | GA4 custom event |
| E7 | Order Clicks | Clicks to /order | Custom event | `count(event_name = order_click)` | Daily | Web Eng | NOT_DEPLOYED | ZERO | GA4 custom event |
| E8 | Phone Clicks | Clicks to tel: link | Custom event | `count(event_name = call_click)` | Daily | Web Eng | NOT_DEPLOYED | ZERO | GA4 custom event |
| E9 | Directions Clicks | Clicks to directions | Custom event | `count(event_name = directions_click)` | Daily | Web Eng | NOT_DEPLOYED | ZERO | GA4 custom event |

---

## Local SEO KPIs

| # | Name | Description | Source | Formula | Frequency | Owner | Availability | Confidence | Blocker |
|---|------|-------------|--------|---------|-----------|-------|--------------|------------|---------|
| L1 | GBP Views (Map) | Map impressions | GBP | `Σ BUSINESS_IMPRESSIONS_MAPS` | Daily | Local SEO | PARTIAL | MEDIUM | Re-auth needed |
| L2 | GBP Views (Search) | Search impressions | GBP | `Σ BUSINESS_IMPRESSIONS_SEARCH` | Daily | Local SEO | PARTIAL | MEDIUM | Re-auth needed |
| L3 | GBP Calls | Phone clicks from GBP | GBP | `Σ CALL_CLICKS` | Daily | Local SEO | PARTIAL | MEDIUM | Re-auth needed |
| L4 | GBP Directions | Direction request clicks | GBP | `Σ BUSINESS_DIRECTION_REQUESTS` | Daily | Local SEO | PARTIAL | MEDIUM | Re-auth needed |
| L5 | GBP Website Clicks | Website clicks from GBP | GBP | `Σ WEBSITE_CLICKS` | Daily | Local SEO | PARTIAL | MEDIUM | Re-auth needed |
| L6 | Reviews Count | Total reviews | GBP/Yelp/DoorDash | `Σ reviews per location` | Weekly | Operations | PARTIAL | LOW | Live pull needed |
| L7 | Avg Rating | Average star rating | GBP/Yelp/DoorDash | `Σ ratings / count` | Weekly | Operations | PARTIAL | LOW | Live pull needed |
| L8 | Review Velocity | New reviews per month | All platforms | `count(reviews WHERE date >= now - 30d)` | Monthly | Operations | PARTIAL | LOW | Live pull needed |
| L9 | Negative Review Response Rate | % of negative reviews responded within 24h | review-automation | `responded_within_24h / total_negative` | Daily | Operations | UNKNOWN | ZERO | Cron activation |

---

## Campaign KPIs

| # | Name | Description | Source | Formula | Frequency | Owner | Availability | Confidence | Blocker |
|---|------|-------------|--------|---------|-----------|-------|--------------|------------|---------|
| C1 | Campaign Spend | Total ad spend | DoorDash Ads / Google Ads | `Σ spend per campaign` | Daily | Marketing | BLOCKED | ZERO | Credentials |
| C2 | Campaign Revenue | Revenue attributed to campaign | DoorDash / Toast | `Σ attributed_orders` | Daily | Marketing | BLOCKED | ZERO | Credentials + Toast |
| C3 | ROAS | Return on ad spend | DoorDash / Google Ads | `revenue / spend` | Weekly | Marketing | BLOCKED | ZERO | Credentials |
| C4 | CTR (Ads) | Click-through rate of ads | DoorDash / Google Ads | `clicks / impressions` | Daily | Marketing | BLOCKED | ZERO | Credentials |
| C5 | CPC | Cost per click | DoorDash / Google Ads | `spend / clicks` | Daily | Marketing | BLOCKED | ZERO | Credentials |
| C6 | CPA | Cost per acquisition | DoorDash / Google Ads | `spend / conversions` | Weekly | Marketing | BLOCKED | ZERO | Credentials |

---

## Brand KPIs

| # | Name | Description | Source | Formula | Frequency | Owner | Availability | Confidence | Blocker |
|---|------|-------------|--------|---------|-----------|-------|--------------|------------|---------|
| B1 | Bakudan Traffic | Bakudan brand organic clicks | GSC | `clicks WHERE site = bakudanramen.com` | Weekly | SEO Lead | LIVE | HIGH | None |
| B2 | Raw Sushi Traffic | Raw Sushi brand organic clicks | GSC | `clicks WHERE site = rawstockton.com` | Weekly | SEO Lead | LIVE | HIGH | None |
| B3 | Brand Growth Trend | Week-over-week click change | GSC | `(current_week - prior_week) / prior_week` | Weekly | SEO Lead | LIVE | HIGH | None |
| B4 | Store Demand | Per-location clicks | GSC + GBP | aggregate per location | Monthly | Local SEO | PARTIAL | MEDIUM | GBP re-auth |
| B5 | Content Performance | Page-level traffic from content | GSC | `clicks per landing page` | Weekly | SEO Lead | LIVE | MEDIUM | Query-level export |
| B6 | Brand Mention Velocity | New external mentions | Social + Reviews | `count(mentions per week)` | Weekly | Marketing | NOT_DEPLOYED | ZERO | Social listening |
| B7 | Sentiment Score | Avg sentiment in reviews | NLP on reviews | `Σ sentiment / count(reviews)` | Weekly | Marketing | PARTIAL | LOW | NLP activation |

---

## Confidence Tier Summary

| Tier | KPIs | Count |
|------|------|-------|
| HIGH (LIVE) | T1-T4, B1-B3 | 7 |
| MEDIUM (PARTIAL) | L1-L5, L6-L8 (data not verified), B4-B5, B7 | 11 |
| LOW (CODE EXISTS) | L9, others | 3 |
| ZERO (BLOCKED) | T5-T9, E1-E9, C1-C6, B6, L9 | 