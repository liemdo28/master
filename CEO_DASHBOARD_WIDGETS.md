# CEO_DASHBOARD_WIDGETS.md

> Phase 30.1 — CEO Dashboard Widgets
> Generated: 2026-06-24 20:59 Asia/Saigon
> Mission: 5 widgets — Traffic, Orders, Revenue, Profit, Risks

---

## Widget Architecture

Each widget is a self-contained data card on the CEO dashboard. Each shows:
- **Title** (what it is)
- **Value** (the number)
- **Trend** (vs last week / last month)
- **Source** (where the data comes from)
- **Confidence** (HIGH / MEDIUM / LOW / ZERO)
- **Action** (what to do if bad)

---

## Widget 1: Traffic

### What It Shows
Total organic clicks + sessions to Bakudan + Raw Sushi websites.

### Current State (BLOCKED)
- **GSC:** 948 clicks/month total (HIGH confidence)
- **GA4:** ZERO (no tracking code on any page)
- **Combined Traffic:** 948 clicks, 39,910 impressions

### What CEO Sees
```
┌─────────────────────────────────────┐
│  🚦 TRAFFIC                          │
│  ─────────                           │
│  948 clicks / 39,910 impressions     │
│  Bakudan: 587 / 11,174 (CTR 5.3%)    │
│  Raw Sushi: 361 / 28,736 (CTR 1.3%)  │
│  ─────────                           │
│  Trend: BASELINE (need 30 days)      │
│  Source: GSC live                    │
│  Confidence: HIGH for clicks         │
│  ZERO for sessions (no GA4)          │
│  ─────────                           │
│  Action: Setup GA4 (30 min)          │
└─────────────────────────────────────┘
```

### After Unblock
- Sessions per page
- Mobile vs desktop split
- Bounce rate
- Top pages by traffic

### Code (Pseudo)
```javascript
const trafficWidget = {
  title: "Traffic",
  gsc: await getGSCAggregate(),
  ga4: await getGA4Sessions(), // blocked today
  displayTrend: computeTrend(this.week, last.week),
  alert: bounceRate > 0.6 ? "Bounce rate high" : null
};
```

---

## Widget 2: Orders

### What It Shows
Total orders across all 3 Bakudan locations (dine-in, pickup, delivery).

### Current State (BLOCKED)
- **Toast POS:** LIVE with real orders, but no API access
- **Status:** ZERO — cannot pull order data
- **Estimated:** 3,000–5,000 orders/month (industry median for 3 stores)

### What CEO Sees
```
┌─────────────────────────────────────┐
│  📦 ORDERS                          │
│  ─────────                           │
│  Estimated: ~3,500–4,500 / month     │
│  Actual: BLOCKED (no Toast API)     │
│  ─────────                           │
│  Trend: UNKNOWN                      │
│  Source: Toast POS (live, no API)    │
│  Confidence: ZERO                    │
│  ─────────                           │
│  Action: Apply for Toast             │
│  developer account (1 hr)            │
└─────────────────────────────────────┘
```

### After Unblock
- Orders per location per day
- AOV per location
- Order source attribution (GBP call / Toast direct / DoorDash / etc.)
- Hourly order distribution
- Menu item performance

---

## Widget 3: Revenue

### What It Shows
Total revenue in $ across all 3 locations.

### Current State (BLOCKED)
- **Estimated:** ~$60,000/month (industry median × 3 locations)
- **Toast:** Real revenue exists but cannot pull
- **QuickBooks:** Manual monthly export only
- **Confidence:** LOW (estimate, not measurement)

### What CEO Sees
```
┌─────────────────────────────────────┐
│  💰 REVENUE                         │
│  ─────────                           │
│  Estimated: ~$60,000 / month         │
│  Last week: UNKNOWN                  │
│  ─────────                           │
│  Trend: UNKNOWN                      │
│  Source: Toast (live) + QB (manual)  │
│  Confidence: LOW (estimated)         │
│  ─────────                           │
│  Action: Toast API + QB API          │
│  = 2-4 hours CEO/IT work             │
└─────────────────────────────────────┘
```

### After Unblock
- Daily revenue per location
- Week-over-week comparison
- Channel breakdown (direct, delivery, catering)
- Revenue forecast (vs last 4 weeks trend)

---

## Widget 4: Profit

### What It Shows
Revenue minus labor minus food cost minus overhead = profit.

### Current State (BLOCKED)
- **Revenue:** Estimated ($60K)
- **Labor cost:** Unknown (no QB API)
- **Food cost:** Unknown (no QB API)
- **Profit:** CANNOT BE COMPUTED

