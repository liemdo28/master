# FINANCIAL_KPI_REGISTRY

Status: **FOUNDATION_DRAFT_COMPLETE**
Date: 2026-06-26

## Purpose

Define CFO-grade KPIs that Mi must eventually calculate. Each KPI is assessed against current data availability, blockers, and confidence level. This registry is the authoritative list for financial reporting and dashboard build.

## Availability Legend

| Level | Meaning |
|---|---|
| NOT_AVAILABLE | No source or calculation exists yet |
| CANDIDATE | Source is known but not yet connected |
| CALCULABLE | Data exists and formula could be computed today |
| LIVE | Already computed and verified |

## Confidence Legend

| Level | Meaning |
|---|---|
| NONE | No data at all |
| LOW | Highly incomplete or unverified source |
| MEDIUM | Partial source available, gaps remain |
| HIGH | Source is reliable and sufficient for the metric |

---

## Revenue KPIs

### Daily Revenue

| Field | Value |
|---|---|
| name | Daily Revenue |
| description | Total revenue across all stores for a single calendar day |
| source | QuickBooks sales receipts + POS reports (Toast/DoorDash) |
| formula | SUM(sales_receipts.amount) + SUM(pos_daily_sales.total) for date = D |
| frequency | Daily |
| owner | Finance / Data Engineering |
| current availability | NOT_AVAILABLE |
| confidence | NONE |
| blocker | No warehouse, no connected POS source, no QB read path |
| next action | Map POS and QB read-only export paths; define daily close trigger |

### Weekly Revenue

| Field | Value |
|---|---|
| name | Weekly Revenue |
| description | Total revenue across all stores for a calendar week (Mon-Sun) |
| source | Aggregation of Daily Revenue |
| formula | SUM(daily_revenue) for week range |
| frequency | Weekly |
| owner | Finance / Data Engineering |
| current availability | NOT_AVAILABLE |
| confidence | NONE |
| blocker | Blocked by Daily Revenue |
| next action | Build after Daily Revenue is live |

### Monthly Revenue

| Field | Value |
|---|---|
| name | Monthly Revenue |
| description | Total revenue across all stores for a calendar month |
| source | Aggregation of Daily Revenue |
| formula | SUM(daily_revenue) for month range |
| frequency | Monthly |
| owner | Finance / Data Engineering |
| current availability | NOT_AVAILABLE |
| confidence | NONE |
| blocker | Blocked by Daily Revenue |
| next action | Build after Daily Revenue is live |

### Revenue by Store

| Field | Value |
|---|---|
| name | Revenue by Store |
| description | Revenue attributed to each individual store |
| source | POS reports tagged by store + QB class/location mapping |
| formula | SUM(sales where store_id = S for period P) |
| frequency | Daily |
| owner | Finance / Data Engineering |
| current availability | NOT_AVAILABLE |
| confidence | NONE |
| blocker | Store dimension mapping not yet connected; POS export not proven |
| next action | Map each store to its POS identifier and QB class/location |

### Revenue by Channel

| Field | Value |
|---|---|
| name | Revenue by Channel |
| description | Revenue broken down by channel (dine-in, takeout, delivery, catering) |
| source | POS reports with channel tags |
| formula | SUM(sales where channel = C for period P) |
| frequency | Daily |
| owner | Finance / Data Engineering |
| current availability | NOT_AVAILABLE |
| confidence | LOW |
| blocker | Channel tagging in POS export may be partial |
| next action | Verify Toast/DoorDash channel classification and merge logic |

### Revenue Trend

| Field | Value |
|---|---|
| name | Revenue Trend |
| description | Period-over-period revenue change (day-over-day, week-over-week, month-over-month) |
| source | Aggregation of Daily Revenue |
| formula | (revenue_current - revenue_previous) / revenue_previous * 100 |
| frequency | Daily |
| owner | Finance / Data Engineering |
| current availability | NOT_AVAILABLE |
| confidence | NONE |
| blocker | Blocked by Daily Revenue |
| next action | Build after Daily Revenue is live |

---

## Profit KPIs

### Gross Profit

| Field | Value |
|---|---|
| name | Gross Profit |
| description | Revenue minus cost of goods sold (food cost + direct costs) |
| source | Revenue Engine + COGS from QB/inventory |
| formula | revenue - COGS |
| frequency | Daily |
| owner | Finance |
| current availability | NOT_AVAILABLE |
| confidence | NONE |
| blocker | COGS source not mapped |
| next action | Identify COGS data source and define food cost categorization |

### Net Profit

