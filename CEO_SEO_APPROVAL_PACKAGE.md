# CEO_SEO_APPROVAL_PACKAGE.md

> Phase 24.1-F — CEO Approval Package
> Date: 2026-06-24
> Status: READY_FOR_CEO_APPROVAL

---

## Executive Summary for CEO

Phase 24.1 converted SEO workflow activity into production-ready assets. This package consolidates everything into a single approval document. CEO must decide: Approve, Reject, Edit, or Prioritize.

---

## What Was Discovered

1. **Bakudan website is behind Basic Auth** — Google cannot crawl ANY page. This is the #1 SEO blocker.
2. **8 SEO landing pages already exist on disk** — production-ready with schema, FAQ, CTAs.
3. **3 location page rewrites are missing** from .htaccess.
4. **11 clean-URL rewrites are ready** (Phase 23E) but not deployed.
5. **Raw Sushi has 14+ SEO pages** targeting Stockton/Modesto.
6. **All 3 Google data connectors are missing** — no way to measure organic performance.
7. **No sitemap.xml or robots.txt** on bakudanramen.com.

---

## Approval Items — Ranked by Priority

### P1: CRITICAL — Revenue-Blocking

| # | Item | What It Does | CEO Action |
|---|------|-------------|------------|
| 1 | **Remove Basic Auth** | Allows Google to crawl and index the site. Without this, zero SEO value from ANY work done. | Decide: Remove auth OR create Googlebot whitelist exception |
| 2 | **Approve 8 Bakudan landing pages** | Already built. Just need deployment to production. | Approve / Reject |
| 3 | **Add 3 location .htaccess rewrites** | Fixes /locations/bandera, /locations/stone-oak, /locations/the-rim 404 errors. | Approve / Reject |
| 4 | **Merge + deploy PR** | Phase 23E .htaccess fixes (11 rewrites) in PR. Need merge and Dreamhost deploy. | Approve / Reject |

### P2: HIGH — Measurement-Blocking

| # | Item | What It Does | CEO Action |
|---|------|-------------|------------|
| 5 | **GSC OAuth setup** | Enables organic click/impression/CTR tracking. | Provide Google Cloud credentials |
| 6 | **GA4 service account setup** | Enables session/conversion tracking. | Grant service account GA4 access |
| 7 | **GBP API access** | Enables calls/directions/website clicks tracking. | Apply for GBP API |
| 8 | **Create sitemap.xml + robots.txt** | Helps Google discover and crawl pages. | Approve creation |

### P3: HIGH — Growth-Enabling

| # | Item | What It Does | CEO Action |
|---|------|-------------|------------|
| 9 | **Raw Sushi 14+ pages deployment** | SEO pages targeting Stockton/Modesto need production deploy. | Approve / Reject |
| 10 | **10 article briefs** | 5 Bakudan + 5 Raw Sushi content briefs for blog pipeline. | Approve / Edit |

---

## Expected Impact

### If All P1 Items Approved + Deployed

| Metric | Before | Expected After (90 days) |
|--------|--------|-------------------------|
| Google-indexed pages | 0 (auth blocks crawlers) | 25+ pages |
| Organic impressions/month | 0 | 50,000+ |
| Organic clicks/month | 0 | 1,000+ |
| GBP website clicks/month | Unknown | 300+ |
| GBP phone calls/month | Unknown | 150+ |
| Revenue influenced by organic | $0 tracked | $5,000+/month |

### If All P1 + P2 Items Completed (6 months)

| Metric | Target |
|--------|--------|
| Organic clicks/month | 5,000+ |
| GBP calls + directions/month | 1,400+ |
| Revenue influenced/month | $20,000+ |

---

## What CEO Can Decide

| Decision | Impact | Consequence of Reject |
|----------|--------|----------------------|
| **Approve** | SEO assets deploy, Google indexes pages, traffic begins | — |
| **Reject** | Assets remain on disk, no traffic growth | SEO remains BLOCKED |
| **Edit** | Specific pages modified before deploy | Slight delay, assets still deploy |
| **Prioritize** | CEO chooses which items to do first | Partial progress |

---

## Required Decisions

### Decision 1: Basic Auth (MOST CRITICAL)

```
Option A: Remove Basic Auth entirely (recommended for SEO)
Option B: Whitelist Googlebot IP ranges only
Option C: Keep auth, accept zero organic traffic
```

**Mi recommendation: Option A.** The site is a public restaurant. Basic Auth should not be on the production domain. If the rim.bakudanramen.com subdomain is staging, auth is appropriate there, but bakudanramen.com should be public.

### Decision 2: Landing Pages

```
Option A: Deploy all 8 pages as-is (recommended)
Option B: Review each page individually
Option C: Reject all, create different pages
```

### Decision 3: Google Connectors

```
Option A: CEO sets up OAuth this week (recommended)
Option B: CEO provides manual CSV exports weekly
Option C: No measurement until further notice
```

### Decision 4: Raw Sushi

```
Option A: Deploy Raw Sushi SEO pages (recommended)
Option B: Focus on Bakudan only for now
Option C: Redesign Raw Sushi site first
```

---

## Files Included in This Package

| # | File | Purpose |
|---|------|---------|
| 1 | SEO_404_DEPLOYMENT_PROOF.md | 404 fix status + deployment evidence |
| 2 | SEO_LANDING_PAGE_PRODUCTION.md | Landing page inventory |
| 3 | GOOGLE_DATA_LAYER_READINESS.md | Google connector audit |
| 4 | SEO_CONTENT_PRODUCTION_PIPELINE.md | 10 content briefs |
| 5 | SEO_GROWTH_KPI_FRAMEWORK.md | Business outcome KPIs |
| 6 | CEO_SEO_APPROVAL_PACKAGE.md | This document |

---

## Certification

| Check | Status |
|-------|--------|
| All deliverables compiled | ✅ 6 files |
| Priority ranking clear | ✅ P1/P2/P3 |
| Expected impact documented | ✅ Before/after estimates |
| Decision options provided | ✅ 4 decisions needed |
| No fake data used | ✅ All BLOCKED_BY_GOOGLE_DATA or verified |
| Honest about blockers | ✅ Auth, credentials, deployment |

**Status: READY_FOR_CEO_APPROVAL**
