# CEO SEO Dashboard — GSC Live Proof

**Phase:** 26F — CEO SEO Dashboard Update  
**Generated:** 2026-06-24 17:45 Asia/Saigon  
**Status:** GSC_LIVE_PROOF_PARTIAL

## Live GSC Widgets — Current Baseline

### Bakudan

| Widget | Value | Evidence Status |
|---|---:|---|
| Clicks | 587 | Confirmed by CTO directive |
| Impressions | 11,174 | Confirmed by CTO directive |
| CTR | 5.3% | Confirmed by CTO directive |
| Avg position | 10.8 | Confirmed by CTO directive |
| Top query | `bakudan ramen` | Confirmed by CTO directive |
| Top query clicks | 218 | Confirmed by CTO directive |
| Top query position | 1.5 | Confirmed by CTO directive |
| Top pages | Not available | Page-level GSC export not found |
| Sitemap status | 0 errors / 0 warnings | Confirmed by CTO directive |
| Last sync | 2026-06-24 source update | CTO-provided live data |

### Raw Sushi

| Widget | Value | Evidence Status |
|---|---:|---|
| Clicks | 361 | Confirmed by CTO directive |
| Impressions | 28,736 | Confirmed by CTO directive |
| CTR | 1.3% | Confirmed by CTO directive |
| Avg position | 9.4 | Confirmed by CTO directive |
| Top query | `raw sushi` | Confirmed by CTO directive |
| Top query clicks | 88 | Confirmed by CTO directive |
| Top query position | 3.2 | Confirmed by CTO directive |
| Top pages | Not available | Page-level GSC export not found |
| Sitemap status | 0 errors / 0 warnings | Confirmed by CTO directive |
| Last sync | 2026-06-24 source update | CTO-provided live data |

## Dashboard Widget Requirements

For each brand, CEO dashboard should display:

1. Clicks
2. Impressions
3. CTR
4. Average position
5. Top queries
6. Top pages
7. Sitemap status
8. Last sync timestamp

## Implementation Readiness

| Widget | Bakudan | Raw Sushi | Notes |
|---|---|---|---|
| Clicks | READY | READY | Aggregate values available |
| Impressions | READY | READY | Aggregate values available |
| CTR | READY | READY | Aggregate values available |
| Avg position | READY | READY | Aggregate values available |
| Top queries | PARTIAL | PARTIAL | Only top query available per brand |
| Top pages | BLOCKED | BLOCKED | Needs GSC page export/API |
| Sitemap status | READY | READY | 0 errors / 0 warnings |
| Last sync | READY | READY | Use GSC ingestion timestamp |

## Dashboard Copy for CEO

- **Bakudan:** GSC is active. The brand has 587 clicks from 11,174 impressions with 5.3% CTR and avg position 10.8. Brand query `bakudan ramen` ranks strongly at 1.5.
- **Raw Sushi:** GSC is active. The brand has 361 clicks from 28,736 impressions with 1.3% CTR and avg position 9.4. CTR improvement is the fastest traffic opportunity.

## Missing Data Needed for Full Live Dashboard

1. Query-level GSC rows for last 7 and 28 days.
2. Page-level GSC rows for last 7 and 28 days.
3. Automated dashboard sync workflow (`seo-dashboard-sync`) — currently not found in n8n inventory.

## Final Status

**GSC_LIVE_PROOF_PARTIAL**

Dashboard can show verified live aggregate GSC metrics now. Query tables and page tables require GSC export/API ingestion before full widget completion.