| Field | Value |
|---|---|
| name | Net Profit |
| description | Gross profit minus all operating expenses (labor, rent, utilities, marketing, etc.) |
| source | Revenue Engine + QB expense accounts |
| formula | gross_profit - total_operating_expenses |
| frequency | Monthly |
| owner | Finance |
| current availability | NOT_AVAILABLE |
| confidence | NONE |
| blocker | Expense accounts not mapped; warehouse not built |
| next action | Map QB expense accounts to operating categories |

### Profit by Store

| Field | Value |
|---|---|
| name | Profit by Store |
| description | Net profit attributed to each individual store |
| source | Revenue by Store - allocated expenses per store |
| formula | revenue_store - allocated_cogs_store - allocated_labor_store - allocated_overhead_store |
| frequency | Monthly |
| owner | Finance |
| current availability | NOT_AVAILABLE |
| confidence | NONE |
| blocker | Store-level cost allocation scheme not defined |
| next action | Define allocation method for shared costs across stores |

### Profit Margin

| Field | Value |
|---|---|
| name | Profit Margin |
| description | Net profit as percentage of revenue |
| source | Net Profit / Revenue |
| formula | (net_profit / revenue) * 100 |
| frequency | Monthly |
| owner | Finance |
| current availability | NOT_AVAILABLE |
| confidence | NONE |
| blocker | Blocked by Net Profit |
| next action | Build after Net Profit is live |

---

## Cost KPIs

### Food Cost

| Field | Value |
|---|---|
| name | Food Cost |
| description | Total cost of food ingredients and supplies used in a period |
| source | Vendor invoices, QB bills, inventory system |
| formula | SUM(vendor_bills for food category) + beginning_inventory - ending_inventory |
| frequency | Weekly |
| owner | Operations / Finance |
| current availability | NOT_AVAILABLE |
| confidence | NONE |
| blocker | Food cost categorization and inventory tracking not connected |
| next action | Identify food vendors and map bill categories in QB |

### COGS

| Field | Value |
|---|---|
| name | Cost of Goods Sold |
| description | Direct costs attributable to production of goods/services sold |
| source | QB expense accounts tagged as COGS |
| formula | SUM(QB_cogs_accounts) |
| frequency | Monthly |
| owner | Finance |
| current availability | NOT_AVAILABLE |
| confidence | LOW |
| blocker | QB COGS accounts not enumerated |
| next action | Export QB chart of accounts and tag COGS categories |

### Labor Cost

| Field | Value |
|---|---|
| name | Labor Cost |
| description | Total payroll cost including wages, taxes, benefits for all employees |
| source | Payroll system + labor tracking |
| formula | SUM(payroll_records.gross_pay + payroll_records.employer_taxes + payroll_records.benefits) |
| frequency | Biweekly / Monthly |
| owner | HR / Finance |
| current availability | NOT_AVAILABLE |
| confidence | NONE |
| blocker | Payroll system not identified; no data export path |
| next action | Identify payroll provider and authorize read-only data access |

### Labor %

| Field | Value |
|---|---|
| name | Labor Percentage |
| description | Labor cost as percentage of revenue |
| source | Labor Cost / Revenue |
| formula | (labor_cost / revenue) * 100 |
| frequency | Weekly |
| owner | Finance / Operations |
| current availability | NOT_AVAILABLE |
| confidence | NONE |
| blocker | Blocked by Labor Cost and Revenue |
| next action | Set labor % standard/target per store after sources are live |

### Overtime

| Field | Value |
|---|---|
| name | Overtime Hours and Cost |
| description | Hours worked beyond standard schedule and associated overtime pay |
| source | Payroll system |
| formula | SUM(overtime_hours * overtime_rate) |
| frequency | Weekly |
| owner | HR / Operations |
| current availability | NOT_AVAILABLE |
| confidence | NONE |
| blocker | Payroll system not connected |
| next action | Map overtime threshold rules and connect to payroll export |

### Payroll Cost

| Field | Value |
|---|---|
| name | Payroll Cost |
| description | Total payroll disbursement including employer-side taxes and benefits |
| source | Payroll system |
| formula | SUM(pay_period_total) |
| frequency | Biweekly / Monthly |
| owner | Finance / HR |
| current availability | NOT_AVAILABLE |
| confidence | NONE |
| blocker | Payroll system not connected |
| next action | Identify payroll export format and schedule |

---

## Operations KPIs

### Average Order Value

| Field | Value |
|---|---|
| name | Average Order Value (AOV) |
| description | Average revenue per order |
| source | POS reports |
| formula | total_revenue / total_orders |
| frequency | Daily |
| owner | Operations |
| current availability | NOT_AVAILABLE |
| confidence | LOW |
| blocker | Order count not connected; revenue per store partial |
| next action | Verify whether Toast/DoorDash exports include order count |

