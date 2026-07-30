# MARKETING_QUESTION_ENGINE

> Generated: 2026-06-26 11:25 Asia/Saigon
> Phase: 4G — Marketing Question Engine

---

## Required CMO Questions

### Q1. Which brand is growing fastest?

| Field | Value |
|-------|-------|
| Required Data | GSC weekly clicks per brand (Bakudan vs Raw Sushi) |
| Available Today | ✅ YES — GSC aggregate live |
| Confidence | HIGH (for organic traffic only) |
| Blocked By | GA4 not deployed (no full funnel view) |
| Answer Format | "Bakudan is growing at +X% / Raw Sushi at +Y% over the last 30 days" |
| Next Action | Add GA4 to measure true conversion growth, not just traffic |

### Q2. Which store is losing traffic?

| Field | Value |
|-------|-------|
| Required Data | Per-location GSC clicks + GBP visits |
| Available Today | ⚠️ PARTIAL — GSC aggregate available, GBP not authorized |
| Confidence | MEDIUM |
| Blocked By | GBP re-auth needed for per-location visibility |
| Answer Format | "Bakudan Stone Oak traffic is down -X% week-over-week; GBP calls down -Y%" |
| Next Action | Re-auth GBP, then enable per-location query filters |

### Q3. Which page brings the most customers?

| Field | Value |
|-------|-------|
| Required Data | GSC page-level clicks + GA4 conversion events |
| Available Today | ⚠️ PARTIAL — GSC top pages blocker; GA4 not deployed |
| Confidence | LOW |
| Blocked By | GSC page-level export + GA4 conversion events |
| Answer Format | "ramen-near-la-cantera.html brings 23 conversions/month from 450 clicks" |
| Next Action | Deploy GA4 + extract GSC page-level data |

### Q4. Which content should we create next?

| Field | Value |
|-------|-------|
| Required Data | GSC keyword opportunities + competitor content gaps |
| Available Today | ⚠️ PARTIAL — GSC aggregate only |
| Confidence | MEDIUM (for SEO content) |
| Blocked By | GSC query-level export + competitor scraper |
| Answer Format | "Create 'best ramen near UTSA 2026' — 1,200 impressions, 0.8% CTR, no Bakudan page ranks" |
| Next Action | Build `seo-content-opportunity-scan` n8n workflow |

### Q5. Which campaign worked?

| Field | Value |
|-------|-------|
| Required Data | DoorDash campaign performance + Toast attribution |
| Available Today | ❌ NO — DoorDash blocked, Toast not integrated |
| Confidence | ZERO |
| Blocked By | DoorDash credentials + Toast POS API |
| Answer Format | "CAM-2026-06-15-sushi-promo delivered 3.2x ROAS, $4,200 attributed revenue" |
| Next Action | Provision DoorDash + Toast credentials |

### Q6. Which channel is underperforming?

| Field | Value |
|-------|-------|
| Required Data | Channel-level GA4 sessions + conversion rates |
| Available Today | ❌ NO — GA4 not deployed |
| Confidence | ZERO |
| Blocked By | GA4 + UTM tracking |
| Answer Format | "Direct channel: 1,200 sessions, 0.5% conversion. Email: 800 sessions, 4% conversion." |
| Next Action | Deploy GA4 + implement UTM conventions |

### Q7. Are reviews helping or hurting traffic?

| Field | Value |
|-------|-------|
| Required Data | Avg rating trend vs GSC clicks correlation |
| Available Today | ⚠️ PARTIAL — review-automation code exists, not live-verified |
| Confidence | LOW |
| Blocked By | Live review pull + rating data not connected to traffic data |
| Answer Format | "Bakudan Bandera avg rating 4.6 (+0.2 YoY) correlates with +18% GSC clicks" |
| Next Action | Activate review-automation cron + connect rating data to dashboard |

### Q8. What should marketing do this week?

| Field | Value |
|-------|-------|
| Required Data | All marketing signals + task pipeline + approval queue |
| Available Today | ✅ YES (Partial) — Executive Coordination has pipeline, marketing signals incomplete |
| Confidence | MEDIUM |
| Blocked By | GA4 + GBP + DoorDash data feeds |
| Answer Format | Top 3 actions: (1) Fix Raw Sushi CTR (2) Deploy GA4 (3) Re-auth GBP |
| Next Action | Implement data availability check before generating weekly plan |

### Q9. Which location needs GBP optimization?

| Field | Value |
|-------|-------|
| Required Data | GBP metrics per location (views, calls, directions) |
| Available Today | ⚠️ PARTIAL — connector built, scope missing |
| Confidence | MEDIUM |
| Blocked By | GBP re-authorization with business.manage scope |
| Answer Format | "Bakudan Stone Oak: 320 views/week, 12 calls — below avg of 25 calls. Need GBP post boost." |
| Next Action | CEO re-authorizes GBP scope |

### Q10. Did SEO changes create business value?

| Field | Value |
|-------|-------|
| Required Data | GSC clicks before/after + GA4 conversions + POS revenue lift |
| Available Today | ⚠️ PARTIAL — GSC yes, GA4/Toast no |
| Confidence | MEDIUM (organic traffic correlation) |
| Blocked By | GA4 + Toast POS attribution |
| Answer Format | "Raw Sushi CTR sprint (June 2026): GSC clicks +38%, est. +$1,200/mo revenue (modeled)" |
| Next Action | Deploy GA4 + Toast for closed-loop attribution |

---

## Question Coverage Matrix

| Question | GSC | GA4 | GBP | Reviews | DoorDash | Toast |
|----------|-----|-----|-----|---------|----------|-------|
| Q1 Brand growth | ✅ | ❌ | n/a | n/a | n/a | n/a |
| Q2 Store traffic loss | ⚠️ | ❌ | ❌ | n/a | n/a | n/a |
| Q3 Top page customers | ⚠️ | ❌ | n/a | n/a | n/a | n/a |
| Q4 Next content | ⚠️ | n/a | n/a | n/a | n/a | n/a |
| Q5 Campaign worked | n/a | ❌ | n/a | n/a | ❌ | ❌ |
| Q6 Channel underperform | n/a | ❌ | n/a | n/a | ❌ | n/a |
| Q7 Reviews impact | ⚠️ | ❌ | n/a | ❌ | n/a | n/a |
| Q8 Weekly action | ✅ | ❌ | ⚠️ | ⚠️ | ❌ | ❌ |
| Q9 GBP optimization | n/a | n/a | ❌ | n/a | n/a | n/a |
| Q10 SEO → revenue | ⚠️ | ❌ | n/a | n/a | n/a | ❌ |

Legend: ✅ = data available, ⚠️ = partial, ❌ = blocked, n/a = not needed

---

## Final Status

```text
MARKETING_QUESTION_ENGINE_DESIGNED
```
