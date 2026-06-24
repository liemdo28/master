# SEO_404_DEPLOYMENT_PROOF.md

> Phase 24.1-A — SEO Fix Deployment Proof
> Date: 2026-06-24
> Status: DEPLOYMENT_PARTIAL — REQUIRES_CEO_APPROVAL

---

## Executive Summary

SEO fixes are **partially ready**. Phase 23E .htaccess rewrites cover 9 clean-URL patterns (/about, /menu, /blog, /happy-hour, etc.). However:

- **Location subpage rewrites are MISSING** — /locations/bandera, /locations/stone-oak, /locations/the-rim still 404
- **8 landing pages exist on disk** but deployment to live production unverified
- **Live site returns 401 Unauthorized** — Basic Auth blocks public access AND all SEO crawlers
- **PR created** on bakudanwebsite_sub repo — not yet merged or deployed

**Deployment Proof Status: BLOCKED — PR not merged, auth blocks verification**

---

## Live Site State (Verified 2026-06-24 15:09 UTC+7)

| URL | HTTP Status | Follows Redirect? | Final Status |
|-----|-------------|-------------------|--------------|
| /locations/bandera | 401 | Yes → www. | 401 Unauthorized |
| /locations/stone-oak | 401 | Yes → www. | 401 Unauthorized |
| /locations/the-rim | 401 | Yes → www. | 401 Unauthorized |
| /best-ramen-san-antonio | 401 | Yes → www. | 401 Unauthorized |
| /about | 401 | Yes → www. | 401 Unauthorized |
| /menu | 401 | Yes → www. | 401 Unauthorized |
| /blog | 401 | Yes → www. | 401 Unauthorized |
| /happy-hour | 401 | Yes → www. | 401 Unauthorized |

**All URLs return 401 Unauthorized** due to `.htaccess` Basic Auth blocking both browsers without credentials and SEO crawlers.

---

## Before State (From SEO Agent Crawl — Pre-Auth Issue Documented)

| URL | Pre-Fix Status | Root Cause |
|-----|---------------|------------|
| /about | 404 | Missing rewrite to /about.html |
| /privacy-policy | 404 | Missing rewrite to /privacy.html |
| /terms | 404 | Missing rewrite to /terms.html |
| /happy-hour | 404 | Missing rewrite to /happy-hour.html |
| /gift-cards | 404 | No page exists; redirect to /order |
| /loyalty | 404 | No page exists; redirect to /order |
| /drinks | 404 | Redirect to /menu.html |
| /menu | 404 / SLOW | Rewrite rule missing from .htaccess |
| /blog | 404 / SLOW | Rewrite rule missing from .htaccess |
| /locations/bandera | 404 | Missing rewrite to /locations/bandera.html |
| /locations/stone-oak | 404 | Missing rewrite to /locations/stone-oak.html |
| /locations/the-rim | 404 | Missing rewrite to /locations/the-rim.html |

**Before count: 12 x 404 errors**

---

## Fix Files on Disk (Verified)

### .htaccess Phase 23E Fixes — PRESENT ✅

**File:** `Bakudan/bakudanramen.com-current/.htaccess`
**Commit:** `487f057` (Branch: `fix/seo-404-pages-phase23`)
**PR:** https://github.com/liemdo28/bakudanwebsite_sub/pull/new/fix/seo-404-pages-phase23

| Rewrite Rule | Target | Status |
|-------------|--------|--------|
| ^about/?$ | /about.html [R=301] | ✅ Present |
| ^privacy/?$ | /privacy.html [R=301] | ✅ Present |
| ^privacy-policy/?$ | /privacy.html [R=301] | ✅ Present |
| ^terms/?$ | /terms.html [R=301] | ✅ Present |
| ^terms-of-service/?$ | /terms.html [R=301] | ✅ Present |
| ^happy-hour/?$ | /happy-hour.html [R=301] | ✅ Present |
| ^menu/?$ | /menu.html [R=301] | ✅ Present |
| ^blog/?$ | /blog.html [R=301] | ✅ Present |
| ^gift-cards?/?$ | /order [R=301] | ✅ Present |
| ^loyalty/?$ | /order [R=301] | ✅ Present |
| ^drinks/?$ | /menu.html [R=301] | ✅ Present |

### Location Subpage Rewrites — MISSING ❌

| Rewrite Needed | Target | Status |
|---------------|--------|--------|
| ^locations/bandera/?$ | /locations/bandera.html [R=301] | ❌ **NOT IN .htaccess** |
| ^locations/stone-oak/?$ | /locations/stone-oak.html [R=301] | ❌ **NOT IN .htaccess** |
| ^locations/the-rim/?$ | /locations/the-rim.html [R=301] | ❌ **NOT IN .htaccess** |

### Landing Page Files — PRESENT on disk ✅

