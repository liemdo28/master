# CFO_DASHBOARD_DESIGN

Status: **FOUNDATION_DRAFT_COMPLETE**
Date: 2026-06-26

## Purpose

Design CFO dashboard widgets for Mi. Each widget is defined by data source, refresh frequency, current status, required API endpoint, dashboard placement, and owner.

## Widget Specifications

---

### Widget 1: Revenue Today

| Field | Value |
|---|---|
| data source | Revenue Engine (aggregation of Toast + DoorDash + QB daily sales) |
| refresh frequency | Daily, near real-time (hourly during business hours) |
| current status | NOT_AVAILABLE |
| API endpoint needed | `GET /api/v1/revenue/today` returning `{ date, total, by_store[], by_channel[], vs_yesterday_pct }` |
| dashboard placement | Top-left hero widget (most prominent) |
| owner | Finance / Data Engineering |
| display format | Large number: `$XX,XXX` with delta indicator vs yesterday |

---

### Widget 2: Revenue This Week

| Field | Value |
|---|---|
| data source | Revenue Engine (aggregation of daily revenues Mon-Sun) |
| refresh frequency | Daily (morning summary) |
| current status | NOT_AVAILABLE |
| API endpoint needed | `GET /api/v1/revenue/week?week_start=YYYY-MM-DD` returning `{ week_start, week_end, total, vs_prior_week_pct, daily_breakdown[] }` |
| dashboard placement | Top-left, below Revenue Today |
| owner | Finance / Data Engineering |
| display format | `$XXX,XXX` with trend arrow and week-over-week delta |

---

### Widget 3: Revenue by Store

| Field | Value |
|---|---|
| data source | Revenue Engine with store dimension |
| refresh frequency | Daily |
| current status | NOT_AVAILABLE |
| API endpoint needed | `GET /api/v1/revenue/by-store?period=day\|week\|month` returning `[{ store_id, store_name, revenue, vs_prior_pct, tier }]` |
| dashboard placement | Upper-middle row, horizontal bar chart with 4 store columns |
| owner | Finance / Operations |
| display format | Horizontal bar chart sorted by revenue; color-coded by tier (healthy/stable/watch/at-risk) |

---

### Widget 4: Profit Estimate

| Field | Value |
|---|---|
| data source | Profit Engine (Revenue - COGS - Labor - Overhead) |
| refresh frequency | Daily (estimated) / Monthly (actual) |
| current status | NOT_AVAILABLE |
| API endpoint needed | `GET /api/v1/profit/estimate?period=day\|week\|month` returning `{ revenue, cogs, labor, overhead, gross_profit, net_profit, margin_pct }` |
| dashboard placement | Top-right hero widget |
| owner | Finance |
| display format | Large number: `$XX,XXX` net profit with margin %; "ESTIMATED" badge until monthly close |

---

### Widget 5: Labor %

| Field | Value |
|---|---|
| data source | Payroll system + Revenue Engine |
| refresh frequency | Weekly |
| current status | NOT_AVAILABLE |
| API endpoint needed | `GET /api/v1/cost/labor-pct?period=day\|week\|month` returning `[{ store_id, labor_cost, revenue, labor_pct, vs_standard_pp }]` |
| dashboard placement | Middle-left widget |
| owner | Finance / Operations |
| display format | Percentage gauge per store; red when above standard |

---

### Widget 6: Food Cost %

| Field | Value |
|---|---|
| data source | QB vendor bills + inventory system + Revenue Engine |
| refresh frequency | Weekly |
| current status | NOT_AVAILABLE |
| API endpoint needed | `GET /api/v1/cost/food-cost-pct?period=week\|month` returning `[{ store_id, food_cost, revenue, food_cost_pct, vs_standard_pp }]` |
| dashboard placement | Middle-left widget, below Labor % |
| owner | Finance / Operations |
| display format | Percentage gauge per store; red when above standard |

---

### Widget 7: Payroll Trend

| Field | Value |
|---|---|
| data source | Payroll system |
| refresh frequency | Biweekly (per payroll cycle) |
| current status | NOT_AVAILABLE |
| API endpoint needed | `GET /api/v1/payroll/trend?cycles=N` returning `[{ pay_period_end, total_payroll, by_store[], vs_prior_periods[] }]` |
| dashboard placement | Middle-right widget |
| owner | Finance / HR |
| display format | Line chart showing payroll trend over last 6 cycles; annotations for overtime spikes |

