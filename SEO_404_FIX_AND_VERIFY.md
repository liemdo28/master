# SEO_404_FIX_AND_VERIFY.md

> Phase 24 — 404 Fix and Verification Report
> Date: 2026-06-24
> Status: FIX_DOCUMENTED — AWAITING_DEPLOYMENT

---

## Problem

Crawl of bakudanramen.com on 2026-06-24 found **12 pages returning HTTP 404**. These are high-value SEO pages that Google may have indexed, causing ranking penalties.

---

## 404 URLs — Root Cause Analysis

### Category A: Location Subpages (3 URLs)

| URL | Source File Exists? | Root Cause | Fix |
|-----|---------------------|------------|-----|
| /locations/bandera | ✅ `locations/bandera.html` | Missing .htaccess rewrite | Add RewriteRule |
| /locations/stone-oak | ✅ `locations/stone-oak.html` | Missing .htaccess rewrite | Add RewriteRule |
| /locations/the-rim | ✅ `locations/the-rim.html` | Missing .htaccess rewrite | Add RewriteRule |

**Root cause:** Apache doesn't serve `/locations/bandera` automatically — needs explicit rewrite to `locations/bandera.html`.

**Fix:** Add 3 RewriteRules to `.htaccess`:
```apache
RewriteRule ^locations/bandera/?$    /locations/bandera.html    [R=301,L]
RewriteRule ^locations/stone-oak/?$  /locations/stone-oak.html  [R=301,L]
RewriteRule ^locations/the-rim/?$    /locations/the-rim.html    [R=301,L]
```

**Estimated SEO impact:** HIGH — location pages are critical for local SEO and Google Business Profile signals.

### Category B: SEO Landing Pages (8 URLs) — Content Does Not Exist

| URL | File Exists? | Fix Required |
|-----|-------------|--------------|
| /best-ramen-san-antonio | ❌ No HTML file | Create landing page OR redirect |
| /tonkotsu-ramen-san-antonio | ❌ No HTML file | Create landing page OR redirect |
| /japanese-food-san-antonio | ❌ No HTML file | Create landing page OR redirect |
| /ramen-near-utsa | ❌ No HTML file | Create landing page OR redirect |
| /ramen-near-the-rim-la-cantera | ❌ No HTML file | Create landing page OR redirect |
| /ramen-stone-oak | ❌ No HTML file | Create landing page OR redirect |
| /vegetarian-ramen-san-antonio | ❌ No HTML file | Create landing page OR redirect |
| /happy-hour-ramen-san-antonio | ❌ No HTML file | Create landing page OR redirect |

**Root cause:** These pages were never created. They appear in sitemap/crawl list but no HTML files exist. These are the **highest-value SEO targets** — long-tail keywords for local search.

### Category C: /menu (1 URL)

| URL | File Exists? | Fix Status |
|-----|-------------|------------|
| /menu | ✅ `menu.html` exists | ✅ Already has RewriteRule in .htaccess |

The `/menu` 404 was likely due to the .htaccess rewrite not being deployed, or a caching issue. The rule exists in the local .htaccess. Needs deployment verification.

---

## Fix Plan

### Phase 1: Immediate .htaccess Patch (Location Pages)

**File:** `Bakudan/bakudanramen.com-current/.htaccess`

Add after existing rewrite rules:

```apache
# ── SEO 404 Fix — Location Subpages (Phase 24) ──────────────────────────────
RewriteRule ^locations/bandera/?$    /locations/bandera.html    [R=301,L]
RewriteRule ^locations/stone-oak/?$  /locations/stone-oak.html  [R=301,L]
RewriteRule ^locations/the-rim/?$    /locations/the-rim.html    [R=301,L]
```

**Action:** Create PR, deploy to server.

### Phase 2: SEO Landing Page Creation (8 Pages)

These 8 pages are **critical SEO content opportunities**. Two options:

#### Option A: Create Full Landing Pages (RECOMMENDED)

Create 8 SEO-optimized HTML pages targeting each keyword:

