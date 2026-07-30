# MARKETING_DATA_MAP

> Generated: 2026-06-26 11:21 Asia/Saogon
> Phase: 4B — Marketing Data Map
> Target architecture: GSC / GA4 / GBP / Reviews / DoorDash / Website / Social / Email → Marketing Data Warehouse → Attribution Engine → Brand Intelligence → CEO Marketing Dashboard → Executive Coordination

---

## Data Source Mapping

### 1. Google Search Console (GSC)

| Field | Value |
|-------|-------|
| Source System | `search.google.com/search-console` |
| Owner | SEO Lead |
| Status | LIVE |
| Freshness | Manual / weekly (n8n `seo-daily-audit` verified) |
| Available Fields | clicks, impressions, ctr, position, query, page, date, country, device, sitemap |
| Missing Fields | per-page CTR drill-down at scale, real-time 24h freshness, segmentation by brand |
| Business Value | HIGH — primary SEO organic traffic source |
| Risk | OAuth token expiry |
| Next Action | Create `seo-dashboard-sync` n8n workflow |

### 2. Google Analytics 4 (GA4)

| Field | Value |
|-------|-------|
| Source System | `analytics.google.com` |
| Owner | Analytics Lead |
| Status | NOT_DEPLOYED |
| Freshness | N/A |
| Available Fields | (connector supports) users, sessions, pageviews, engagement_rate, bounce_rate, avg_session_duration, conversions, channel_group |
| Missing Fields | ALL — no property, no tracking code, no env config |
| Business Value | HIGHEST — conversion funnel, real revenue attribution |
| Risk | High value blocked behind 1 GA4 property creation |
| Next Action | CEO creates GA4 property → Mi adds gtag to 152 pages |

### 3. Google Business Profile (GBP)

| Field | Value |
|-------|-------|
| Source System | `business.google.com` |
| Owner | Local SEO Lead |
| Status | PARTIAL |
| Freshness | Unknown — needs re-auth |
| Available Fields | call_clicks, website_clicks, business_direction_requests, map impressions, search impressions |
| Missing Fields | verified live data pull, review count/rating |
| Business Value | HIGH — local search intent signals |
| Risk | `business.manage` scope missing from current tokens |
| Next Action | CEO re-authorizes at `/api/auth/google/start` |

### 4. Reviews (Multi-platform)

| Field | Value |
|-------|-------|
| Source System | Google + DoorDash + Yelp |
| Owner | Operations Lead |
| Status | PARTIAL |
| Freshness | Unknown — daily script exists |
| Available Fields | review_id, platform, store, author, rating, text, date |
| Missing Fields | verified live data, response tracking |
| Business Value | HIGH — review velocity drives local ranking + trust |
| Risk | Scraping-based systems are fragile |
| Next Action | Activate `review-automation-system` cron worker |

### 5. DoorDash Campaign

| Field | Value |
|-------|-------|
| Source System | `identity.doordash.com` + `merchant.doordash.com` |
| Owner | Marketing Lead |
| Status | BLOCKED |
| Freshness | N/A |
| Available Fields | (code supports) campaign_list, spend, roas, impressions, clicks, orders |
| Missing Fields | ALL — no credentials, no PM2 runtime |
| Business Value | HIGH — 30-40% of delivery sales |
| Risk | Cloudflare anti-bot protection |
| Next Action | CEO provides Merchant Portal + Ads Manager credentials |

### 6. Website (Bakudan)

| Field | Value |
|-------|-------|
| Source System | `bakudanramen.com` (Cloudflare static) |
| Owner | Web Engineering |
| Status | LIVE |
| Freshness | Static pages (deploy-time) |
| Available Fields | 29 HTML pages, contact info, menu, locations, hours |
| Missing Fields | dynamic CTAs per session, scroll depth, form analytics |
| Business Value | HIGH — primary conversion surface |
| Risk | Basic Auth on production site blocks Googlebot |
| Next Action | Remove .htaccess Basic Auth from production |

### 7. Website (Raw Sushi)

| Field | Value |
|-------|-------|
| Source System | `rawstockton.com` (Cloudflare static) |
| Owner | Web Engineering |
| Status | LIVE |
| Freshness | Static pages |
| Available Fields | 123 HTML pages, menu, Stockton/Modesto landing |
| Missing Fields | dynamic CTAs, scroll depth |
| Business Value | HIGH — second brand |
| Risk | CTR at 1.3% (industry floor) |
| Next Action | Deploy CTR title/meta rewrites |

