# Mi Attribution Model — Phase 34G
> Version 1.0 | 2026-06-25

## Model Overview

Mi uses a **multi-touch linear attribution model** connecting traffic sources to business outcomes.

```
Traffic Source (GSC/GA4/GBP)
        ↓
  Landing Page (GA4)
        ↓
  CTA Event (GA4 events)
        ↓
  Order / Call / Direction (Toast/GBP/DoorDash)
        ↓
  Revenue Proxy (CTA count × AOV estimate)
        ↓
  Revenue Actual (QB / Toast API)
```

---

## Attribution Fields

| Field | Source | Description |
|-------|--------|-------------|
| `first_touch` | GSC/GA4 | First channel that drove the session (organic, direct, referral) |
| `last_touch` | GA4 | Last channel before conversion event |
| `source_medium` | GA4 `session_source` / `session_medium` | e.g. `google / organic`, `(direct) / (none)` |
| `landing_page` | GA4 `landing_page` dimension | Which page user entered on |
| `brand` | brands.json | `bakudan` or `raw_sushi` |
| `store` | GBP location / phone number | Bandera, Stone Oak, The Rim (Bakudan); Modesto, Stockton (Raw Sushi) |
| `event` | GA4 custom event | `order_click`, `phone_click`, `directions_click`, `menu_click`, `reservation_click`, `location_view` |
| `revenue_proxy` | event count × store AOV | Estimated revenue from conversion signals |
| `actual_revenue` | QB / Toast | Ground-truth revenue for the period |
| `confidence_score` | computed | 0–100 based on data source availability |

---

## Confidence Scoring

```
Base score: 0

+20  GSC data available (traffic intent confirmed)
+20  GA4 sessions available (on-site behavior confirmed)
+15  GA4 conversion events live (CTA tracking active)
+15  GBP calls/directions available (local intent confirmed)
+15  Toast/DoorDash order data available (order count confirmed)
+15  QB revenue data available (P&L ground truth)
────
100  Full attribution confidence
```

### Current Score (2026-06-25)
- GSC: +20 ✅
- GA4 sessions: +10 (needs re-auth for full API access)
- GA4 events: 0 (events not yet instrumented)
- GBP: 0 (scope missing)
- Orders: 0 (Toast/DoorDash blocked)
- QB: 0 (sync not run)

**Current confidence: ~30/100**

---

## Attribution Tiers

### Tier 1: Traffic Attribution (Available Now)
- Which searches → which pages → which sessions
- Source: GSC + GA4
- Confidence: HIGH

### Tier 2: Engagement Attribution (Partial)
- Which sessions → which CTAs → which conversion intents
- Source: GA4 events (pending instrumentation + upload)
- Confidence: LOW until events live

### Tier 3: Local Intent Attribution (Blocked)
- Which searches → calls/directions per store
- Source: GBP (pending re-auth)
- Confidence: BLOCKED

### Tier 4: Order Attribution (Blocked)
- Which visits → actual orders
- Source: Toast API (pending developer key) + DoorDash (WAF)
- Confidence: BLOCKED

### Tier 5: Revenue Attribution (Partial)
- Which channel → actual revenue
- Source: QB (pending QBWC sync)
- Confidence: LOW

---

## Revenue Proxy Formula

When actual revenue is unavailable, Mi uses:

```
revenue_proxy = (order_clicks × bakudan_aov) + (phone_clicks × phone_conversion_rate × avg_ticket)

Where:
  bakudan_aov         = $18.50  (average order value estimate)
  phone_conversion_rate = 0.65  (65% of calls result in visit/order)
  avg_ticket          = $45.00  (average dine-in ticket)
```

Proxy is labeled as `ESTIMATE` — never shown as actual revenue.

---

## Store Mapping

### Bakudan Ramen
| Store | Phone | GBP Location ID | Toast URL |
|-------|-------|-----------------|-----------|
| Bandera | (210) 277-7740 | TBD (needs GBP auth) | bakudan-bandera |
| Stone Oak | (210) 437-0632 | TBD | bakudan-ramen-stone-oak |
| The Rim | (210) 257-8080 | TBD | bakudan-ramen-the-rim |

### Raw Sushi Bar
| Store | Phone | GBP Location ID |
|-------|-------|-----------------|
| Modesto | TBD | TBD (needs GBP auth) |
| Stockton | TBD | TBD |

---

## Data Freshness Policy

| Source | Update Frequency | Staleness Alert |
|--------|-----------------|-----------------|
| GSC | Daily (midnight) | > 2 days = stale |
| GA4 | Daily snapshot + live query | > 1 day = stale |
| GBP | Daily snapshot | > 1 day = stale |
| Toast | Real-time (API) | > 4 hours = stale |
| DoorDash | Every 24h (scrape) | > 26 hours = stale |
| QB | Per QBWC sync (manual) | > 48 hours = stale |