### What CEO Sees
```
┌─────────────────────────────────────┐
│  📊 PROFIT                          │
│  ─────────                           │
│  Revenue: ~$60,000                  │
│  Labor: UNKNOWN                      │
│  Food Cost: UNKNOWN                  │
│  Overhead: UNKNOWN                   │
│  ─────────                           │
│  NET PROFIT: UNKNOWN                 │
│  ─────────                           │
│  Status: CANNOT COMPUTE              │
│  Confidence: ZERO                    │
│  ─────────                           │
│  Action: QuickBooks API              │
│  = 4 hours build + 1 day QBO upgrade │
└─────────────────────────────────────┘
```

### After Unblock
- Weekly profit per location
- Profit margin trend
- Labor cost % of revenue (target: 25-30%)
- Food cost % of revenue (target: 28-32%)
- Cost trend alerts

---

## Widget 5: Risks

### What It Shows
Live risk signals across all 5 integrations. Triggers on threshold breach.

### Current State (PARTIAL)

| Risk | Trigger | Source | Status |
|------|---------|--------|--------|
| Raw Sushi CTR below 1.5% | CTR threshold | GSC | DETECTABLE |
| Bakudan position drifts to 11+ | Position threshold | GSC | DETECTABLE |
| GBP call drop > 20% | Calls drop | GBP | NOT DETECTABLE (no API) |
| DoorDash ROAS < 2.0x | ROAS threshold | DoorDash | NOT DETECTABLE (no creds) |
| Toast order drop > 15% | Order drop | Toast | NOT DETECTABLE (no API) |
| Labor cost > 35% revenue | Cost % threshold | QB | NOT DETECTABLE (no API) |
| Food cost > 35% revenue | Cost % threshold | QB | NOT DETECTABLE (no API) |

### What CEO Sees
```
┌─────────────────────────────────────┐
│  ⚠️  RISKS                          │
│  ─────────                           │
│  🔴 Raw Sushi CTR at 1.3%           │
│     (industry floor)                 │
│  ─────────                           │
│  🟡 5 of 7 risk signals              │
│     NOT DETECTABLE                   │
│     (need 5 integrations)            │
│  ─────────                           │
│  Active: 1 (CTR)                     │
│  Pending detection: 5                │
│  Confidence: MIXED                   │
│  ─────────                           │
│  Action: Unblock 5 integrations      │
│  = 4 hours CEO/IT work               │
└─────────────────────────────────────┘
```

---

## Widget Layout (CEO Dashboard)

```
┌─────────────────────────────────────────────────────────────┐
│  CEO REVENUE OBSERVABILITY DASHBOARD                        │
│  Last updated: 2026-06-24 20:59                            │
│  ─────────────────────────────────────────────────────      │
│                                                              │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐            │
│  │  Traffic   │  │  Orders    │  │  Revenue   │            │
│  │  948 imp   │  │  UNKNOWN   │  │  ~$60K/mo  │            │
│  │  HIGH*     │  │  ZERO      │  │  LOW       │            │
│  └────────────┘  └────────────┘  └────────────┘            │
│                                                              │
│  ┌────────────┐  ┌────────────────────────────────────┐    │
│  │  Profit    │  │  Risks                              │    │
│  │  UNKNOWN   │  │  🔴 Raw Sushi CTR 1.3%              │    │
│  │  ZERO      │  │  🟡 5 signals not detectable        │    │
│  └────────────┘  └────────────────────────────────────┘    │
│                                                              │
│  ─────────────────────────────────────────────────────      │
│  Coverage: 3/11 KPIs HIGH (27%)                            │
│  After unblock: 11/11 KPIs HIGH (100%)                     │
│  CEO/IT action needed: 4 hours                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Path

### Phase 1 (Once Integrations Active)
- Build each widget as a Node.js service
- Connect to data source APIs
- Render in CEO dashboard at `dashboard.bakudanramen.com`
- Add refresh schedules

### Phase 2 (Within 1 Week)
- Add trend lines (vs last week / last month)
- Add alerts on threshold breach
- Add channel attribution views

### Phase 3 (Within 1 Month)
- Add forecast (based on trend)
- Add "What changed" detection (week-over-week anomaly)
- Add "Why is revenue down?" auto-diagnostic

---

## Acceptance Criteria

Each widget must:
1. Pull from a real data source (not estimated)
2. Show trend (vs last week / last month)
3. Show source confidence (HIGH/MEDIUM/LOW/ZERO)
4. Show recommended action if confidence is LOW/ZERO
5. Refresh at the right frequency (real-time, daily, weekly)

**Today: 1 of 5 widgets partially meets criteria (Traffic).**
**After unblock: 5 of 5 widgets meet criteria.**
