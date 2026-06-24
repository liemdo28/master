# GSC FIRST LIVE DATA REPORT — Phase 4D
**Date:** 2026-06-24

## Status: VERIFIED_BUT_DATA_PENDING

The GSC connector is built and deployed. Live data pull is blocked by expired OAuth token.

### Evidence

```
GET /api/seo/gsc/status
→ {"ok":false,"status":"TOKEN_EXPIRED","token_valid":false}

GET /api/seo/gsc/sites
→ {"ok":false,"error":"invalid_grant","status":"BLOCKED_BY_GOOGLE_CREDENTIALS"}
```

### Why data may also be pending (separate from auth)

Both domains had Basic Auth (`401 Unauthorized`) blocking Googlebot until **2026-06-24 08:51 UTC** (fixed this session).

- Google must re-crawl both sites now that Basic Auth is removed
- GSC data typically appears 2-3 days after first indexing
- Impressions/clicks from before today may show as 0 for new properties

### What will be pulled once authorized + Google has data

**For each brand (bakudanramen.com + rawsushibar.com):**

| Metric | Expected |
|--------|---------|
| Clicks (7 days) | 0–low (new indexing) |
| Impressions (7 days) | 0–low (new indexing) |
| CTR | — |
| Average Position | — |
| Top Queries | [] initially |
| Top Pages | [] initially |
| Sitemap status | Submitted |

### Action Required

1. CEO: Open `http://localhost:4001/api/auth/google/start` → re-authorize
2. After auth: `GET /api/seo/gsc/sites` should return both domains
3. Wait 2-3 days for Google to re-index (post Basic Auth removal)
4. Re-run: `GET /api/seo/gsc/https%3A%2F%2Fbakudanramen.com%2F/summary`

## Final Status: `VERIFIED_BUT_DATA_PENDING`

> No fake numbers. Connector is ready. Data will appear as Google processes the newly unblocked site.