---

### Widget 8: Store Ranking

| Field | Value |
|---|---|
| data source | Store Performance Engine (composite score) |
| refresh frequency | Weekly |
| current status | NOT_AVAILABLE |
| API endpoint needed | `GET /api/v1/store/ranking?week=YYYY-MM-DD` returning `[{ rank, store_id, store_name, score, tier, risk_flags[] }]` |
| dashboard placement | Center-right widget |
| owner | Finance / Operations |
| display format | Ranked list with score badges, tier labels, and risk flag indicators |

---

### Widget 9: Financial Risks

| Field | Value |
|---|---|
| data source | Store Performance Engine risk flags + staleness detector |
| refresh frequency | Daily |
| current status | NOT_AVAILABLE |
| API endpoint needed | `GET /api/v1/finance/risks` returning `[{ risk_id, severity, category, store, description, first_detected, days_open }]` |
| dashboard placement | Bottom-left, full-width alert panel |
| owner | Finance / Executive Coordination |
| display format | Alert cards sorted by severity; red = HIGH, yellow = MEDIUM; linked to task creation |

---

### Widget 10: Stale Data Alerts

| Field | Value |
|---|---|
| data source | Source freshness registry |
| refresh frequency | Hourly |
| current status | NOT_AVAILABLE |
| API endpoint needed | `GET /api/v1/data/stale` returning `[{ source, store, last_updated, expected_frequency, hours_overdue, status }]` |
| dashboard placement | Bottom-right, compact alert list |
| owner | Data Engineering |
| display format | Compact list; red = overdue by >1x expected frequency; yellow = approaching deadline |

---

## Dashboard Layout

```text
┌─────────────────────────┬─────────────────────────┐
│     REVENUE TODAY       │     PROFIT ESTIMATE     │
├─────────────────────────┤                         │
│     REVENUE THIS WEEK   ├─────────────────────────┤
├─────────────────────────┤     PAYROLL TREND       │
│     REVENUE BY STORE    │                         │
│     (bar chart)         ├─────────────────────────┤
│                         │     STORE RANKING       │
├─────────────────────────┴─────────────────────────┤
│     LABOR %          │       FOOD COST %          │
├──────────────────────┼────────────────────────────┤
│     FINANCIAL RISKS  │       STALE DATA ALERTS    │
└──────────────────────┴────────────────────────────┘
```

## Data Flow Summary

```text
POS Sources (Toast, DoorDash)
  + QuickBooks
  + Payroll System
  + GBP Reviews
  + Source Freshness Registry
        ↓
  Financial Data Warehouse (not yet built)
        ↓
  Revenue Engine / Profit Engine / Store Performance Engine
        ↓
  Dashboard API Endpoints (10 endpoints defined above)
        ↓
  CFO Dashboard Widgets
```

## Current Status Summary

| Widget | Status | Primary Blocker |
|---|---|---|
| Revenue Today | NOT_AVAILABLE | No warehouse, no POS connector |
| Revenue This Week | NOT_AVAILABLE | No warehouse, no POS connector |
| Revenue by Store | NOT_AVAILABLE | Store dimension mapping missing |
| Profit Estimate | NOT_AVAILABLE | No COGS/labor data; no warehouse |
| Labor % | NOT_AVAILABLE | Payroll system not connected |
| Food Cost % | NOT_AVAILABLE | COGS not mapped |
| Payroll Trend | NOT_AVAILABLE | Payroll system not connected |
| Store Ranking | NOT_AVAILABLE | Depends on all other widgets |
| Financial Risks | NOT_AVAILABLE | Depends on source freshness + KPI data |
| Stale Data Alerts | NOT_AVAILABLE | Source freshness registry not built |

## Implementation Priority

1. **Revenue Today** + **Revenue This Week** — highest value, most visible
2. **Revenue by Store** — needed for all store-level decisions
3. **Stale Data Alerts** — required for operational trust
4. **Financial Risks** — required for executive coordination
5. **Labor %** + **Food Cost %** — needed for cost management
6. **Profit Estimate** — requires COGS and labor to be connected
7. **Payroll Trend** — requires payroll system integration
8. **Store Ranking** — depends on all other inputs being live

## Conclusion

All 10 CFO dashboard widgets are designed and spec'd. Zero are live. The primary blocker is the absence of a financial data warehouse and source connectors. The dashboard can be built as soon as the warehouse and Revenue Engine are standing.
