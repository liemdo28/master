# CEO Business Attribution Dashboard — Phase 34H
> Spec for /agenview Phase 34 widgets | 2026-06-25

## Dashboard Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  MI BUSINESS ATTRIBUTION                        Week of 2026-06-23  │
│  Attribution Confidence: 30/100 [PARTIAL]                           │
├──────────────┬──────────────┬──────────────┬───────────────────────┤
│ TRAFFIC→CTA  │ CALLS/STORE  │ DIRECTIONS   │ REVENUE BY STORE      │
│  (GA4)       │  (GBP)       │  (GBP)       │  (QB + Toast)         │
├──────────────┴──────────────┴──────────────┴───────────────────────┤
│  TOP LANDING PAGES BY REVENUE PROXY                                  │
├──────────────────────────────────────┬──────────────────────────────┤
│  CHANNEL → CONVERSION FLOW           │  GROWTH OPPORTUNITIES        │
├──────────────────────────────────────┴──────────────────────────────┤
│  DATA SOURCE STATUS                                                  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Widget Specs

### W1: Traffic → CTA
**API:** `GET /api/analytics/:brand/traffic` + `GET /api/analytics/conversions`
```json
{
  "widget": "traffic_cta",
  "brand": "bakudan",
  "sessions_7d": 1240,
  "order_clicks_7d": 87,
  "phone_clicks_7d": 34,
  "menu_clicks_7d": 203,
  "conversion_rate": "7.0%",
  "source": "GA4_LIVE | GA4_SNAPSHOTS | PENDING_AUTH"
}
```

### W2: Calls by Store
**API:** `GET /api/gbp/metrics`
```json
{
  "widget": "calls_by_store",
  "stores": [
    { "name": "Bandera", "calls_7d": 45, "vs_prev": "+8%" },
    { "name": "Stone Oak", "calls_7d": 38, "vs_prev": "-3%" },
    { "name": "The Rim", "calls_7d": 29, "vs_prev": "+12%" }
  ],
  "source": "GBP_LIVE | PENDING_AUTH"
}
```

### W3: Directions by Store
**API:** `GET /api/gbp/metrics`
```json
{
  "widget": "directions_by_store",
  "stores": [
    { "name": "Bandera", "directions_7d": 112 },
    { "name": "Stone Oak", "directions_7d": 89 }
  ],
  "source": "GBP_LIVE | PENDING_AUTH"
}
```

### W4: Revenue by Store
**API:** `GET /api/qb/financial/summary` + `GET /api/toast/revenue`
```json
{
  "widget": "revenue_by_store",
  "period": "last_30d",
  "stores": [
    { "name": "Bandera", "revenue": 48200, "source": "QB" },
    { "name": "Stone Oak", "revenue": 41500, "source": "QB" }
  ],
  "status": "QB_STALE | QB_LIVE"
}
```

### W5: Top Landing Pages by Revenue Proxy
**API:** `GET /api/analytics/pages` + event join
```json
{
  "widget": "top_pages_revenue_proxy",
  "pages": [
    { "page": "/order.html", "sessions": 312, "order_clicks": 87, "revenue_proxy": 1609 },
    { "page": "/best-ramen-san-antonio.html", "sessions": 198, "order_clicks": 12, "revenue_proxy": 222 }
  ]
}
```

### W6: Channel → Conversion Flow
**API:** `GET /api/analytics/channels`
```
organic_search → 640 sessions → 45 order_clicks → $832 proxy revenue
direct         → 280 sessions → 22 order_clicks → $407 proxy revenue
paid_search    → 120 sessions → 18 order_clicks → $333 proxy revenue
```

### W7: Growth Opportunities
Auto-generated from data deltas:
```
↓ Stone Oak calls -3% this week → Check GBP listing accuracy
↑ /order.html CTR up but DoorDash stale → Confirm delivery volume
↑ "ramen san antonio" impressions +18% → Expand content on this keyword
```

### W8: Attribution Confidence
```
Traffic Source:    ██████████ 100%  (GSC live)
On-site Behavior:  ██████░░░░  60%  (GA4 needs re-auth)
Conversion Events: ░░░░░░░░░░   0%  (events not yet live)
Local Intent:      ░░░░░░░░░░   0%  (GBP needs re-auth)
Order Data:        ██░░░░░░░░  20%  (DoorDash auth ok, data blocked)
Revenue Truth:     ███░░░░░░░  30%  (QB needs QBWC sync)

OVERALL:           30/100  PARTIAL
```

---

## API Endpoints Required

| Widget | Endpoint | Status |
|--------|----------|--------|
| W1 Traffic→CTA | `/api/analytics/:brand/traffic` | BUILT (needs re-auth) |
| W2 Calls | `/api/gbp/metrics` | BUILT (needs re-auth) |
| W3 Directions | `/api/gbp/metrics` | BUILT (needs re-auth) |
| W4 Revenue | `/api/qb/financial/summary` | BUILT (needs QB sync) |
| W5 Top Pages | `/api/analytics/pages` | BUILT (needs re-auth) |
| W6 Channels | `/api/analytics/channels` | BUILT (needs re-auth) |
| W7 Opportunities | computed | PENDING |
| W8 Confidence | `/api/attribution/confidence` | TO BUILD |

---

## Attribution Confidence API

Build `GET /api/attribution/confidence` that returns real-time confidence score:

```typescript
// Check each source and return score
{
  score: 30,
  tier: "PARTIAL",
  sources: {
    gsc: { available: true, points: 20 },
    ga4: { available: false, points: 0, blocker: "needs_reauth" },
    ga4_events: { available: false, points: 0, blocker: "not_instrumented" },
    gbp: { available: false, points: 0, blocker: "scope_missing" },
    orders: { available: false, points: 0, blocker: "toast_api_key_missing" },
    revenue: { available: false, points: 0, blocker: "qb_sync_pending" }
  },
  next_actions: [
    "Re-auth Google at /api/auth/google/start",
    "Trigger QBWC sync in QB Desktop",
    "Upload instrumented HTML to Dreamhost"
  ]
}
```
