# GSC CONNECTOR IMPLEMENTATION — Phase 4C
**Date:** 2026-06-24

## Files Created

| File | Purpose |
|------|---------|
| `server/src/seo/google-search-console-connector.ts` | Core connector — all GSC API calls |
| `server/src/routes/gsc.ts` | Express router — 6 API endpoints |
| `server/src/index.ts` | Mounted at `/api/seo/gsc` |

## Functions Implemented

| Function | Status |
|----------|--------|
| `listSites()` | ✅ |
| `getSiteStatus(siteUrl)` | ✅ |
| `getSearchAnalytics(siteUrl, start, end)` | ✅ |
| `getTopQueries(siteUrl, start, end)` | ✅ — top 20 by clicks |
| `getTopPages(siteUrl, start, end)` | ✅ — top 20 by clicks |
| `getIndexCoverage(siteUrl)` | ✅ — placeholder (GSC v3 API limitation) |
| `getSitemaps(siteUrl)` | ✅ |
| `getSummary(siteUrl, start, end)` | ✅ — clicks, impressions, CTR, avg position |

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/seo/gsc/status` | Connector status + token validity check |
| `GET /api/seo/gsc/sites` | List all verified GSC properties |
| `GET /api/seo/gsc/:site/summary` | 7-day summary (clicks, impressions, CTR, position, top 5 queries/pages, sitemaps) |
| `GET /api/seo/gsc/:site/top-queries` | Top 20 search queries |
| `GET /api/seo/gsc/:site/top-pages` | Top 20 landing pages |
| `GET /api/seo/gsc/:site/sitemaps` | Sitemap status |

Site URL must be URL-encoded, e.g.:
```
/api/seo/gsc/https%3A%2F%2Fbakudanramen.com%2F/summary
/api/seo/gsc/sc-domain%3Abakudanramen.com/summary
```

## Auth Architecture

- Shares token store with Gmail/Calendar: `.local-agent-global/visibility/google-tokens.json`
- `webmasters.readonly` scope added to existing Google OAuth flow
- Single re-auth at `/api/auth/google/start` covers all Google services

## TypeScript: Zero compile errors
## Runtime: Deployed and responding at `/api/seo/gsc/status`

## Final Status: `GSC_CONNECTOR_BUILT_AWAITING_TOKEN`
