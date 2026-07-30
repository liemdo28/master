# Executive Drill-Down Audit

## Summary
This document records each exec-summary metric, its previous state (dead end or not), what was built to fix it, and what the drill-down now shows.

---

## Metric 1: Total Cash Risk

| Field | Detail |
|-------|--------|
| Source | `$execSum['total_cash_risk']` |
| Previous state | Dead end — number displayed but not clickable |
| Fix | Wrapped tile in `<a href="/overview/drilldown/cash-risk">` |
| Drill-down shows | Per-store aggregation: store name, unpaid bill count, total amount, overdue amount, oldest due date |
| Route | GET /overview/drilldown/cash-risk |

---

## Metric 2: Overdue Bills

| Field | Detail |
|-------|--------|
| Source | `$execSum['overdue_bills']['count']` and `['amount']` |
| Previous state | Dead end — count and amount shown but not linkable |
| Fix | Wrapped tile in `<a href="/overview/drilldown/overdue-bills">` |
| Drill-down shows | Table of all overdue bills: name, vendor, store, amount, due date, overdue days, owner, status; [View Bill] per row |
| Route | GET /overview/drilldown/overdue-bills |

---

## Metric 3: Critical Tasks

| Field | Detail |
|-------|--------|
| Source | `$execSum['critical_tasks']` |
| Previous state | Dead end — count shown but not linkable |
| Fix | Wrapped tile in `<a href="/overview/drilldown/critical-tasks">` |
| Drill-down shows | Table of critical/overdue tasks: task title, store, assignee, reviewer, priority, due date, overdue days, status; [View Task] per row |
| Route | GET /overview/drilldown/critical-tasks |

---

## Metric 4: Compliance Risk

| Field | Detail |
|-------|--------|
| Source | `$execSum['compliance_risk']['count']` |
| Previous state | Dead end — count and level shown but not linkable |
| Fix | Wrapped tile in `<a href="/overview/drilldown/compliance-risk">` |
| Drill-down shows | Table of compliance obligations (tax, filing, permit, audit, etc.): item, category, store, owner, due date, status, overdue days; [View Obligation] per row |
| Route | GET /overview/drilldown/compliance-risk |

---

## Metric 5: Execution Risk

| Field | Detail |
|-------|--------|
| Source | `$execSum['execution_risk']['overloaded_count']` |
| Previous state | Dead end — overloaded count shown but not linkable |
| Fix | Wrapped tile in `<a href="/overview/drilldown/execution-risk">` |
| Drill-down shows | Two sections: (1) Overloaded users (>5 open tasks) with open/overdue counts; (2) Tasks stuck in review >3 days |
| Route | GET /overview/drilldown/execution-risk |

---

## Metric 6: Finance Risk Buckets (Critical/High/Medium/Low)

| Field | Detail |
|-------|--------|
| Source | `$ccFinance['risk_buckets']` |
| Previous state | Partial — had JS drawer `ccOpenBillDrawer()` that showed an inline list but no full-page drill-down |
| Fix | Replaced `onclick` divs with `<a href="/overview/drilldown/finance-bills?risk={level}">` links |
| Drill-down shows | Filtered bill list by due-date risk bucket; risk param maps to SQL date range |
| Routes | GET /overview/drilldown/finance-bills?risk=critical|high|medium|low |

---

## Metric 7: Unified Risk (new)

| Field | Detail |
|-------|--------|
| Source | Computed from bills + tasks |
| Previous state | No unified view existed |
| Fix | New endpoint `/overview/drilldown/unified-risk` |
| Drill-down shows | Top 20 highest-risk items mixing bills and tasks, sorted by risk_score |
| Route | GET /overview/drilldown/unified-risk |

---

## Metric 8: Execution Health (new)

| Field | Detail |
|-------|--------|
| Source | tasks table, computed by due date proximity |
| Previous state | Only donut chart on overview, no drill-down |
| Fix | New endpoint `/overview/drilldown/execution-health` |
| Drill-down shows | Three tabbed sections: On Track, At Risk (due in 1-3 days), Critical (overdue) |
| Route | GET /overview/drilldown/execution-health |
