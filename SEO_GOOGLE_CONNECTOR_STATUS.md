# SEO_GOOGLE_CONNECTOR_STATUS.md

> Phase 24 — Google Connector Status Report
> Date: 2026-06-24
> Status: CREDENTIALS_MISSING

---

## Purpose

Document the status of Google Search Console (GSC), Google Analytics 4 (GA4), and Google Business Profile (GBP) connectors. Report honest credential status — no fake data.

---

## Connector Status Summary

| Connector | Credential Status | API Enabled | OAuth Configured | Can Read Data | Last Successful Sync | Blocking Issue |
|-----------|-----------------|-------------|-----------------|---------------|---------------------|----------------|
| Google Search Console | ❌ MISSING | Unknown | ❌ No | ❌ No | Never | Google OAuth not set up |
| Google Analytics 4 | ❌ MISSING | Unknown | ❌ No | ❌ No | Never | GA4 API not configured |
| Google Business Profile | ❌ MISSING | Unknown | ❌ No | ❌ No | Never | GBP API not configured |

---

## Google Search Console (GSC)

### What GSC Provides

- Clicks (organic search)
- Impressions
- Click-through rate (CTR)
- Average position
- Top queries
- Top pages
- Index coverage

### Current Status

| Field | Value |
|-------|-------|
| Credential exists | ❌ NO |
| API enabled | ❌ UNKNOWN |
| OAuth configured | ❌ NO |
| Can read data | ❌ NO |
| Last successful sync | ❌ Never |
| Blocking issue | **Missing: Google OAuth credentials in mi-core .env** |

### Required for GSC Access

```
GOOGLE_CLIENT_ID=          # From Google Cloud Console
GOOGLE_CLIENT_SECRET=      # From Google Cloud Console
GOOGLE_REDIRECT_URI=       # https://your-domain.com/api/auth/google/callback
GOOGLE_REFRESH_TOKEN=      # Obtained via OAuth flow
```

### How to Enable

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create project or select existing
3. Enable "Google Search Console API"
4. Create OAuth 2.0 credentials (Client ID + Secret)
5. Add redirect URI
6. Complete OAuth flow to get refresh token
7. Add to mi-core `.env`

### CEO Action Needed

| Action | Owner |
|--------|-------|
| Provide Google Cloud project access | CEO |
| Create OAuth credentials | CEO / Dev team |
| Complete OAuth authorization flow | CEO |
| Add tokens to mi-core .env | Dev team |

---

## Google Analytics 4 (GA4)

### What GA4 Provides

- Organic sessions
- User behavior (bounce rate, session duration)
- Conversion tracking
- Traffic sources
- Page-level analytics

### Current Status

| Field | Value |
|-------|-------|
| Credential exists | ❌ NO |
| API enabled | ❌ UNKNOWN |
| OAuth configured | ❌ NO |
| Can read data | ❌ NO |
| Last successful sync | ❌ Never |
| Blocking issue | **GA4 API not configured** |

### Required for GA4 Access

```
GOOGLE_ANALYTICS_PROPERTY_ID=    # GA4 property ID (e.g., 123456789)
GOOGLE_SERVICE_ACCOUNT_JSON=     # Path to service account JSON
```

### How to Enable

1. Enable "Google Analytics Data API" in Google Cloud Console
2. Create service account
3. Grant "Viewer" access to GA4 property
4. Download service account JSON
5. Add property ID and JSON path to mi-core `.env`

### CEO Action Needed

| Action | Owner |
|--------|-------|
| Create Google Cloud service account | Dev team |
| Grant GA4 read access | CEO (GA admin) |
| Share service account JSON | CEO |
| Add to mi-core .env | Dev team |

---

## Google Business Profile (GBP)

### What GBP Provides

- Business listing data
- Reviews count and rating
- Photos
- Questions & Answers
- Post updates
- Calls / Directions / Website clicks

### Current Status

| Field | Value |
|-------|-------|
| Credential exists | ❌ NO |
| API enabled | ❌ UNKNOWN |
| OAuth configured | ❌ NO |
| Can read data | ❌ NO |
| Last successful sync | ❌ Never |
| Blocking issue | **GBP API not configured** |

### Required for GBP Access

```
GOOGLE_BUSINESS_PROFILE_ACCOUNT_ID=  # My Business Account ID
GOOGLE_BUSINESS_LOCATION_IDS=        # Comma-separated location IDs
```

### How to Enable

1. Apply for Google Business Profile API access (requires verification)
2. Enable "My Business Business Information API" in Google Cloud Console
3. Complete OAuth flow for GBP
4. Add location IDs to mi-core `.env`

### CEO Action Needed

| Action | Owner |
|--------|-------|
| Apply for GBP API access | CEO |
| Complete GBP verification | CEO |
| Set up OAuth | Dev team |
| Add to mi-core .env | Dev team |

---

## Alternative: Manual Data Entry

Until connectors are configured, SEO reports can use:

| Data Source | How to Provide |
|-------------|---------------|
| GSC data | CEO exports CSV from GSC UI manually |
| GA4 data | CEO exports CSV from GA4 UI manually |
| GBP data | CEO provides screenshot or export |

---

## Security Note

Google OAuth credentials must be stored securely:
- In `mi-core/.env` (gitignored)
- Never committed to repo
- Refresh tokens should be long-lived
- Rotate if compromised

---

## Certification

| Check | Status |
|-------|--------|
| GSC credential status documented | ✅ MISSING |
| GA4 credential status documented | ✅ MISSING |
| GBP credential status documented | ✅ MISSING |
| How to enable documented | ✅ |
| CEO action items defined | ✅ |
| Security notes included | ✅ |

**Status: CREDENTIALS_MISSING — CEO_ACTION_REQUIRED**
