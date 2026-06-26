# REVENUE_QUESTION_ENGINE

Status: **FOUNDATION_DRAFT_COMPLETE**
Date: 2026-06-26

## Purpose

Design how Mi answers CFO-grade financial questions. For each question, document required data, availability, confidence, blockers, answer format, and next action.

---

## Question 1: Revenue hôm nay bao nhiêu?

| Field | Value |
|---|---|
| required data | Today's total revenue across all stores, from all channels |
| available today? | NO |
| confidence | NONE |
| blocked by | No warehouse, no POS connector, no QB read path |
| answer format | `$XX,XXX` with store breakdown: `Bakudan The Rim: $X,XXX | Bakudan Bandera: $X,XXX | Bakudan Stone Oak: $X,XXX | Raw Sushi: $X,XXX` |
| next action | Connect Toast daily sales export; define daily close time |

## Question 2: Revenue tuần này tăng hay giảm?

| Field | Value |
|---|---|
| required data | This week's total revenue vs last week's total revenue |
| available today? | NO |
| confidence | NONE |
| blocked by | No warehouse, no daily revenue aggregation |
| answer format | `Tuần này: $XX,XXX — Tăng/X% so với tuần trước ($XX,XXX)` |
| next action | Build weekly aggregation after daily revenue is live |

## Question 3: Store nào lời nhất?

| Field | Value |
|---|---|
| required data | Net profit by store for current period |
| available today? | NO |
| confidence | NONE |
| blocked by | No warehouse, no profit calculation, no store-level COGS/labor allocation |
| answer format | `Lời nhất: Bakudan The Rim — Net Profit: $X,XXX (Margin: X.X%)` |
| next action | Build after profit engine and store-level cost allocation are live |

## Question 4: Store nào đang giảm doanh thu?

| Field | Value |
|---|---|
| required data | Revenue by store, week-over-week change, flagged declines |
| available today? | NO |
| confidence | NONE |
| blocked by | No warehouse, no revenue by store, no trend calculation |
| answer format | `Giảm doanh thu: Bakudan Bandera (-X.X% vs tuần trước). Xu hướng 4 tuần: [trend data]` |
| next action | Build after revenue by store is live |

## Question 5: Labor cost có vượt chuẩn không?

| Field | Value |
|---|---|
| required data | Labor cost as % of revenue by store vs target standard |
| available today? | NO |
| confidence | NONE |
| blocked by | Payroll system not connected; no labor standard defined |
| answer format | `Bakudan The Rim: Labor 32.1% — Vượt chuẩn 2.1pp. Bakudan Bandera: Labor 28.5% — Đạt chuẩn` |
| next action | Connect payroll; define standard labor % per store |

## Question 6: Food cost có vượt chuẩn không?

| Field | Value |
|---|---|
| required data | Food cost as % of revenue by store vs target standard |
| available today? | NO |
| confidence | NONE |
| blocked by | No COGS mapping, no food cost categorization |
| answer format | `Bakudan Stone Oak: Food Cost 35.2% — Vượt chuẩn 3.2pp. Cần xem vendor bills và usage` |
| next action | Map food vendor bills in QB; define standard food cost % |

## Question 7: Profit giảm vì sao?

| Field | Value |
|---|---|
| required data | Revenue trend + COGS trend + labor trend + overhead changes, decomposed |
| available today? | NO |
| confidence | NONE |
| blocked by | No profit engine, no cost decomposition, no warehouse |
| answer format | `Profit tuần này giảm $X,XXX (-X.X%). Nguyên nhân: Labor tăng $X,XXX (+Xpp), Food cost tăng $X,XXX (+Xpp), Revenue giảm $X,XXX (-X.X%)` |
| next action | Build profit bridge / decomposition engine after warehouse exists |

## Question 8: Payroll có bất thường không?

| Field | Value |
|---|---|
| required data | Payroll total vs prior periods, overtime spikes, headcount changes |
| available today? | NO |
| confidence | NONE |
| blocked by | Payroll system not connected |
| answer format | `Payroll tuần này: $XX,XXX (+X.X% so với trung bình 6 tuần). Overtime: Xhrs (+X% spike) tại Bakudan Bandera` |
| next action | Connect payroll; define anomaly thresholds |

## Question 9: Cashflow có rủi ro không?

| Field | Value |
|---|---|
| required data | Cash in, cash out, upcoming bills, AP aging |
| available today? | NO |
| confidence | NONE |
| blocked by | No bank data access, no QB bill schedule, no AP report |
| answer format | `Cashflow: Cash in $XX,XXX / Cash out $XX,XXX / Net: $X,XXX. Bills tới hạn trong 7 ngày: $XX,XXX. Risk level: LOW/MEDIUM/HIGH` |
| next action | Connect QB cash reports; define cashflow alert thresholds |

## Question 10: Tuần này cần chú ý tài chính gì?

| Field | Value |
|---|---|
| required data | All of the above + financial risk flags + stale data alerts |
| available today? | NO |
| confidence | NONE |
| blocked by | All upstream systems |
| answer format | `Tuần này: 1) Bakudan Bandera labor vượt chuẩn — cần review schedule. 2) Raw Sushi revenue giảm 3 tuần liên tiếp. 3) Food cost Stone Oak tăng — cần review vendor pricing. 4) Data Toast chưa cập nhật 48h` |
| next action | Build executive weekly summary after core KPIs are live |

---

## Answer Capability Matrix

| # | Question | Data Ready? | Confidence | Can Answer Today? |
|---|---|---|---|---|
| 1 | Revenue hôm nay bao nhiêu? | NO | NONE | NO |
| 2 | Revenue tuần này tăng hay giảm? | NO | NONE | NO |
| 3 | Store nào lời nhất? | NO | NONE | NO |
| 4 | Store nào đang giảm doanh thu? | NO | NONE | NO |
| 5 | Labor cost có vượt chuẩn không? | NO | NONE | NO |
| 6 | Food cost có vượt chuẩn không? | NO | NONE | NO |
| 7 | Profit giảm vì sao? | NO | NONE | NO |
| 8 | Payroll có bất thường không? | NO | NONE | NO |
| 9 | Cashflow có rủi ro không? | NO | NONE | NO |
| 10 | Tuần này cần chú ý tài chính gì? | NO | NONE | NO |

## Answer Order Priority

When data becomes available, answer questions in this order:

1. **Revenue hôm nay** — simplest, highest demand
2. **Revenue tuần** — depends on daily revenue accumulation
3. **Store nào lời nhất** — depends on profit engine
4. **Store nào giảm doanh thu** — depends on revenue by store + trend
5. **Labor vượt chuẩn** — depends on payroll + revenue
6. **Food cost vượt chuẩn** — depends on COGS + revenue
7. **Payroll bất thường** — depends on payroll + anomaly detection
8. **Profit giảm vì sao** — depends on profit decomposition (most complex)
9. **Cashflow rủi ro** — depends on cash/bill data
10. **Tuần này chú ý gì** — executive summary, depends on all above

## Conclusion

Mi can define all 10 CFO questions today, but cannot answer any of them with data. The question engine design is ready. Implementation requires the full data pipeline: warehouse → engines → API endpoints → question router → natural language formatter.