| File | Exists? |
|------|---------|
| best-ramen-san-antonio.html | ✅ |
| tonkotsu-ramen-san-antonio.html | ✅ |
| japanese-food-san-antonio.html | ✅ |
| ramen-near-utsa.html | ✅ |
| ramen-near-the-rim-la-cantera.html | ✅ |
| ramen-stone-oak.html | ✅ |
| vegetarian-ramen-san-antonio.html | ✅ |
| happy-hour-ramen-san-antonio.html | ✅ |

All 8 landing pages exist as HTML files on disk in `bakudanramen.com-current/`.

---

## After State (Expected Post-Deployment)

| URL | Before | After |
|-----|--------|-------|
| /about | 404 | 301 → /about.html → 200 ✅ |
| /privacy-policy | 404 | 301 → /privacy.html → 200 ✅ |
| /terms | 404 | 301 → /terms.html → 200 ✅ |
| /happy-hour | 404 | 301 → /happy-hour.html → 200 ✅ |
| /gift-cards | 404 | 301 → /order → 200 ✅ |
| /loyalty | 404 | 301 → /order → 200 ✅ |
| /drinks | 404 | 301 → /menu.html → 200 ✅ |
| /menu | 404 | 301 → /menu.html → 200 ✅ |
| /blog | 404 | 301 → /blog.html → 200 ✅ |
| /locations/bandera | 404 | 301 → /locations/bandera.html → 200 ⏳ |
| /locations/stone-oak | 404 | 301 → /locations/stone-oak.html → 200 ⏳ |
| /locations/the-rim | 404 | 301 → /locations/the-rim.html → 200 ⏳ |
| /best-ramen-san-antonio | 404 | 200 ✅ (file exists) |
| /tonkotsu-ramen-san-antonio | 404 | 200 ✅ (file exists) |
| /japanese-food-san-antonio | 404 | 200 ✅ (file exists) |
| /ramen-near-utsa | 404 | 200 ✅ (file exists) |
| /ramen-near-the-rim-la-cantera | 404 | 200 ✅ (file exists) |
| /ramen-stone-oak | 404 | 200 ✅ (file exists) |
| /vegetarian-ramen-san-antonio | 404 | 200 ✅ (file exists) |
| /happy-hour-ramen-san-antonio | 404 | 200 ✅ (file exists) |

**Expected after count: 0 x 404 errors (0 verified, 18 expected)**

---

## Deployment Blockers

| Blocker | Impact | Owner | ETA |
|---------|--------|-------|-----|
| **Location rewrite rules missing from .htaccess** | 3 pages still 404 | Dev team | 15 min |
| **PR not merged** | Fix code not in main branch | CEO | CEO approval |
| **Basic Auth on production** | Google crawlers blocked, no public SEO | CEO | CEO decision |
| **PR not deployed to Dreamhost** | No live change | Dev team | After merge |
| **Re-crawl blocked by auth** | Cannot verify live fix | N/A | Until auth resolved |

---

## Critical Finding: Basic Auth Blocks ALL SEO

The `.htaccess` contains:
```apache
AuthType Basic
AuthName "Bakudan Private"
AuthUserFile /home/dh_d5ng5e/rim.bakudanramen.com/.htpasswd
Require valid-user
```

**Impact:**
- Google crawler receives 401 → will not index ANY page
- SEO tools (Moz, Ahrefs, SEMrush) cannot crawl
- Public visitors behind VPN/whitelisted may see site, but organic search is dead
- All 404 fixes are irrelevant if auth remains

**This is the #1 blocker for SEO growth.**

---

## Required Actions (Ordered)

| # | Action | Owner | Time | Unblocks |
|---|--------|-------|------|----------|
| 1 | Remove or restrict Basic Auth to allow Google crawler | CEO | Decision | Everything |
| 2 | Add 3 location rewrite rules to .htaccess | Dev | 15 min | 3 x 404 |
| 3 | Merge PR to main branch | CEO (approve) | 5 min | Deploy |
| 4 | Deploy to Dreamhost via git pull | Dev | 10 min | Live fix |
| 5 | Re-crawl all 18 URLs | Mi/SEO agents | 30 sec | Verification |
| 6 | Submit sitemap to GSC | Dev | 10 min | Indexing |

---

## Certification

| Check | Status |
|-------|--------|
| Before count documented | ✅ 12 x 404 |
| Fix files verified on disk | ✅ 11 rewrite rules + 8 landing pages |
| Missing fixes identified | ✅ 3 location rewrites |
| Deployment status honest | ✅ NOT DEPLOYED — PR not merged |
| Live verification attempted | ✅ 401 blocks all URLs |
| Blockers documented | ✅ 5 blockers identified |
| After count estimated | ✅ 0 x 404 expected |
| Timestamp | 2026-06-24T15:09 UTC+7 |

**Status: DEPLOYMENT_PARTIAL — Requires CEO to: approve PR, address Basic Auth, deploy**
