# SEO Runbook — Phase 6.6

**Updated:** 2026-06-24

## Quick Start

1. Ensure Mi-Core server is running on port 4001
2. Ensure SEO agents are running (ports 4011-4017)
3. Verify brand config is loaded

## Brand Management

### Add a New Brand
1. Edit `SEO/shared/config/brands.json` — add new brand object
2. Edit `SEO/shared/config/locations.json` — add locations for the brand
3. Edit `SEO/shared/config/credentials-map.json` — add credential profiles
4. Call `POST /api/seo/config/reload`
5. Verify: `GET /api/seo/brands` shows new brand
6. Run validator: `node SEO/shared/base/validate-brand-config.js`

### Check Brand Status
```bash
curl http://localhost:4001/api/seo/brands
curl http://localhost:4001/api/seo/brands/bakudan/dashboard
curl http://localhost:4001/api/seo/brands/raw_sushi/dashboard
curl http://localhost:4001/api/seo/brands/test_brand_3/dashboard
```

### Brand-Specific Crawls
```bash
# Crawl bakudan only
curl -X POST "http://localhost:4001/api/seo/orchestrator/run/daily-website-crawl?brand_id=bakudan"

# Crawl raw_sushi only
curl -X POST "http://localhost:4001/api/seo/orchestrator/run/daily-website-crawl?brand_id=raw_sushi"

# Crawl all brands
curl -X POST "http://localhost:4001/api/seo/orchestrator/run/daily-website-crawl?brand_id=all"
```

### Check KPIs
```bash
curl http://localhost:4001/api/seo/brands/bakudan/kpis
curl http://localhost:4001/api/seo/kpis
```

### Data Sources
```bash
curl http://localhost:4001/api/seo/data-sources
```

## Config Validation

### Brand Config Validator
```bash
node SEO/shared/base/validate-brand-config.js
```
Checks: missing domain, address, phone, connector IDs, invalid status, duplicate IDs, duplicate domains.

### Google Credentials Validator
```bash
node SEO/shared/base/validate-google-credentials.js --brand=all
node SEO/shared/base/validate-google-credentials.js --brand=bakudan
```
Checks per brand: configured, missing_credentials, needs_config, invalid_property, invalid_site_url.

## Per-Brand Credential Setup

Edit `SEO/shared/config/credentials-map.json`:
- Set `site_url` for GSC per brand
- Set `property_id` for GA4 per brand
- Set `account_id` for GBP per brand
- Set `credentials_profile` to the correct env var profile

## PM2 Operations

```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 list
```

## Orchestrator Jobs

| Job | Frequency | Brands |
|-----|-----------|--------|
| daily-website-crawl | daily | all active |
| daily-gsc-sync | daily | all active |
| daily-ga4-sync | daily | all active |
| daily-gbp-sync | daily | all active |
| weekly-citation-scan | weekly | all active |
| weekly-executive-seo-report | weekly | all active |
