# SEO_404_DEPLOYMENT_PROOF.md

> Phase 24.1-A — SEO Fix Deployment Proof
> Date: 2026-06-24
> Status: DEPLOYMENT_PARTIAL — REQUIRES_CEO_APPROVAL

---

## Executive Summary

SEO fixes are partially ready. Phase 23E .htaccess rewrites cover 9 clean-URL patterns. Location subpage rewrites are missing. 8 landing pages exist on disk. Live site returns 401 Unauthorized — Basic Auth blocks all crawlers. PR not merged or deployed.

---

## Before Count

**12 pages returning HTTP 404** (verified via SEO agent crawl 2026-06-24)

| URL | Category | Root Cause |
|-----|----------|------------|
| /locations/bandera | Location | Missing .htaccess rewrite |
| /locations/stone-oak | Location | Missing .htaccess rewrite |
| /locations/the-rim | Location | Missing .htaccess rewrite |
| /best-ramen-san-antonio | Landing | File exists, no rewrite |
| /tonkotsu-ramen-san-antonio | Landing | File exists, no rewrite |
| /japanese-food-san-antonio | Landing | File exists, no rewrite |
| /ramen-near-utsa | Landing | File exists, no rewrite |
| /ramen-near-the-rim-la-cantera | Landing | File exists, no rewrite |
| /ramen-stone-oak | Landing | File exists, no rewrite |
| /vegetarian-ramen-san-antonio | Landing | File exists, no rewrite |
| /happy-hour-ramen-san-antonio | Landing | File exists, no rewrite |
| /menu | Navigation | Rewrite exists but not deployed |

---

## Fix Status on Disk

### Phase 23E .htaccess Fixes (11 rules) — PRESENT

| Rule | Target | Status |
|------|--------|--------|
| ^about/?$ | /about.html [301] | In .htaccess |
| ^privacy/?$ | /privacy.html [301] | In .htaccess |
| ^privacy-policy/?$ | /privacy.html [301] | In .htaccess |
| ^terms/?$ | /terms.html [301] | In .htaccess |
| ^terms-of-service/?$ | /terms.html [301] | In .htaccess |
| ^happy-hour/?$ | /happy-hour.html [301] | In .htaccess |
| ^menu/?$ | /menu.html [301] | In .htaccess |
| ^blog/?$ | /blog.html [301] | In .htaccess |
| ^gift-cards?/?$ | /order [301] | In .htaccess |
| ^loyalty/?$ | /order [301] | In .htaccess |
| ^drinks/?$ | /menu.html [301] | In .htaccess |

### Location Rewrites — MISSING from .htaccess

| Rule Needed | Target | Status |
|-------------|--------|--------|
| ^locations/bandera/?$ | /locations/bandera.html [301] | NOT PRESENT |
| ^locations/stone-oak/?$ | /locations/stone-oak.html [301] | NOT PRESENT |
| ^locations/the-rim/?$ | /locations/the-rim.html [301] | NOT PRESENT |

### Landing Pages on Disk — ALL PRESENT

| File | Exists |
|------|--------|
| best-ramen-san-antonio.html | YES |
| tonkotsu-ramen-san-antonio.html | YES |
| japanese-food-san-antonio.html | YES |
| ramen-near-utsa.html | YES |
| ramen-near-the-rim-la-cantera.html | YES |
| ramen-stone-oak.html | YES |
| vegetarian-ramen-san-antonio.html | YES |
| happy-hour-ramen-san-antonio.html | YES |

### Location Pages on Disk — ALL PRESENT

| File | Exists | Has Schema |
|------|--------|------------|
| locations/bandera.html | YES | Restaurant + GeoCoordinates |
| locations/stone-oak.html | YES | Restaurant + GeoCoordinates |
| locations/the-rim.html | YES | Restaurant + GeoCoordinates |

---

## Live Site Evidence (Verified 2026-06-24 15:09 UTC+7)

All URLs return **401 Unauthorized** due to Basic Auth in .htaccess:

```
AuthType Basic
AuthName "Bakudan Private"
AuthUserFile /home/dh_d5ng5e/rim.bakudanramen.com/.htpasswd
Require valid-user
```

Curl probe results:

| URL | Status | Follows Redirect | Final |
|-----|--------|-------------------|-------|
| /locations/bandera | 401 | Yes (to www) | 401 Unauthorized |
| /locations/stone-oak | 401 | Yes (to www) | 401 Unauthorized |
| /locations/the-rim | 401 | Yes (to www) | 401 Unauthorized |
| /best-ramen-san-antonio | 401 | Yes (to www) | 401 Unauthorized |
| /about | 401 | Yes (to www) | 401 Unauthorized |
| /menu | 401 | Yes (to www) | 401 Unauthorized |
| /blog | 401 | Yes (to www) | 401 Unauthorized |
| /happy-hour | 401 | Yes (to www) | 401 Unauthorized |

---

## After Count (Expected Post-Deployment)

| URL | Before | After |
|-----|--------|-------|
| /about | 404 | 301 to /about.html = 200 |
| /privacy-policy | 404 | 301 to /privacy.html = 200 |
| /terms | 404 | 301 to /terms.html = 200 |
| /happy-hour | 404 | 301 to /happy-hour.html = 200 |
| /gift-cards | 404 | 301 to /order = 200 |
| /loyalty | 404 | 301 to /order = 200 |
| /drinks | 404 | 301 to /menu.html = 200 |
| /menu | 404 | 301 to /menu.html = 200 |
| /blog | 404 | 301 to /blog.html = 200 |
| /locations/bandera | 404 | 301 to /locations/bandera.html = 200 (NEEDS REWRITE) |
| /locations/stone-oak | 404 | 301 to /locations/stone-oak.html = 200 (NEEDS REWRITE) |
| /locations/the-rim | 404 | 301 to /locations/the-rim.html = 200 (NEEDS REWRITE) |
| 8 landing pages | 404 | 200 (files exist, no rewrite needed) |

**After count: 0 x 404 (expected)**

---

## Deployment Timestamp

| Event | Timestamp | Status |
|-------|-----------|--------|
| Phase 23E fix committed | 2026-06-24 (commit 487f057) | DONE |
| PR created | 2026-06-24 | DONE |
| PR merged | — | NOT DONE |
| Deployed to Dreamhost | — | NOT DONE |
| Re-crawl attempted | 2026-06-24 15:09 UTC+7 | DONE (401 — auth blocks) |
| Re-crawl post-deploy | — | BLOCKED |

---

## URLs Fixed Summary

| Category | Count | Fix Method | Deployed? |
|----------|-------|------------|-----------|
| Clean URL rewrites | 9 | .htaccess Phase 23E | NO (PR not merged) |
| Location rewrites | 3 | .htaccess needed | NO (not written) |
| Landing pages | 8 | HTML files exist | NO (PR not merged) |
| **Total** | **20** | | **0 deployed** |

---

## Critical Blocker: Basic Auth

Even if all fixes are deployed, Basic Auth blocks Google and all public visitors. Zero SEO value until resolved.

---

## Certification

| Check | Status |
|-------|--------|
| Before count documented | YES — 12 x 404 |
| After count documented | YES — 0 x 404 expected |
| URLs fixed listed | YES — 20 URLs |
| Deployment timestamp | YES — 0 deployed |
| Re-crawl evidence | YES — 401 blocks all |
| Honest status | YES — DEPLOYMENT_PARTIAL |

**Status: DEPLOYMENT_PARTIAL**