### Sales per Labor Hour

| Field | Value |
|---|---|
| name | Sales per Labor Hour |
| description | Revenue generated per hour of labor |
| source | Revenue / Labor Hours |
| formula | revenue / total_labor_hours |
| frequency | Daily |
| owner | Operations |
| current availability | NOT_AVAILABLE |
| confidence | NONE |
| blocker | Labor hours source not connected |
| next action | Connect labor hours and define productivity standard |

### Orders per Store

| Field | Value |
|---|---|
| name | Orders per Store |
| description | Total order count attributed to each store |
| source | POS reports |
| formula | COUNT(orders where store = S for period P) |
| frequency | Daily |
| owner | Operations |
| current availability | NOT_AVAILABLE |
| confidence | LOW |
| blocker | Store-level order count not connected |
| next action | Map store IDs in POS export |

### Revenue per Store

| Field | Value |
|---|---|
| name | Revenue per Store |
| description | Daily/weekly/monthly revenue per store location |
| source | Revenue by Store |
| formula | SUM(sales where store = S for period P) |
| frequency | Daily |
| owner | Finance / Operations |
| current availability | NOT_AVAILABLE |
| confidence | NONE |
| blocker | Same as Revenue by Store |
| next action | Build after Revenue by Store is live |

---

## Cashflow KPIs

### Cash In

| Field | Value |
|---|---|
| name | Cash In |
| description | Total cash received from sales, payments, and other receipts |
| source | QB bank deposits, POS payouts |
| formula | SUM(deposits + received_payments) |
| frequency | Daily |
| owner | Finance |
| current availability | NOT_AVAILABLE |
| confidence | LOW |
| blocker | Bank data not accessible; QB read path not established |
| next action | Define read-only bank deposit data source |

### Cash Out

| Field | Value |
|---|---|
| name | Cash Out |
| description | Total cash disbursed for expenses, payroll, bills, and purchases |
| source | QB bills, payroll disbursements, vendor payments |
| formula | SUM(bills_paid + payroll_disbursements + vendor_payments) |
| frequency | Daily |
| owner | Finance |
| current availability | NOT_AVAILABLE |
| confidence | LOW |
| blocker | Bills and payments not mapped in read-only access |
| next action | Map QB bill and payment accounts |

### Accounts Receivable

| Field | Value |
|---|---|
| name | Accounts Receivable (AR) |
| description | Money owed to the business by customers or delivery platforms |
| source | QB AR aging report |
| formula | SUM(invoices unpaid within aging buckets) |
| frequency | Weekly |
| owner | Finance |
| current availability | NOT_AVAILABLE |
| confidence | LOW |
| blocker | AR report not connected; may not apply if mostly cash/POS business |
| next action | Determine if AR is material for the business model |

### Accounts Payable

| Field | Value |
|---|---|
| name | Accounts Payable (AP) |
| description | Money the business owes to vendors and suppliers |
| source | QB AP aging report |
| formula | SUM(bills_unpaid within aging buckets) |
| frequency | Weekly |
| owner | Finance |
| current availability | NOT_AVAILABLE |
| confidence | LOW |
| blocker | AP report not connected |
| next action | Connect QB AP aging and define payment priority rules |

### Upcoming Bills

| Field | Value |
|---|---|
| name | Upcoming Bills |
| description | Bills due in the next 7/14/30 days |
| source | QB bill schedule |
| formula | FILTER(bills where due_date <= current_date + N) |
| frequency | Weekly |
| owner | Finance |
| current availability | NOT_AVAILABLE |
| confidence | LOW |
| blocker | Bill schedule not connected |
| next action | Connect QB bills and define payment calendar |

---

## Summary

| KPI Group | Total KPIs | NOT_AVAILABLE | CANDIDATE | CALCULABLE | LIVE |
|---|---|---|---|---|---|
| Revenue | 6 | 6 | 0 | 0 | 0 |
| Profit | 4 | 4 | 0 | 0 | 0 |
| Cost | 7 | 7 | 0 | 0 | 0 |
| Operations | 4 | 4 | 0 | 0 | 0 |
| Cashflow | 5 | 5 | 0 | 0 | 0 |
| **Total** | **26** | **26** | **0** | **0** | **0** |

## Conclusion

Zero KPIs are currently calculable or live. All 26 defined CFO-grade KPIs are blocked by missing source systems, missing warehouse tables, or missing read-only data contracts. The registry is complete and ready to guide build priorities once data sources are connected.