| Page | Target Keyword | Search Intent | Content Plan |
|------|---------------|----------------|--------------|
| best-ramen-san-antonio.html | best ramen in san antonio | Commercial | Guide to Bakudan's top ramen bowls, why #1 rated |
| tonkotsu-ramen-san-antonio.html | tonkotsu ramen san antonio | Commercial | Deep dive on tonkotsu broth, Bakudan's recipe |
| japanese-food-san-antonio.html | japanese food in san antonio | Commercial | Overview of Japanese cuisine options, Bakudan featured |
| ramen-near-utsa.html | ramen near utsa | Commercial/Local | Location-specific page for UTSA students |
| ramen-near-the-rim-la-cantera.html | ramen near the rim la cantera | Commercial/Local | Location-specific page for Rim/La Cantera shoppers |
| ramen-stone-oak.html | ramen stone oak | Commercial/Local | Location-specific page for Stone Oak area |
| vegetarian-ramen-san-antonio.html | vegetarian ramen san antonio | Informational/Commercial | Vegetarian options guide |
| happy-hour-ramen-san-antonio.html | happy hour ramen san antonio | Commercial/Local | Happy hour specials + CTA |

**Estimated effort:** 2-3 hours per page (Mi content + OpenAI drafting + CEO review)
**SEO impact:** VERY HIGH — captures long-tail local search traffic

#### Option B: Redirect to Relevant Pages (QUICK FIX)

Add .htaccess redirects until landing pages are created:

```apache
# ── SEO 404 Redirects — Landing Pages (Phase 24, temporary) ──────────────────
RewriteRule ^best-ramen-san-antonio/?$              /index.html              [R=301,L]
RewriteRule ^tonkotsu-ramen-san-antonio/?$          /menu.html               [R=301,L]
RewriteRule ^japanese-food-san-antonio/?$            /about.html              [R=301,L]
RewriteRule ^ramen-near-utsa/?$                      /locations.html          [R=301,L]
RewriteRule ^ramen-near-the-rim-la-cantera/?$        /locations/the-rim.html  [R=301,L]
RewriteRule ^ramen-stone-oak/?$                      /locations/stone-oak.html [R=301,L]
RewriteRule ^vegetarian-ramen-san-antonio/?$         /menu.html               [R=301,L]
RewriteRule ^happy-hour-ramen-san-antonio/?$         /happy-hour.html         [R=301,L]
```

**Note:** Option A is strongly recommended. Option B preserves link equity but loses the ability to rank for specific keywords.

---

## Verification Steps

After deploying fix:

1. **Re-crawl** bakudanramen.com with SEO crawler
2. **Verify** all 12 URLs return 200 OK or 301 → 200
3. **Submit updated sitemap** to Google Search Console (when configured)
4. **Monitor** Google Search Console for crawl errors (when configured)
5. **Track rankings** for each target keyword

---

## Impact Summary

| Metric | Before Fix | After Fix |
|--------|-----------|-----------|
| Total 404 errors | 12 | 0 |
| Location page 404s | 3 | 0 (RewriteRules) |
| SEO landing page 404s | 8 | 0 (new pages or redirects) |
| /menu 404 | 1 | 0 (rewrite exists) |
| Pages returning 200 | 1 | 13+ |
| Critical SEO pages indexed | 0 | 12+ |

---

## PR Status

| Item | Status |
|------|--------|
| .htaccess location rewrites | ⏳ PR needed |
| SEO landing pages (Option A) | ⏳ Content creation needed |
| OR temporary redirects (Option B) | ⏳ PR needed |
| Build/test | ⏳ Pending PR |
| Re-crawl | ⏳ Pending deployment |
| CEO approval | ⏳ Required before merge |

---

## Certification

| Check | Status |
|-------|--------|
| All 12 404 URLs identified | ✅ |
| Root cause analyzed | ✅ |
| Fix plan documented | ✅ |
| Location page fix ready | ✅ (.htaccess rules) |
| Landing page plan ready | ✅ (8 pages planned) |
| Verification steps defined | ✅ |
| PR created | ⏳ Pending |
| CEO approval | ⏳ Required |
| Re-crawl completed | ⏳ Pending deployment |

**Status: 404_FIX_DOCUMENTED_AWAITING_DEPLOYMENT**
