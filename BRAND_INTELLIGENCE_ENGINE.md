# BRAND_INTELLIGENCE_ENGINE

> Generated: 2026-06-26 11:23 Asia/Saigon
> Phase: 4D — Brand Intelligence Design
> Target brands: Bakudan Ramen, Raw Sushi
> Target stores: Bakudan The Rim, Bakudan Bandera, Bakudan Stone Oak, Raw Sushi Stockton

---

## Brand Score Formula

```
BrandScore = (TrafficTrend × 0.20)
           + (EngagementTrend × 0.15)
           + (SearchVisibility × 0.20)
           + (GBPActions × 0.15)
           + (ReviewHealth × 0.10)
           + (CampaignPerformance × 0.10)
           + (ConversionEvents × 0.10)
           + (ContentOutput × 0.05)
           + (RevenueProxy × 0.05)
```

### Weight Rationale

| Component | Weight | Reason |
|-----------|--------|--------|
| TrafficTrend | 0.20 | Organic traffic is the foundation of digital growth |
| SearchVisibility | 0.20 | Rank position determines long-term traffic ceiling |
| EngagementTrend | 0.15 | Visitors who stay and click are more likely to convert |
| GBPActions | 0.15 | Local calls/directions = direct revenue intent |
| ReviewHealth | 0.10 | Reviews drive trust and local ranking |
| CampaignPerformance | 0.10 | Paid amplification compounds organic results |
| ConversionEvents | 0.10 | Actual revenue-generating actions |
| ContentOutput | 0.05 | Content pipeline feeds SEO and engagement |
| RevenueProxy | 0.05 | Revenue signals close the loop |

---

## Store Marketing Score

```
StoreScore = (TrafficShare × 0.25)
           + (GBPPerformance × 0.30)
           + (ReviewHealth × 0.25)
           + (ConversionRate × 0.20)
```

| Store | Traffic | GBP Actions | Reviews | Conversion | Estimated Score |
|-------|---------|-------------|---------|------------|-----------------|
| Bakudan The Rim | 38% of Bakudan clicks | Unknown | Unknown | Unknown | UNKNOWN |
| Bakudan Bandera | 33% of Bakudan clicks | Unknown | Unknown | Unknown | UNKNOWN |
| Bakudan Stone Oak | 29% of Bakudan clicks | Unknown | Unknown | Unknown | UNKNOWN |
| Raw Sushi Stockton | 100% of Raw Sushi clicks | Unknown | Unknown | Unknown | UNKNOWN |

All store scores are UNKNOWN pending GBP re-authorization and review data pull.

---

## Growth Signals

| Signal | Brand | Evidence | Impact |
|--------|-------|----------|--------|
| Raw Sushi 28,736 impressions at 1.3% CTR | Raw Sushi | GSC | HIGH — CTR improvement = instant traffic gain |
| Bakudan avg position 10.8 | Bakudan | GSC | HIGH — page-one push = ranking gain |
| 8 Bakudan landing pages live | Bakudan | File inventory | MEDIUM — pages exist, need ranking |
| 14+ Raw Sushi landing pages | Raw Sushi | File inventory | MEDIUM — targeting Stockton/Modesto |
| Brand query dominance: bakudan ramen = 218 clicks (37%) | Bakudan | GSC | LOW — brand is established |

---

## Risk Signals

| Risk | Brand | Severity | Evidence |
|------|-------|----------|----------|
| CTR at 1.3% (industry floor) | Raw Sushi | CRITICAL | GSC |
| Basic Auth blocks Googlebot | Bakudan | CRITICAL | .htaccess audit |
| No GA4 on any page | Both | HIGH | Source audit |
| No GBP data flowing | Both | HIGH | Connector audit |
| No review data flowing | Both | MEDIUM | review-automation dormant |
| DoorDash campaigns unmonitored | Both | HIGH | No credentials |

---

## Required Data Sources

| Source | Priority | Status | Unlocks |
|--------|----------|--------|---------|
| GSC aggregate | P0 | LIVE | Traffic baseline |
| GSC query/page export | P0 | MISSING | Keyword-level optimization |
| GA4 property + tracking | P0 | NOT_DEPLOYED | Sessions, conversions, engagement |
| GBP metrics | P1 | PARTIAL | Local intent signals |
| Review data | P1 | PARTIAL | Trust + reputation |
| DoorDash campaigns | P2 | BLOCKED | Paid channel performance |
| Toast POS | P2 | NOT_INTEGRATED | Order-level attribution |

---

## Missing Blockers

| Blocker | Impact | Owner | Unblock Time |
|---------|--------|-------|--------------|
| GA4 property not created | Zero session/conversion data | CEO | 15 min |
| GBP scope not authorized | No local intent data | CEO | 5 min re-auth |
| DoorDash credentials | No campaign data | CEO | 10 min |
| Toast POS access | No order attribution | CEO | 2h + 1-3 days |
| GSC query/page export | No keyword-level insight | SEO Lead | 30 min |

---

## Final Status

```text
BRAND_INTELLIGENCE_ENGINE_DESIGNED
```
