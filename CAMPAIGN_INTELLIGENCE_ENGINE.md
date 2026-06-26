# CAMPAIGN_INTELLIGENCE_ENGINE

> Generated: 2026-06-26 11:24 Asia/Saigon
> Phase: 4E — Campaign Intelligence Design

---

## Campaign Types

| Type | Channel | Budget Source | Approval Required |
|------|---------|---------------|-------------------|
| SEO Campaign | GSC/Organic | Time only | YES (content publish) |
| GBP Campaign | Google Business Profile | Time only | YES (GBP post publish) |
| DoorDash Campaign | DoorDash Ads | Dollar spend | YES (financial) |
| Social Campaign | Facebook/Instagram | Dollar or time | YES (public content) |
| Email Campaign | Email platform | Dollar or time | YES (reputation risk) |
| Promotion Campaign | In-store/online | Dollar | YES (financial) |
| Content Campaign | Blog/Landing Page | Time | YES (SEO + publish) |
| Review Campaign | GBP/Yelp | Time | YES (public response) |

---

## Campaign Lifecycle

```
Idea → Brief → Approval → Execute → Track → Report → Archive
 │        │         │          │         │        │         │
 │        │         │          │         │        │         └─ Store campaign evidence
 │        │         │          │         │        └─ Weekly/monthly performance report
 │        │         │          │         └─ Daily KPI tracking (UTM-based)
 │        │         │          └─ Deploy ads / publish content / send email
 │        │         └─ CEO approval via WhatsApp or Executive Coordination
 │        └─ Brief with goal, audience, budget, KPI, UTM, owner
 └─ Detect opportunity from data (GSC, GA4, reviews, competitor)
```

---

## Required Campaign Fields

| Field | Type | Description |
|-------|------|-------------|
| campaign_id | string | AUTO: CAM-{type}-{YYYYMMDD}-{seq} |
| brand | string | bakudan / raw_sushi / both |
| store | string | specific store or "all" |
| channel | enum | seo / gbp / doordash / social / email / promo / content / review |
| goal | string | description of expected outcome |
| start_date | date | campaign start |
| end_date | date | campaign end |
| budget | number | dollar amount (0 = organic/time-only) |
| owner | string | responsible person or department |
| status | enum | planned / approved / active / paused / completed / archived |
| utm_source | string | UTM source tag |
| utm_medium | string | UTM medium tag |
| utm_campaign | string | UTM campaign tag |
| target_kpi | string | primary KPI to measure |
| actual_kpi | number | actual KPI value |
| evidence | string[] | links to proof, screenshots, reports |
| approval_id | string | Executive Coordination approval ID |

---

## UTM Rules

```
utm_source = brand name (bakudan / raw_sushi)
utm_medium = channel type (organic / gbp / social / email / cpc)
utm_campaign = campaign slug (YYYYMMDD-brief-description)
```

Examples:
- `utm_source=bakudan&utm_medium=organic&utm_campaign=20260701-ramen-near-la-cantera`
- `utm_source=raw_sushi&utm_medium=cpc&utm_campaign=20260701-doordash-sushi-promo`

---

## KPI Mapping

| Campaign Type | Primary KPI | Secondary KPI | Attribution Method |
|---------------|-------------|---------------|-------------------|
| SEO | GSC clicks + position | GA4 sessions from organic | GSC + GA4 |
| GBP | GBP calls + directions | GBP website clicks | GBP Insights |
| DoorDash | ROAS | DoorDash orders | DoorDash Ads Manager |
| Social | Reach + engagement | Clicks to site | UTM + GA4 |
| Email | Open rate + CTR | Conversions | Email platform + GA4 |
| Promo | Revenue lift | Order count | POS comparison |
| Content | Page traffic + engagement | Conversions | GSC + GA4 |
| Review | Avg rating change | Review count | GBP/Yelp |

---

## Report Format

### Weekly Campaign Digest

```
Week of {date}
Active Campaigns: {count}
Total Spend: ${amount}
Total Revenue Attributed: ${amount}
Blended ROAS: {ratio}

By Campaign:
- {name} | {channel} | {status} | Spend: ${x} | Revenue: ${y} | ROAS: {z}

Top Performer: {campaign}
Underperformer: {campaign}
Action Required: {list}
```

---

## Coordination Integration

Every campaign must:
1. Have an Executive Coordination task (Objective → ENG/MKT task)
2. Have approval_id before execution
3. Store evidence in `.mi-harness/evidence/`
4. Be reported in the CEO Marketing Dashboard

---

## Final Status

```text
CAMPAIGN_INTELLIGENCE_ENGINE_DESIGNED
```
