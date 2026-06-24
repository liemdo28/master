# CEO GSC SEO Growth Report

**Phase:** 26G — Weekly Growth Report  
**Generated:** 2026-06-24 17:48 Asia/Saigon  
**Status:** WEEKLY_GROWTH_REPORT_READY

## 1. What Changed This Week

- Google Search Console is now active for both Bakudan and Raw Sushi.
- Sitemaps show 0 errors and 0 warnings.
- Live aggregate GSC baselines are confirmed:
  - Bakudan: 587 clicks, 11,174 impressions, 5.3% CTR, avg position 10.8.
  - Raw Sushi: 361 clicks, 28,736 impressions, 1.3% CTR, avg position 9.4.
- Raw Sushi CTR issue identified as the fastest traffic opportunity.
- Bakudan page-one push opportunity identified due to avg position 10.8.

## 2. Top Opportunities

| Brand | Opportunity | Why It Matters | Next Action |
|---|---|---|---|
| Raw Sushi | CTR improvement | 28,736 impressions at only 1.3% CTR | Rewrite title/meta, add FAQs, improve snippets |
| Bakudan | Page-one push | Avg position 10.8 indicates page-one boundary | Expand landing pages, improve internal links |
| Bakudan | La Cantera page gap | Keyword map had no assigned page | Create `ramen-near-la-cantera.html` |
| Both | GSC dashboard automation | Current dashboard lacks full query/page widgets | Build `seo-dashboard-sync` workflow |

## 3. CTR Problems

### Raw Sushi
- CTR is 1.3% despite 28,736 impressions.
- This is the main near-term growth lever.
- Recommended fix: title/meta rewrite across key Stockton/Modesto pages plus FAQ schema expansion.

### Bakudan
- CTR is 5.3%, which is healthier.
- CTR should be maintained while improving rankings.

## 4. Ranking Opportunities

### Bakudan
- Avg position: 10.8.
- Target: move at least 10 query candidates closer to page 1.
- Candidate pages:
  - `/best-ramen-san-antonio.html`
  - `/tonkotsu-ramen-san-antonio.html`
  - `/japanese-food-san-antonio.html`
  - `/ramen-near-utsa.html`
  - `/ramen-near-the-rim-la-cantera.html`
  - `/ramen-stone-oak.html`
  - `/vegetarian-ramen-san-antonio.html`
  - `/happy-hour-ramen-san-antonio.html`

### Raw Sushi
- Avg position: 9.4.
- Ranking is already strong enough for CTR work to matter quickly.
- Focus on improving SERP snippet relevance rather than broad content expansion first.

## 5. Technical Issues

| Issue | Brand | Severity | Evidence |
|---|---|---|---|
| Non-`.html` URLs tested as 404 | Bakudan | High | SEO crawler checked non-`.html` URL variants |
| 169 technical issue records pending | Bakudan | Medium | SEO technical agent output |
| Missing n8n workflows | SEO operations | High | `seo-dashboard-sync` and `seo-content-opportunity-scan` not found |
| Page-level GSC data unavailable | Both | High | Needed for exact top pages and losses |

## 6. Pages Requiring Approval

### Bakudan
- `ramen-near-la-cantera.html`
- `spicy-ramen-san-antonio.html`
- `garlic-tonkotsu-ramen-san-antonio.html`

### Raw Sushi
- `sushi-near-me-stockton.html`
- `best-sushi-rolls-stockton.html`
- `sushi-near-me-modesto.html`

## 7. Expected Impact

| Brand | Expected Action Impact | Measurement Window |
|---|---|---|
| Raw Sushi | CTR target from 1.3% to 2.0%; no traffic growth claimed until GSC confirms | 30 days |
| Bakudan | Improve avg position from 10.8 toward page 1 for 10 query candidates | 30 days |
| Both | Better dashboard visibility and faster iteration | 7–14 days after automation |

## 8. Next 7-Day Plan

1. Pull real GSC query/page exports for last 7 and 28 days.
2. CEO approval for Landing Page Batch 1.
3. Publish Raw Sushi CTR title/meta and FAQ patches after approval.
4. Publish Bakudan page-one push content patches after approval.
5. Create missing n8n workflows: `seo-dashboard-sync` and `seo-content-opportunity-scan`.
6. Submit updated sitemaps and URL inspection requests.
7. Re-check GSC after 7 days; do not claim growth until follow-up data confirms improvement.

## Final Note

No traffic growth is claimed in this report. This week’s progress is activation and execution-readiness, not confirmed performance improvement.
