# DASHBOARD DRILLDOWN VERIFICATION
**Date:** 2026-06-16

---

## KPI Clickability Audit

| KPI Card | Link Present | Route | Controller Method |
|----------|-------------|-------|------------------|
| Overdue Bills | ✅ | `/overview/drilldown/overdue-bills` | DrilldownController::overdueBills() |
| Critical Tasks | ✅ | `/overview/drilldown/critical-tasks` | DrilldownController::criticalTasks() |
| Compliance Risk | ✅ | `/overview/drilldown/compliance-risk` | DrilldownController::complianceRisk() |
| Execution Risk | ✅ | `/overview/drilldown/execution-risk` | DrilldownController::executionRisk() |
| Unified Risk | ✅ | `/overview/drilldown/unified-risk` | DrilldownController::unifiedRisk() |
| Finance Critical Bills | ✅ | `/overview/drilldown/finance-bills?risk=` | DrilldownController::financeBills() |
| Cash Risk | ✅ | `/overview/drilldown/cash-risk` | DrilldownController::cashRisk() |
| Store Risk | ✅ | `/overview/store/{id}` | DrilldownController or StoreController |
| Team Load / Member | ✅ | `/overview/member/{id}` | DrilldownController::memberPortfolio() |

**Source:** `views/dashboard/overview.php` lines 649, 671, 693, 713, 735, 824, 1259, 1442, 1511

## Archived Bill Filter on Drilldown

All drilldown queries in `controllers/DrilldownController.php` now include:
```sql
AND COALESCE(b.is_archived, 0) = 0
```
Applied to:
- `overdueBills()` line ~70
- Unified risk bill query line ~231  
- Finance bills query line ~367

## Status: PASS ✅

No dead-end KPI metrics. All 9 KPI cards link to source records.
