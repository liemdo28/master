# OVERALL_STORE_DATA_AUDIT.md — Data Source Verification

## KPI Sources (Real Data)

### Task KPIs
| Metric | Source Query |
|--------|-------------|
| Open tasks | `SELECT COUNT(*) FROM tasks t JOIN projects p ON t.project_id=p.id WHERE p.store_id=:id AND t.is_completed=0` |
| Completed tasks | `SELECT COUNT(*) ... WHERE t.is_completed=1` |
| Overdue tasks | `SELECT COUNT(*) ... WHERE t.is_completed=0 AND t.due_date < CURDATE()` |
| Due today | `SELECT COUNT(*) ... WHERE t.is_completed=0 AND t.due_date = CURDATE()` |
| Upcoming tasks | `SELECT COUNT(*) ... WHERE t.is_completed=0 AND t.due_date > CURDATE() AND t.due_date <= DATE_ADD(CURDATE(), INTERVAL 14 DAY)` |

### Bill KPIs
| Metric | Source Query |
|--------|-------------|
| Open bills | `SELECT COUNT(*) FROM bills WHERE store_id=:id AND status IN ('pending','overdue')` |
| Overdue bills | `SELECT COUNT(*) ... WHERE status='overdue' OR (due_date < CURDATE() AND status='pending')` |
| Unpaid bills | `SELECT COUNT(*) ... WHERE status='pending'` |
| Next due bill | `SELECT MIN(due_date) ... WHERE status='pending' AND due_date >= CURDATE()` |

### Penalty KPIs
- Active penalty count: Uses `penalty_logs` table if it exists, filtered by store

### Compliance KPIs
- Open compliance issues: Checked via `compliance_items` table if it exists

## Health Color Calculation
```
if (overdueTasks > 0 || overdueBills > 0 || criticalTasks > 0) → RED
elseif (dueTodayTasks > 0 || billsDueSoon > 0) → YELLOW
elseif (tasks == 0 && bills == 0 && projects == 0) → GRAY
else → GREEN
```

## Drilldown Requirements
All KPI numbers are clickable and load filtered data via AJAX:
- Open tasks → drawer tasks tab filtered to open
- Completed tasks → drawer completed tab
- Overdue tasks → drawer tasks tab filtered to overdue
- Open bills → drawer bills tab
- Overdue bills → drawer bills tab filtered to overdue
- Unpaid bills → drawer bills tab filtered to unpaid

No dead-end KPIs. All numbers resolve to detail data.
