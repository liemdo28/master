# SEO DAILY GSC MONITORING — Phase 4G
**Date:** 2026-06-24

## Daily Schedule

n8n workflow `seo-daily-audit` runs at **06:00 daily** and performs:

| Task | Implementation |
|------|---------------|
| Pull GSC data (clicks, impressions, CTR, position) | `GET /api/seo/gsc/:site/summary` |
| Run website crawl (4xx check) | `GET /api/seo/crawl/:site` |
| Compare vs previous day | Stored in n8n execution history |
| Detect traffic drop (>20% click drop) | Conditional node in workflow |
| Detect indexing errors | `GET /api/seo/gsc/:site/sitemaps` — errors field |
| Generate CEO summary | WhatsApp message via mi-core |

## Alert Thresholds

| Metric | Alert Condition |
|--------|----------------|
| Clicks | Drop > 20% day-over-day |
| Average Position | Drop > 5 positions |
| Sitemap errors | Any error > 0 |
| 4xx pages | Any new 404 detected |

## Brands Monitored

- `https://bakudanramen.com/` — Bakudan Ramen
- `https://rawsushibar.com/` — Raw Sushi Bar

## Schedule Config

```
Workflow: seo-daily-audit
Cron: 0 6 * * *   (06:00 every day, server time)
```

Already created in n8n. Will activate automatically once GSC token is valid.

## Final Status: `SEO_DAILY_MONITORING_CONFIGURED`
