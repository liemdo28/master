# Dashboard Metric Source Map

| Metric | Source Table(s) | SQL Filter | Drill-Down Route | Action Route |
|--------|----------------|------------|-----------------|--------------|
| Total Cash Risk | bills, stores | `status NOT IN ('paid','cancelled')` | GET /overview/drilldown/cash-risk | GET /bills/store/{id} |
| Overdue Bills (count) | bills, vendors, stores, users | `status NOT IN ('paid','cancelled') AND due_date < NOW()` | GET /overview/drilldown/overdue-bills | GET /bills/{id} |
| Critical Tasks (count) | tasks, stores, users | `status NOT IN ('completed','cancelled') AND (priority='critical' OR due_date < NOW())` | GET /overview/drilldown/critical-tasks | GET /tasks/{id} |
| Compliance Risk (count) | obligations, stores, users | `category IN ('tax','compliance','filing','permit','audit') AND status IN ('pending','overdue')` | GET /overview/drilldown/compliance-risk | GET /obligations/{id} |
| Execution Risk (overloaded_count) | tasks, users | `status NOT IN ('completed','cancelled') GROUP BY assignee HAVING count > 5` | GET /overview/drilldown/execution-risk | GET /overview/member/{id} |
| Finance Risk Bucket — Critical | bills | `due_date < DATE_SUB(NOW(), INTERVAL 30 DAY)` | GET /overview/drilldown/finance-bills?risk=critical | GET /bills/{id} |
| Finance Risk Bucket — High | bills | `due_date BETWEEN DATE_SUB(NOW(), 30d) AND DATE_SUB(NOW(), 15d)` | GET /overview/drilldown/finance-bills?risk=high | GET /bills/{id} |
| Finance Risk Bucket — Medium | bills | `due_date BETWEEN DATE_SUB(NOW(), 15d) AND NOW()` | GET /overview/drilldown/finance-bills?risk=medium | GET /bills/{id} |
| Finance Risk Bucket — Low | bills | `due_date BETWEEN NOW() AND DATE_ADD(NOW(), 30d)` | GET /overview/drilldown/finance-bills?risk=low | GET /bills/{id} |
| Unified Risk Score | bills + tasks (merged) | Top 20 by computed risk_score | GET /overview/drilldown/unified-risk | GET /bills/{id} or /tasks/{id} |
| Execution Health — On Track | tasks, stores, users | `due_date > DATE_ADD(NOW(), INTERVAL 3 DAY)` | GET /overview/drilldown/execution-health | GET /tasks/{id} |
| Execution Health — At Risk | tasks, stores, users | `due_date BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 3 DAY)` | GET /overview/drilldown/execution-health | GET /tasks/{id} |
| Execution Health — Critical | tasks, stores, users | `due_date < NOW()` | GET /overview/drilldown/execution-health | GET /tasks/{id} |
| Store Risk Map | operations.stores | operations data from DashboardController | GET /overview/store/{id} | GET /overview/store/{id} |
| Team Load | operations.team | operations data from DashboardController | GET /overview/member/{id} | GET /my-tasks?user={id} |
