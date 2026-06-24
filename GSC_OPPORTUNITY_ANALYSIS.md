# GSC Opportunity Analysis

**Phase:** 26A — GSC Opportunity Analysis  
**Generated:** 2026-06-24 17:20 Asia/Saigon  
**Evidence rule:** No fake data. Uses only CTO-provided live GSC aggregates and repository evidence. Detailed GSC query/page exports for last 7 days and last 28 days were not found in workspace.

## Confirmed Live GSC Baseline

| Brand | Clicks | Impressions | CTR | Avg Position | Top Query | Top Query Clicks | Top Query Avg Position | Sitemap Status |
|---|---:|---:|---:|---:|---|---:|---:|---|
| Bakudan | 587 | 11,174 | 5.3% | 10.8 | bakudan ramen | 218 | 1.5 | 0 errors / 0 warnings |
| Raw Sushi | 361 | 28,736 | 1.3% | 9.4 | raw sushi | 88 | 3.2 | 0 errors / 0 warnings |

## Last 7 Days vs Last 28 Days

| Dataset | Status | Notes |
|---|---|---|
| Bakudan last 7 days | Not available | No query/page CSV, JSON, API result, or n8n payload found locally. |
| Bakudan last 28 days | Aggregate available only | CTO baseline confirms clicks, impressions, CTR, avg position, and top query. |
| Raw Sushi last 7 days | Not available | No query/page CSV, JSON, API result, or n8n payload found locally. |
| Raw Sushi last 28 days | Aggregate available only | CTO baseline confirms clicks, impressions, CTR, avg position, and top query. |

## 1. High-Impression Low-CTR Queries

### Bakudan
- Exact list cannot be generated without query-level GSC rows.
- Aggregate CTR is 5.3%, so the issue is less severe than Raw Sushi.
- Known top query `bakudan ramen` performs strongly: 218 clicks at position 1.5.

### Raw Sushi
- Exact top 20 cannot be generated without query-level GSC rows.
- Confirmed opportunity: 28,736 impressions with only 1.3% CTR.
- Known branded query `raw sushi` ranks at position 3.2 with 88 clicks, indicating SERP snippet/title/meta improvement may help even on brand traffic.

## 2. Position 4–10 Quick-Win Queries

### Bakudan
- Exact query list unavailable.
- Aggregate avg position 10.8 indicates likely quick-win inventory near positions 8–10.
- Repository target pages already exist for likely non-brand restaurant searches: best ramen San Antonio, tonkotsu ramen San Antonio, Japanese food San Antonio, ramen near UTSA, ramen near The Rim/La Cantera, ramen Stone Oak, vegetarian ramen, happy hour ramen.

### Raw Sushi
- Exact query list unavailable.
- Aggregate avg position 9.4 suggests many impressions are already on page 1 but CTR is weak.
- Repository target pages exist for Stockton/Modesto sushi, Japanese restaurant, menu, order, catering, delivery, date night, and downtown Modesto intent.

## 3. Position 11–20 Push-to-Page-1 Queries

### Bakudan
- Exact query list unavailable.
- Average position 10.8 implies a cluster of terms likely ranking on page 2 boundary (positions 11–20).
- Candidate targets from repo keyword map:
  - `Ramen Near La Cantera` — assigned_page: null (gap — no dedicated page yet)
  - `Vegetarian Ramen in San Antonio` — exists but thin
  - `Happy Hour Ramen San Antonio` — exists but thin

### Raw Sushi
- Average position 9.4 means fewer terms should be in the 11–20 range compared to Bakudan.
- Likely push candidates are non-branded Modesto/Stockton sushi queries.

## 4. Top Pages Gaining Impressions

**Status: NOT AVAILABLE without GSC page-level exports.**

No page-level impression-change data was found in the workspace.

## 5. Top Pages Losing Clicks

**Status: NOT AVAILABLE without GSC page-level exports.**

No page-level click-change data was found in the workspace.

## 6. Brand vs Non-Brand Split

### Bakudan
- Top query `bakudan ramen` = 218 clicks out of 587 total = **37.1% brand share**
- Estimated non-brand share = 62.9%
- Conclusion: Majority of traffic is already non-brand, but conversion from non-brand queries to clicks is limited by avg position 10.8

### Raw Sushi
- Top query `raw sushi` = 88 clicks out of 361 total = **24.4% brand share**
- Estimated non-brand share = 75.6%
- Conclusion: Heavily non-brand dependent; CTR improvement on non-brand terms is the highest-leverage growth action

## Critical Findings

| Finding | Brand | Severity | Action |
|---|---|---|---|
| CTR 1.3% on 28K impressions | Raw Sushi | **CRITICAL** | Rewrite title/meta for top pages; add FAQ schema |
| Avg position 10.8 | Bakudan | **HIGH** | Improve on-page content; add FAQ schema; internal links |
| `Ramen Near La Cantera` has no page | Bakudan | **MEDIUM** | Create landing page |
| All landing pages return 404 | Bakudan | **CRITICAL** | SEO agent maps to `.html` URLs but live crawler tests non-`.html` URLs |
| Many Bakudan landing pages missing titles/meta | Bakudan | **HIGH** | SEO website-agent shows `[TODO]` for all titles |
| 169 technical issues pending audit | Bakudan | **MEDIUM** | Complete technical agent audit |

## Next Actions Required

1. **GSC API or CSV export needed** — To complete last-7-day and last-28-day query-level analysis, pull query data from GSC API or export CSV for both properties.
2. **Raw Sushi CTR Sprint** — Proceed with title/meta rewrite using known page inventory from `RawSushi/RawWebsite/`.
3. **Bakudan Page-One Push** — Proceed with on-page improvements using known page inventory from `Bakudan/bakudanramen.com-current/`.
4. **Fix 404 gap** — SEO agents map URLs without `.html` extension; production pages use `.html`. Reconcile.
5. **Complete pending technical audit** — 169 issues in pending status need resolution.

---

*This analysis is honest about missing data. No query-level numbers have been fabricated. Full opportunity lists will be populated once GSC API exports are available.*

