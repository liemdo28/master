# MARKETING_OPEN_SOURCE_EVALUATION

> Generated: 2026-06-26 11:26 Asia/Saigon
> Phase: 4H — Open Source Marketing Stack Evaluation
> Note: evaluation only — NO installation, NO deployment

---

## PostHog

| Field | Value |
|-------|-------|
| Purpose | Product / event analytics, feature flags, session recording |
| Fit for Mi | HIGH — direct replacement for GA4 + session replay |
| Fit for Restaurant Business | HIGH — restaurant apps + web ordering |
| Setup Complexity | MEDIUM (Docker + events SDK) |
| Maintenance Cost | LOW-MEDIUM (depends on event volume) |
| Risk | Vendor feature scope creep, self-host required for full control |
| Recommended | ✅ RECOMMENDED as GA4 fallback / complement |

## Matomo

| Field | Value |
|-------|-------|
| Purpose | Privacy-focused web analytics |
| Fit for Mi | MEDIUM — GDPR-friendly alternative to GA4 |
| Fit for Restaurant Business | HIGH — simple traffic analysis |
| Setup Complexity | LOW (LAMP/LAMP-stack) |
| Maintenance Cost | LOW |
| Risk | Less powerful than GA4 for funnels |
| Recommended | ⚠️ CONDITIONAL — only if GA4 unavailable |

## Plausible

| Field | Value |
|-------|-------|
| Purpose | Lightweight privacy-first analytics |
| Fit for Mi | LOW — limited to aggregate web analytics |
| Fit for Restaurant Business | MEDIUM |
| Setup Complexity | LOW (single binary) |
| Maintenance Cost | LOW |
| Risk | Too simple for full attribution |
| Recommended | ❌ REJECTED — too limited for Marketing Intelligence scope |

## Mautic

| Field | Value |
|-------|-------|
| Purpose | Open-source marketing automation (email, journeys, segments) |
| Fit for Mi | HIGH — fills the email automation gap |
| Fit for Restaurant Business | HIGH — campaign management, drip campaigns |
| Setup Complexity | MEDIUM (PHP + DB + cron workers) |
| Maintenance Cost | MEDIUM (cron + deliverability monitoring) |
| Risk | Deliverability setup required (SPF/DKIM/DMARC) |
| Recommended | ✅ RECOMMENDED for email automation |

## Snowplow

| Field | Value |
|-------|-------|
| Purpose | Enterprise-grade event analytics pipeline |
| Fit for Mi | MEDIUM — powerful but heavy |
| Fit for Restaurant Business | MEDIUM |
| Setup Complexity | HIGH (Kafka + multiple services) |
| Maintenance Cost | HIGH |
| Risk | Over-engineering for restaurant scale |
| Recommended | ❌ REJECTED — too heavy for current scale |

## RudderStack

| Field | Value |
|-------|-------|
| Purpose | Customer Data Platform (CDP) |
| Fit for Mi | MEDIUM — useful if integrating many sources |
| Fit for Restaurant Business | MEDIUM |
| Setup Complexity | HIGH |
| Maintenance Cost | MEDIUM-HIGH |
| Risk | Cloud-first; self-host is limited |
| Recommended | ⚠️ CONDITIONAL — consider when source count > 5 |

## Airbyte

| Field | Value |
|-------|-------|
| Purpose | Open-source data integration / ELT platform |
| Fit for Mi | HIGH — could pull GSC, GA4, GBP, DoorDash into warehouse |
| Fit for Restaurant Business | HIGH |
| Setup Complexity | MEDIUM (Docker + many connectors) |
| Maintenance Cost | MEDIUM |
| Risk | Connector maintenance overhead |
| Recommended | ✅ RECOMMENDED for marketing data warehouse (later phase) |

## Metabase

| Field | Value |
|-------|-------|
| Purpose | Open-source BI / dashboarding |
| Fit for Mi | HIGH — CEO Marketing Dashboard could be built on Metabase |
| Fit for Restaurant Business | HIGH — self-service analytics |
| Setup Complexity | LOW (Docker or JAR) |
| Maintenance Cost | LOW |
| Risk | Less customizable than custom React dashboards |
| Recommended | ✅ RECOMMENDED for CEO dashboarding |

## Apache Superset

| Field | Value |
|-------|-------|
| Purpose | Enterprise BI platform |
| Fit for Mi | HIGH — more powerful than Metabase |
| Fit for Restaurant Business | HIGH |
| Setup Complexity | HIGH (Python + DB + frontend) |
| Maintenance Cost | MEDIUM-HIGH |
| Risk | Steeper learning curve |
| Recommended | ⚠️ CONDITIONAL — Metabase first, Superset if needed |

## Unleash

| Field | Value |
|-------|-------|
| Purpose | Feature flag service |
| Fit for Mi | LOW — engineering tool, not marketing |
| Fit for Restaurant Business | LOW |
| Setup Complexity | MEDIUM |
| Maintenance Cost | LOW-MEDIUM |
| Risk | Not directly relevant to marketing |
| Recommended | ❌ REJECTED for this phase |

## Plane / OpenProject

| Field | Value |
|-------|-------|
| Purpose | Project management |
| Fit for Mi | MEDIUM — could replace some Asana use cases |
| Fit for Restaurant Business | MEDIUM |
| Setup Complexity | MEDIUM |
| Maintenance Cost | MEDIUM |
| Risk | Asana integration already in place |
| Recommended | ⚠️ CONDITIONAL — only if Asana becomes a blocker |

## Social Media Schedulers

### Buffer (open-source alternative: Buffer alternatives)

| Field | Value |
|-------|-------|
| Open-Source Projects | `buffer alternative` search: Kagu, Publer (closed) |
| Fit | LOW-MEDIUM — direct FB/IG API works via Mi connectors |
| Recommended | ❌ REJECTED — Mi's own social-posting.ts covers this |

---

## Recommended Stack (Phased)

### Phase 1 (Quick Wins, 0-30 days)
- **Metabase** — CEO Marketing Dashboard
- **Mautic** — Email automation
- Existing: GSC + review-automation + social-posting

### Phase 2 (Data Layer, 30-60 days)
- **Airbyte** — Marketing data warehouse ingestion
- **PostHog** — Session replay + funnels (supplement GA4)
- **Matomo** — Optional GA4 alternative

### Phase 3 (Enterprise Scale, 60+ days)
- **Apache Superset** — If Metabase becomes limiting
- **RudderStack** — If source count exceeds 5

---

## Final Status

```text
MARKETING_OPEN_SOURCE_EVALUATION_COMPLETE
```
