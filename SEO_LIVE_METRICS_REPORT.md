# SEO_LIVE_METRICS_REPORT.md

> Phase 24 — SEO Live Metrics Report
> Date: 2026-06-24
> Status: CREDENTIAL_MISSING — Limited live data available

---

## Purpose

Pull minimum live SEO metrics from Google Search Console (GSC), Google Analytics 4 (GA4), and Google Business Profile (GBP). Honest report — no fake data. Where credentials are missing, mark accordingly.

---

## Executive Summary

**CREDENTIAL_MISSING** — No live Google data is available. Mi can only report on:
- Internal crawl data (from SEO agents)
- Internal technical SEO audit
- Internal content inventory

Live Google metrics will be available once CEO completes Google OAuth setup.

---

## Google Search Console (GSC)

**Status: CREDENTIAL_MISSING**

| Metric | Value | Status |
|--------|-------|--------|
| Clicks | — | ❌ CREDENTIAL_MISSING |
| Impressions | — | ❌ CREDENTIAL_MISSING |
| CTR | — | ❌ CREDENTIAL_MISSING |
| Average position | — | ❌ CREDENTIAL_MISSING |
| Top queries | — | ❌ CREDENTIAL_MISSING |
| Top pages | — | ❌ CREDENTIAL_MISSING |

**To enable:** CEO must complete Google OAuth setup (see SEO_GOOGLE_CONNECTOR_STATUS.md).

---

## Google Analytics 4 (GA4)

**Status: CREDENTIAL_MISSING**

| Metric | Value | Status |
|--------|-------|--------|
| Organic sessions | — | ❌ CREDENTIAL_MISSING |
| Total users | — | ❌ CREDENTIAL_MISSING |
| Bounce rate | — | ❌ CREDENTIAL_MISSING |
| Avg session duration | — | ❌ CREDENTIAL_MISSING |
| Top pages | — | ❌ CREDENTIAL_MISSING |
| Conversion rate | — | ❌ CREDENTIAL_MISSING |

**To enable:** CEO must set up GA4 service account (see SEO_GOOGLE_CONNECTOR_STATUS.md).

---

## Google Business Profile (GBP)

**Status: CREDENTIAL_MISSING**

| Metric | Value | Status |
|--------|-------|--------|
| Calls | — | ❌ CREDENTIAL_MISSING |
| Directions | — | ❌ CREDENTIAL_MISSING |
| Website clicks | — | ❌ CREDENTIAL_MISSING |
| Total views | — | ❌ CREDENTIAL_MISSING |
| Search queries | — | ❌ CREDENTIAL_MISSING |
| Photo views | — | ❌ CREDENTIAL_MISSING |

**To enable:** CEO must apply for GBP API access (see SEO_GOOGLE_CONNECTOR_STATUS.md).

---

## Internal Data (What Mi DOES Have)

### Bakudan Ramen — Crawl Results (2026-06-24)

| Metric | Value |
|--------|-------|
| Pages crawled | 13 |
| Successful (200 OK) | 1 |
| Failed (404) | 12 |
| Broken links | 0 |
| Schema markup | Organization present |
| Images missing alt | 2 |

### Technical SEO Audit

| Check | Status |
|-------|--------|
| Title tags present | 1/13 pages (only homepage) |
| Meta descriptions present | 1/13 pages |
| Canonical URLs | Not verified |
| Sitemap.xml | ❌ Not found |
| robots.txt | ❌ Not found |
| Hreflang | Not verified |
| Mobile viewport | Not verified |

### Content Inventory

| Status | Count | Pages |
|--------|-------|-------|
| Live pages | 13 | index, menu, about, locations, happy-hour, order, blog, 5 blog posts, ramen-guide |
| 404 pages | 12 | 8 missing landing pages, 3 location subpages, /menu |
| Total expected | 25+ | After full content plan execution |

### Citations Audit

| Directory | NAP Match | Claimed |
|-----------|-----------|---------|
| Google Business | ✅ | Pending |
| Apple Maps | ✅ | Pending |
| Bing Places | ✅ | Pending |
| Yelp | ✅ | ✅ Claimed |
| DoorDash | ✅ | ✅ Claimed |
| UberEats | ✅ | ✅ Claimed |
| Grubhub | ✅ | Pending |
| Toast | ✅ | ✅ Claimed |

---

## Traffic/Data Limitations

### What Mi Cannot Do Without Credentials

1. ❌ Cannot read GSC clicks/impressions/CTR
2. ❌ Cannot read GA4 organic sessions
3. ❌ Cannot read GBP call/direction/website click data
4. ❌ Cannot detect keyword ranking changes
5. ❌ Cannot track conversion from organic search
6. ❌ Cannot verify pages indexed by Google

### What Mi CAN Do Without Credentials

1. ✅ Crawl website (already verified)
2. ✅ Detect 404 errors (already verified)
3. ✅ Audit technical SEO (schema, titles, etc.)
4. ✅ Generate content briefs
5. ✅ Audit citations (basic NAP check)
6. ✅ Monitor internal links and structure

---

## Action Plan to Enable Live Data

### Week 1 (CEO-Driven)

| Task | Owner | Time |
|------|-------|------|
| Create Google Cloud project | Dev team | 30 min |
| Enable Search Console API | Dev team | 5 min |
| Create OAuth credentials | Dev team | 15 min |
| Complete OAuth flow | CEO | 10 min |
| Add tokens to mi-core .env | Dev team | 5 min |

### Week 2 (CEO-Driven)

| Task | Owner | Time |
|------|-------|------|
| Create GA4 service account | Dev team | 30 min |
| Grant GA4 read access | CEO | 10 min |
| Share service account JSON | CEO → Dev | 5 min |
| Add to mi-core .env | Dev team | 5 min |

### Week 3 (CEO-Driven)

| Task | Owner | Time |
|------|-------|------|
| Apply for GBP API access | CEO | 1-7 days for approval |
| Complete GBP OAuth | CEO | 15 min |
| Add location IDs to .env | Dev team | 5 min |

---

## When Enabled — Expected Live Metrics

After CEO completes setup, Mi will be able to pull and report:

- **Daily**: GSC clicks, GA4 sessions, GBP calls
- **Weekly**: Top queries, top pages, keyword rankings
- **Monthly**: Aggregate trend reports, ROI analysis
- **Quarterly**: Comprehensive SEO audit with Google data correlation

---

## Certification

| Check | Status |
|-------|--------|
| GSC metrics requested | ✅ |
| GA4 metrics requested | ✅ |
| GBP metrics requested | ✅ |
| CREDENTIAL_MISSING marked where appropriate | ✅ All 3 connectors |
| Internal data reported honestly | ✅ |
| Traffic limitations documented | ✅ |
| Action plan defined | ✅ |

**Status: CREDENTIAL_MISSING — LIVE_METRICS_PENDING_GOOGLE_SETUP**