# STORE_PERFORMANCE_ENGINE

Status: **FOUNDATION_DRAFT_COMPLETE**
Date: 2026-06-26

## Purpose

Design how Mi scores and ranks stores financially. This engine will determine which stores are thriving, which are declining, and which need immediate attention.

## Target Stores

| Store | Status |
|---|---|
| Bakudan The Rim | Target |
| Bakudan Bandera | Target |
| Bakudan Stone Oak | Target |
| Raw Sushi | Target |

---

## Store Score Dimensions

Each store receives a composite score based on weighted dimensions:

| Dimension | Weight | Description |
|---|---|---|
| Revenue Trend | 25% | Is revenue growing or declining vs previous period |
| Profit Trend | 20% | Is profit growing or declining vs previous period |
| Labor % | 15% | Is labor cost within acceptable range |
| Food Cost % | 15% | Is food cost within acceptable range |
| Review Health | 10% | Online review sentiment and volume |
| Traffic | 5% | Foot traffic or order volume trend |
| Order Volume | 5% | Total orders trend |
| Operational Risk | 5% | Compliance, staffing, supply issues |

---

## Store Score Formula

```text
Store Score = (Revenue_Trend_Score * 0.25)
            + (Profit_Trend_Score * 0.20)
            + (Labor_Score * 0.15)
            + (Food_Cost_Score * 0.15)
            + (Review_Score * 0.10)
            + (Traffic_Score * 0.05)
            + (Order_Volume_Score * 0.05)
            + (Operational_Risk_Score * 0.05)
```

Each sub-score is normalized to 0-100:
- 100 = excellent performance
- 50 = neutral / at standard
- 0 = critical problem

---

## Sub-Score Definitions

### Revenue Trend Score (25%)

| Input | Score |
|---|---|
| weekly revenue change % vs prior 4-week average | |
| +10% or more | 90-100 |
| +5% to +10% | 75-89 |
| -5% to +5% | 50-74 (neutral) |
| -10% to -5% | 30-49 |
| -10% or worse | 0-29 |

### Profit Trend Score (20%)

| Input | Score |
|---|---|
| weekly net profit change % vs prior 4-week average | |
| +15% or more | 90-100 |
| +5% to +15% | 75-89 |
| -5% to +5% | 50-74 |
| -15% to -5% | 30-49 |
| -15% or worse | 0-29 |

### Labor Score (15%)

| Input | Score |
|---|---|
| labor % of revenue vs store standard | |
| at or below standard | 80-100 |
| up to +2% above | 60-79 |
| +2% to +5% above | 40-59 |
| +5% to +10% above | 20-39 |
| more than +10% above | 0-19 |

### Food Cost Score (15%)

| Input | Score |
|---|---|
| food cost % of revenue vs store standard | |
| at or below standard | 80-100 |
| up to +1% above | 70-79 |
| +1% to +3% above | 50-69 |
| +3% to +5% above | 30-49 |
| more than +5% above | 0-29 |

### Review Score (10%)

| Input | Score |
|---|---|
| Google review rating + review velocity | |
| 4.5+ stars, high volume | 90-100 |
| 4.0-4.5 stars, steady volume | 70-89 |
| 3.5-4.0 stars | 50-69 |
| 3.0-3.5 stars | 30-49 |
| below 3.0 stars | 0-29 |

### Traffic Score (5%)

| Input | Score |
|---|---|
| traffic/order volume trend vs prior 4 weeks | |
| +15% or more | 90-100 |
| +5% to +15% | 75-89 |
| -5% to +5% | 50-74 |
| -15% to -5% | 25-49 |
| -15% or worse | 0-24 |

### Order Volume Score (5%)

| Input | Score |
|---|---|
| total order count trend vs prior 4 weeks | |
| +10% or more | 90-100 |
| +3% to +10% | 75-89 |
| -3% to +3% | 50-74 |
| -10% to -3% | 25-49 |
| -10% or worse | 0-24 |

### Operational Risk Score (5%)

| Input | Score |
|---|---|
| risk flags from compliance, staffing, supply | |
| No flags | 90-100 |
| Minor staffing gaps | 70-89 |
| Supply delays or compliance notes | 50-69 |
| Understaffed or supply shortage | 30-49 |
| Critical (closures, violations) | 0-29 |

---

## Final Score Bands

| Score Range | Tier | Action |
|---|---|---|
| 80-100 | **Healthy** | Maintain; acknowledge in weekly report |
| 60-79 | **Stable** | Monitor closely; note in weekly report |
| 40-59 | **Watch** | Alert owner; create FIN task |
| 20-39 | **At Risk** | Escalate; create FIN task + notify CFO |
| 0-19 | **Critical** | Immediate action; create FIN urgent task + executive alert |

---

## Ranking Logic

1. Calculate composite score for all 4 stores on the same weekly date range.
2. Rank stores by composite score descending.
3. Publish: top store, bottom store, biggest mover (positive or negative), biggest risk.
4. If any store is in "At Risk" or "Critical" tier, generate a risk flag automatically.

---

## Risk Flags

These flags are raised automatically when conditions are met:

| Flag | Condition | Severity |
|---|---|---|
| Revenue Drop | Weekly revenue down >10% vs prior 4-week avg | HIGH |
| Profit Drop | Weekly profit down >15% vs prior 4-week avg | HIGH |
| Labor Overage | Labor % exceeds store standard by >5pp | HIGH |
| Food Cost Spike | Food cost % exceeds store standard by >5pp | HIGH |
| Review Decline | Rating dropped >0.5 stars in 30 days | MEDIUM |
| Order Volume Drop | Orders down >15% vs prior 4-week avg | MEDIUM |
| Data Stale | No sales data received for store in >48 hours | HIGH |
| Missing Source | POS data for store has not been updated today | HIGH |

---

## Required Data Sources

| Data | Source System | Status Today | Blocker |
|---|---|---|---|
| Daily revenue by store | Toast / DoorDash / QB | NOT_AVAILABLE | No POS connector |
| Labor cost by store | Payroll system | NOT_AVAILABLE | No payroll connector |
| Food cost by store | QB / vendor invoices | NOT_AVAILABLE | No COGS mapping |
| Net profit by store | QB / warehouse | NOT_AVAILABLE | No warehouse |
| Google review rating | Google Business Profile API | NOT_AVAILABLE | No GBP connector |
| Order count by store | Toast / DoorDash | NOT_AVAILABLE | No POS connector |
| Operational risk flags | HR / operations / compliance | NOT_AVAILABLE | No ops connector |

---

## Missing Blockers

All 8 data inputs are currently blocked. The store performance engine cannot be calculated until:
1. Daily revenue is connected from at least one POS system (Toast preferred for in-store).
2. DoorDash is mapped as a separate revenue channel, not mixed into store totals.
3. Payroll system is identified and read-only access is established.
4. QB chart of accounts is mapped to store-level profit.
5. Review data is connected via GBP API.
6. An operational risk input system is defined (likely a shared ops checklist).

---

## Conclusion

The store performance engine design is complete. It can be implemented once the 8 required data sources are connected. The weighting and threshold model is deliberately restaurant-industry aware, with labor and food cost carrying the most operational weight after revenue and profit trends.
