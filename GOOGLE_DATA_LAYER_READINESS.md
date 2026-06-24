# GOOGLE_DATA_LAYER_READINESS.md

> Phase 24.1-C — Google Data Layer Integration Audit
> Date: 2026-06-24
> Status: CREDENTIAL_MISSING — All Three Connectors

---

## Executive Summary

Zero Google data connectors are configured. No organic performance data is available. This document honestly reports the state of each Google integration and what CEO must do to enable live SEO measurement.

---

## Connector Audit

### Google Search Console (GSC)

| Field | Value |
|-------|-------|
| Access Status | CREDENTIAL_MISSING |
| Credential Status | ❌ No OAuth tokens in mi-core/.env |
| Required Scopes | webmasters.readonly |
| OAuth Status | ❌ Not configured |
| API Enabled | ❌ Unknown — needs Google Cloud Console check |
| Owner | CEO (must own bakudanramen.com in GSC) |
| Blocker | No GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, or GOOGLE_REFRESH_TOKEN |

**What GSC provides once connected:**
- Organic clicks, impressions, CTR, average position
- Top queries driving traffic
- Top pages by performance
- Index coverage (which pages Google has indexed)
- Crawl errors and mobile usability issues

**To enable:**
1. CEO verifies bakudanramen.com ownership in Google Search Console
2. Dev creates Google Cloud project + enables Search Console API
3. Dev creates OAuth 2.0 credentials (Client ID + Secret)
4. CEO completes OAuth authorization flow
5. Refresh token added to mi-core/.env
6. Dev team tests connector

**Estimated time:** 30-60 minutes (CEO: 10 min, Dev: 20 min)

---

### Google Analytics 4 (GA4)

| Field | Value |
|-------|-------|
| Access Status | CREDENTIAL_MISSING |
| Credential Status | ❌ No service account configured |
| Required Scopes | analytics.readonly |
| OAuth Status | ❌ Not configured (service account, not OAuth) |
| API Enabled | ❌ Unknown — needs Google Cloud Console check |
| Owner | CEO (must have GA4 admin access) |
| Blocker | No GOOGLE_ANALYTICS_PROPERTY_ID or GOOGLE_SERVICE_ACCOUNT_JSON |

**What GA4 provides once connected:**
- Organic sessions, users, pageviews
- Bounce rate, session duration
- Conversion tracking (online orders)
- Traffic source breakdown
- User demographics and interests
- Site speed metrics

**To enable:**
1. CEO confirms GA4 property exists for bakudanramen.com
2. Dev creates service account in Google Cloud Console
3. CEO grants service account "Viewer" access to GA4 property
4. Service account JSON downloaded and placed in mi-core/.env path
5. GA4 property ID added to mi-core/.env

**Estimated time:** 20-40 minutes (CEO: 10 min, Dev: 15 min)

---

### Google Business Profile (GBP)

| Field | Value |
|-------|-------|
| Access Status | CREDENTIAL_MISSING |
| Credential Status | ❌ No API access configured |
| Required Scopes | business.manage |
| OAuth Status | ❌ Not configured |
| API Enabled | ❌ Unknown — requires GBP API application |
| Owner | CEO (must own GBP listings for all 3 Bakudan locations) |
| Blocker | No GOOGLE_BUSINESS_PROFILE_ACCOUNT_ID or location IDs |

**What GBP provides once connected:**
- Website clicks from Google Maps
- Phone calls from GBP listing
- Direction requests
- Search queries leading to GBP
- Review count, rating, and sentiment
- Photo views and engagement
- Post performance

**GBP locations required:**

| Location | GBP Listing Needed |
|----------|-------------------|
| Bakudan Ramen Bandera | ✅ (must verify) |
| Bakudan Ramen Stone Oak | ✅ (must verify) |
| Bakudan Ramen The Rim | ✅ (must verify) |
| Raw Sushi Bar Stockton | ✅ (must verify) |
| Raw Sushi Bar Modesto | ✅ (must verify) |

**To enable:**
1. CEO applies for Google Business Profile API access
2. Wait 1-7 days for approval
3. Dev enables "My Business Business Information API"
4. CEO completes OAuth for GBP
5. Location IDs added to mi-core/.env

**Estimated time:** 3-7 days (mostly approval wait time)

---

## Alternative: Manual Data Entry

Until connectors are configured, CEO can provide data via:

| Data Source | Method | Frequency |
|-------------|--------|-----------|
| GSC performance | CEO exports CSV from GSC UI | Weekly |
| GA4 traffic | CEO exports CSV from GA4 UI | Weekly |
| GBP insights | CEO provides screenshots | Weekly |
| Revenue impact | CEO reports from POS system | Monthly |

---

## Required .env Configuration

```bash
# Google Search Console
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://bakudanramen.com/api/auth/google/callback
GOOGLE_REFRESH_TOKEN=

# Google Analytics 4
GOOGLE_ANALYTICS_PROPERTY_ID=
GOOGLE_SERVICE_ACCOUNT_JSON=./secrets/ga4-service-account.json

# Google Business Profile
GOOGLE_BUSINESS_PROFILE_ACCOUNT_ID=
GOOGLE_BUSINESS_LOCATION_IDS=bandera,stone-oak,the-rim
```

---

## Security Requirements

- All credentials stored in mi-core/.env (gitignored)
- Service account JSON in ./secrets/ directory
- Refresh tokens rotate every 6 months
- API access limited to read-only scopes
- No credentials ever committed to git

---

## Certification

| Check | Status |
|-------|--------|
| GSC credential status documented | ✅ CREDENTIAL_MISSING |
| GA4 credential status documented | ✅ CREDENTIAL_MISSING |
| GBP credential status documented | ✅ CREDENTIAL_MISSING |
| Required scopes identified | ✅ |
| OAuth requirements documented | ✅ |
| API enablement status reported | ✅ Unknown — needs check |
| Owner identified for each | ✅ CEO |
| Blockers clearly stated | ✅ |
| How to enable documented | ✅ |
| Security requirements defined | ✅ |
| Manual alternative provided | ✅ |

**Status: CREDENTIAL_MISSING — CEO_ACTION_REQUIRED**
