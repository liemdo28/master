# Phase 34B — Google Business Profile (GBP) Attribution Activation

**Date:** 2026-06-25
**Status:** BUILT — Awaiting Re-Authorization (scope not yet in active token)

---

## What Was Built

### Files Created
- `server/src/seo/gbp-connector.ts` — GBP connector with SQLite snapshot storage
- `server/src/routes/gbp-analytics.ts` — Express router for GBP API endpoints

### Files Modified
- `server/src/visibility/connectors/google/google-auth.ts` — Added `business.manage` scope
- `server/src/index.ts` — Mounted `gbpAnalyticsRouter` at `/api/gbp`

### TypeScript Compile Result
**Zero errors.** `npx tsc --noEmit` passed clean.

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/gbp/status` | Connector status + whether re-auth is needed |
| GET | `/api/gbp/locations` | List all GBP locations from Google account |
| GET | `/api/gbp/metrics` | Daily metrics for all locations (last 30d) |
| GET | `/api/gbp/metrics/:locationId` | Metrics for a specific location |
| POST | `/api/gbp/snapshot` | Trigger manual snapshot to SQLite DB |

Query param: `?days=N` (default 30) supported on `/metrics` routes.

---

## OAuth Scope Required

```
https://www.googleapis.com/auth/business.manage
```

This scope was **added to SCOPES array** in `google-auth.ts`. However, existing tokens stored at:

```
E:/Project/Master/.local-agent-global/visibility/google-tokens.json
```

do NOT include this scope — Google issues scopes at authorization time and does not upgrade existing tokens.

---

## Re-Authorization Instruction

**CEO must re-authorize Google to include the new GBP scope:**

1. Visit: **http://localhost:4001/api/auth/google/start**
2. Google consent screen will now include "Manage your Google Business Profile" permission
3. After approving, tokens are saved and GBP connector becomes active
4. Verify with: **GET http://localhost:4001/api/gbp/status**

Expected response after re-auth:
```json
{
  "configured": true,
  "status": "GBP_CONNECTOR_READY",
  "has_scope": true,
  "re_auth_needed": false
}
```

---

## Current Status / Blockers

| Item | Status |
|------|--------|
| OAuth scope added to SCOPES | DONE |
| GBP connector built | DONE |
| Routes mounted | DONE |
| TypeScript compile | PASS (0 errors) |
| Active token has `business.manage` scope | PENDING — re-auth required |
| GBP API enabled in Google Cloud Console | UNKNOWN — verify at console.cloud.google.com |

### Blocker 1: Re-authorization Required
The `business.manage` scope was not in prior auth flow. Token currently stored does not grant GBP access. CEO must visit `/api/auth/google/start`.

### Blocker 2: Google Cloud Console API Enablement (Verify)
The following APIs must be enabled in Google Cloud Console for the OAuth client project:
- **Business Profile Performance API** (`businessprofileperformance.googleapis.com`)
- **My Business Business Information API** (`mybusinessbusinessinformation.googleapis.com`)

To check: https://console.cloud.google.com/apis/library

If not enabled, API calls will return 403 errors even after re-auth. Enable both APIs in the same GCP project that hosts the OAuth client ID.

---

## Local Intent Metrics Collected

Once authorized, the connector pulls these signals per location per day:

| Metric | Description |
|--------|-------------|
| `CALL_CLICKS` | Taps on phone number in GBP listing |
| `WEBSITE_CLICKS` | Clicks through to website from GBP |
| `BUSINESS_DIRECTION_REQUESTS` | "Get Directions" requests |
| `BUSINESS_IMPRESSIONS_DESKTOP_MAPS` | Google Maps views on desktop |
| `BUSINESS_IMPRESSIONS_MOBILE_MAPS` | Google Maps views on mobile |
| `BUSINESS_IMPRESSIONS_DESKTOP_SEARCH` | Google Search listing views (desktop) |
| `BUSINESS_IMPRESSIONS_MOBILE_SEARCH` | Google Search listing views (mobile) |

Snapshots stored at: `E:/Project/Master/.local-agent-global/seo/gbp-snapshots.db`

---

## Brands Coverage

Both brands will be covered once GBP locations are linked to the authorized Google account:

- **Bakudan Ramen** (`bakudanramen.com`)
- **Raw Sushi Bar** (`rawsushibar.com`)

Locations are auto-discovered via `listLocations()` — no manual location ID config needed.
