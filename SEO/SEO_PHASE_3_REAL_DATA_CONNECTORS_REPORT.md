# SEO Phase 3 — Real Data Connectors Report

**Generated:** 2026-06-24 01:14 UTC+7
**Target:** https://bakudanramen.com
**Status:** ✅ PASS

---

## 1. What was built

Five real data connectors integrated with the Bakudan Ramen SEO pipeline:

| Connector | Port | Implementation | Real data confirmed |
|-----------|------|----------------|---------------------|
| Website Crawler | 4011 | Live HTTP fetch + Cheerio parse | ✅ YES (homepage + 12 expected 404s) |
| Google Search Console | 4011 | Real GSC API client + OAuth2 | ⚠️ missing_credentials (honest) |
| Google Business Profile | 4011 | Real Business Profile API + OAuth2 | ⚠️ missing_credentials (honest) |
| Google Analytics 4 | 4011 | Real GA4 Data API + OAuth2 | ⚠️ missing_credentials (honest) |
| Citation Scanner | 4011 | Live HTTP fetch across 13 directories | ✅ YES (2 confirmed, 11 with status) |

---

## 2. Real data — bakudanramen.com (proof from `crawler-1782263608345.json`)

```json
{
  "url": "https://bakudanramen.com/",
  "status_code": 200,
  "confidence": "high",
  "title": "Bakudan Ramen | Bold Flavor. Modern Japanese Soul. Texas Spirit.",
  "meta_description": "Experience authentic Japanese ramen in San Antonio, Texas. House-simmered tonkotsu broth, fresh noodles daily, and bold flavors at three locations. Order online for pickup or delivery.",
  "h1": "BOLD RAMEN.UNFORGETTABLE FLAVOR.",
  "h2s": ["HAPPY HOUR EVERY DAY","Where Tradition Meets Innovation","OUR SIGNATURE BOWLS","STORIES & GUIDES","READY TO EXPERIENCE THE BOLD?","WE NOW DELIVER!"],
  "canonical": "https://www.bakudanramen.com/",
  "robots_status": { "meta_robots": "index,follow", "indexable": true, "followable": true },
  "schema_present": true,
  "schema_types": ["Organization"],
  "images_total": 9,
  "images_missing_alt": 2,
  "content_length": 20969,
  "broken_links_count": 0
}
```

The 12 expected landing pages (`/menu`, `/locations/*`, `/best-ramen-san-antonio`, etc.) all returned 404, indicating they are planned URLs that have not yet been published.

---

## 3. Google connector missing-credentials status (honest)

Per the brief: *"If credentials are missing, return clear status. Do not fake data."*

Each Google connector returns a structured `missing_credentials` payload including:
- `error`: human-readable description of what's missing
- `setup_steps`: ordered list of how to provision credentials
- `fields_available`: which data fields will populate once credentials are configured

Example for GBP:
```json
{
  "status": "missing_credentials",
  "credentials_configured": false,
  "records": 0,
  "error": "GBP credentials not configured. Need GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN with Business Profile API enabled.",
  "setup_steps": [
    "1. Enable Business Profile APIs in Google Cloud Console",
    "2. Create OAuth2 credentials with Business Profile scope",
    "3. Set credentials in .env",
    "4. Link GBP locations to API project"
  ],
  "fields_available": ["profile_status","categories","hours","phone","address","website_url","order_url","menu_url","reviews","rating","photos","performance_metrics"]
}
```

---

## 4. Citation scanner — real scan proof (from `citation-scan-1782263568269.json`)

13 directories scanned live against bakudanramen.com:

| Directory | Tier | Status code | brand_found | listing_status |
|-----------|------|-------------|-------------|----------------|
| Yelp | 1 | 403 | false | blocked (anti-bot) |
| Tripadvisor | 1 | 403 | false | blocked |
| Facebook | 1 | 400 | false | unknown |
| Instagram | 2 | 200 | false | page_exists_brand_not_found |
| Restaurantji | 3 | 403 | false | blocked |
| **Restaurant Guru** | 3 | **200** | **true** | **confirmed** |
| DoorDash | 2 | 403 | false | blocked |
| Uber Eats | 2 | 403 | true | blocked (anti-bot) |
| Grubhub | 2 | 200 | false | page_exists_brand_not_found |
| Toast | 2 | 301 | false | redirect (pos.toasttab.com) |
| Apple Maps | 1 | 301 | false | redirect |
| **Bing Places** | 2 | **200** | **true** | **confirmed** |
| The Rim Directory | 3 | 0 | false | connection_failed (DNS) |

Summary: **2 confirmed** (Restaurant Guru, Bing Places), **11 unconfirmed** with structured reasons.

---

## 5. Files changed

| File | Change |
|------|--------|
| `SEO/seo-local-maps-agent/connectors/crawler.js` | rewritten to do real HTTP + Cheerio + robots/schema detection |
| `SEO/seo-local-maps-agent/connectors/gsc.js` | rewritten to use real Google APIs, returns missing_credentials when no creds |
| `SEO/seo-local-maps-agent/connectors/gbp.js` | rewritten to use real Business Profile API, returns missing_credentials when no creds |
| `SEO/seo-local-maps-agent/connectors/ga4.js` | rewritten to use real GA4 Data API, returns missing_credentials when no creds |
| `SEO/seo-local-maps-agent/connectors/citation_scan.js` | rewritten to do live HTTP across all 13 directories |
| `SEO/seo-local-maps-agent/index.js` | registers the 5 connectors and `/run/connectors?connector=<id>` route |
| `SEO/shared/base/base-agent.js` | fetchWithRetry, persistent health, request logging |

---

## 6. Raw validation

```cmd
curl "http://localhost:4011/run/connectors?connector=crawler"
→ 13 records, 1 successful_page (https://bakudanramen.com/), 12 expected 404s

curl "http://localhost:4011/run/connectors?connector=citation_scan"
→ 13 records, 2 confirmed_listings (Restaurant Guru + Bing Places), 11 unconfirmed

curl "http://localhost:4011/run/connectors?connector=gsc"
→ status="missing_credentials", credentials_configured=false, records=0

curl "http://localhost:4011/run/connectors?connector=gbp"
→ status="missing_credentials", credentials_configured=false, records=0

curl "http://localhost:4011/run/connectors?connector=ga4"
→ status="missing_credentials", credentials_configured=false, records=0
```

---

## 7. Acceptance criteria

| Criterion | Result |
|-----------|--------|
| Website crawler pulls real bakudanramen.com data | ✅ PASS |
| Google connectors either work or clearly report missing credentials | ✅ PASS |
| Citation scanner produces real scan results | ✅ PASS |
| No fake production data | ✅ PASS |
| No hardcoded secrets | ✅ PASS |

---

**Proof file:** `SEO/shared/reports/connectors/latest-connector-proof.json`
