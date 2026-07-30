# DRAWER PENALTY CERTIFICATION

**Date:** 2026-06-15  
**Status:** PASS  
**Reviewed by:** Cline (automated audit)

---

## Data Loading Path

Penalty drawer opens **task detail** via link `/tasks/{id}` on the penalty row's task column.

**Route:** `GET /tasks/{id}` → `TaskController::show($id)` (same as Workstream 1)

The penalty list page (`views/admin/penalties/index.php`) queries penalties from the `penalties` table:

```sql
SELECT p.*, u.name AS user_name, s.name AS store_name, 
       pr.name AS project_name, t.title AS task_title
FROM penalties p
LEFT JOIN users u ON u.id = p.user_id
LEFT JOIN stores s ON s.id = p.store_id
LEFT JOIN projects pr ON pr.id = p.project_id
LEFT JOIN tasks t ON t.id = p.task_id
```

## Data Fields Verified (Penalty List)

| Field | Source | Status |
|---|---|---|
| user_name | `users.name` via `penalties.user_id` | PASS |
| store_name | `stores.name` via `penalties.store_id` | PASS |
| project_name | `projects.name` via `penalties.project_id` | PASS |
| task_title | `tasks.title` via `penalties.task_id` | PASS |
| overdue_days | `penalties.overdue_days` | PASS |
| penalty_amount | `penalties.penalty_amount` | PASS |
| penalty_currency | `penalties.penalty_currency` | PASS |
| reason | `penalties.reason` | PASS |
| created_at | `penalties.created_at` | PASS |

## Drawer Integration

- Task links in penalty rows have `data-detail-drawer` attribute
- Clicking opens task detail in right-side drawer
- Task detail shows: penalty amount, penalty status, penalty history in task detail view

## Tables Involved

| Table | Status |
|---|---|
| `penalties` | EXISTS — migration `2026_04_27_penalty_system.sql` |
| `users` | EXISTS |
| `stores` | EXISTS |
| `projects` | EXISTS |
| `tasks` | EXISTS |
| `penalty_config` | EXISTS — `penalties` table |

## Issues Found

| # | Severity | Issue | Status |
|---|---|---|---|
| 1 | LOW | Penalty detail opens task detail, not a dedicated penalty view | BY DESIGN — penalty info is embedded in task detail |

## Verdict

**PASS** — Penalty drawer loads all data correctly via task detail. No SQL errors, no missing relations.