### 8. Social (Facebook / Instagram)

| Field | Value |
|-------|-------|
| Source System | `graph.facebook.com` v19.0 |
| Owner | Marketing Lead |
| Status | NOT_DEPLOYED |
| Freshness | N/A |
| Available Fields | post_id, post_url, engagement, page followers, page views |
| Missing Fields | ALL — no tokens, no page IDs |
| Business Value | MEDIUM — brand presence, top-of-funnel |
| Risk | API rate limits |
| Next Action | Provision Facebook Page tokens + Instagram Business ID |

### 9. Email (Marketing)

| Field | Value |
|-------|-------|
| Source System | Gmail OAuth + Mailchimp OR Brevo (future) |
| Owner | Marketing Lead |
| Status | NOT_IMPLEMENTED |
| Freshness | N/A |
| Available Fields | (target) opens, clicks, bounces, list_growth |
| Missing Fields | ALL — no marketing email platform |
| Business Value | MEDIUM — retention + winback |
| Risk | Compliance (CAN-SPAM, GDPR) |
| Next Action | Evaluate Mautic vs Mailchimp in Phase 4H |

### 10. QuickBooks (Revenue / Profit / Labor / Food Cost)

| Field | Value |
|-------|-------|
| Source System | `qb-laptop-01` running QB Desktop |
| Owner | Finance |
| Status | LIVE (degraded — last sync 2026-06-18, 8 days stale) |
| Freshness | Stale |
| Available Fields | revenue, labor_cost, food_cost, profit, transactions |
| Missing Fields | channel-level revenue (web vs GBP vs DoorDash vs walk-in) |
| Business Value | HIGH — source of financial truth |
| Risk | Sync stale |
| Next Action | Restart `qb-ops-agent` heartbeat |

### 11. Toast POS (Orders)

| Field | Value |
|-------|-------|
| Source System | Toast Developer API |
| Owner | Operations Lead |
| Status | NOT_INTEGRATED |
| Freshness | N/A |
| Available Fields | (target) order_id, items, total, channel, time |
| Missing Fields | ALL — no API access, no developer account |
| Business Value | HIGHEST — source of order truth |
| Risk | Toast approval wait (1-3 days) |
| Next Action | Apply for Toast developer account |

---

## Data Warehouse & Pipeline Targets

### Target Architecture

```
┌─────────────┐
│   GSC       │──┐
└─────────────┘  │
┌─────────────┐  │    ┌──────────────────────┐    ┌─────────────────────┐
│   GA4       │──┼───▶│  Marketing Warehouse │───▶│ Attribution Engine   │
└─────────────┘  │    │  (Postgres/Qdrant)   │    └─────────────────────┘
┌─────────────┐  │    │  - snapshots          │            │
│   GBP       │──┤    │  - rolled up tables   │            ▼
└─────────────┘  │    │  - audit logs         │    ┌─────────────────────┐
┌─────────────┐  │    └──────────────────────┘    │ Brand Intelligence  │
│  Reviews    │──┤                                 │ Engine              │
└─────────────┘  │                                 └─────────────────────┘
┌─────────────┐  │                                           │
│  DoorDash   │──┤                                           ▼
└─────────────┘  │                                 ┌─────────────────────┐
┌─────────────┐  │                                 │ CEO Marketing       │
│  Website    │──┘                                 │ Dashboard           │
└─────────────┘                                    └─────────────────────┘
                                                              │
┌─────────────┐                                            │
│  Social     │──────────────────────────────────────────────┘
└─────────────┘                                            │
┌─────────────┐                                            │
│  Email      │──────────────────────────────────────────────┘
└─────────────┘                                            │
                                                              ▼
                                                ┌─────────────────────┐
                                                │ Executive           │
                                                │ Coordination        │
                                                │ (Phase 0)           │
                                                └─────────────────────┘
```

---

## Status Definitions

| Status | Meaning |
|--------|---------|
| LIVE | Code + Auth + Fresh data flowing |
| PARTIAL | Code exists, partial data flow |
| STALE | Was live, now stale |
| MISSING | Code exists, but config/credential gap |
| BLOCKED | External dependency required (CEO / IT) |
| NOT_IMPLEMENTED | No system in place yet |

---

## Final Status

```text
MARKETING_DATA_MAP_COMPLETE
```
