# GSC PROPERTY VERIFICATION REPORT — Phase 4A
**Date:** 2026-06-24

## CEO-Stated Completed Actions (Phases 1-3)

| Action | bakudanramen.com | rawsushibar.com |
|--------|-----------------|-----------------|
| Domain verification | ✅ CEO confirmed | ✅ CEO confirmed |
| Sitemap submitted | ✅ CEO confirmed | ✅ CEO confirmed |
| Indexing requested | ✅ CEO confirmed | ✅ CEO confirmed |

## Live Verification via GSC API

**Status: TOKEN_EXPIRED — re-authorization required**

The Google OAuth token on file has expired (`invalid_grant`). CEO must re-authorize:

```
Open in browser: http://localhost:4001/api/auth/google/start
```

This will re-authorize with the new `webmasters.readonly` scope included.

## Expected State After Re-auth

```
GET /api/seo/gsc/sites
→ ["sc-domain:bakudanramen.com", "sc-domain:rawsushibar.com"]

GET /api/seo/gsc/https%3A%2F%2Fbakudanramen.com%2F/sitemaps
→ [{path: "https://bakudanramen.com/sitemap.xml", ...}]
```

## Final Status: `GSC_AWAITING_REAUTH`
