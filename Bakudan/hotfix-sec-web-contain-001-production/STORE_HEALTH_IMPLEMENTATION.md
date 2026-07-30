# STORE HEALTH IMPLEMENTATION

**Date:** 2026-06-22  
**Status:** ✅ PASS

## Health Score Formula

```
Score = 100
  - (Overdue Task Rate × 30)     // max -30
  - (Overdue Bills × 5)          // max -25
  - (Open Incidents × 5)         // max -20
  - (Critical Incidents × 10)    // no cap
  - (Penalty Deductions)         // max -10
  - (Inspection Failures × 5)    // max -5
Floor: 0, Ceiling: 100
```

## Grade Mapping
| Score Range | Grade |
|-------------|-------|
| 90-100 | A |
| 80-89 | B |
| 70-79 | C |
| 60-69 | D |
| 0-59 | F |

## Data Sources

| Metric | Source Table | Query |
|--------|-------------|-------|
| Task Overdue Rate | tasks + projects | `SUM(is_completed=0 AND due_date < CURDATE()) / COUNT(*)` |
| Overdue Bills | bills | `WHERE status='overdue' OR (due_date < CURDATE() AND status='pending')` |
| Open Incidents | incidents | `WHERE status NOT IN ('resolved','closed','cancelled')` |
| Critical Incidents | incidents | `WHERE severity='critical' AND status NOT IN ('resolved','closed','cancelled')` |
| Penalties | penalties + tasks + projects | `COUNT(DISTINCT penalties.id)` joined via project store_id |

## API Endpoints

| Endpoint | Method | Response |
|----------|--------|----------|
| `/admin/store-command/{id}/health` | GET | `{ score, grade, metrics }` |
| `/admin/store-command/{id}/stats` | GET | `{ tasks, bills, incidents }` |

## Historical Tracking
Every `calculateHealthScore()` call inserts a row into `store_health_scores`:
```sql
INSERT INTO store_health_scores (store_id, score, grade, metrics, recorded_at)
```

## Files
- `models/StoreCommand.php` — `calculateHealthScore()`, `recordHealthScore()`
- `controllers/StoreCommandController.php` — `apiHealthScore()`, `apiStats()`
- `views/admin/stores.php` — Health drawer (click score → AJAX fetch + render)
- `views/admin/store_command/index.php` — Health score displayed per card
- `views/admin/store_command/show.php` — Health metrics bars in sidebar
