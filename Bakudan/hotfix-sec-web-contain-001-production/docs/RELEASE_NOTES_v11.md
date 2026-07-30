# Release Notes — Phase 11: Bakudan Business Execution Platform

**Version:** v11.0.0-rc1  
**Branch:** phase11-business-execution-platform  
**Status:** Draft  
**Release Date:** Pending approval

---

## New Features

### Daily Operations Center (`/operations/today`)
CEO/Manager morning view — what needs attention today. Shows overdue tasks, today's workload, anomalies, store health issues, and people needing attention.

### Manager Command Center (`/manager/command`)
All-in-one view for managers: team status, store overview, payroll pending, and action items in one screen.

### Action Center (`/action-center`)
Centralized action queue for all pending decisions and tasks requiring immediate attention.

### Store Opening/Closing Checklist (`/store/checklist/open`, `/store/checklist/close`)
Digital store opening and closing procedures with JSON-based checklist items, cash count tracking, and completion timestamps.

### Company Operating Calendar (`/company/calendar`)
Company-wide calendar showing deadlines, events, and operational milestones.

### Execution Score
Performance scoring system measuring task completion rates, overdue ratios, and team efficiency.

### Morning Briefing
Automated morning summary integrated into the Operations Center — highlights what changed overnight and what's urgent today.

### CEO Mobile View
Mobile-optimized layouts for Control Tower and Operations Center.

### Control Tower (`/control-tower`)
Single-screen CEO view — real-time company health in 30 seconds. Shows overall health score, store health, employee status, payroll, releases, audits, incidents, and training.

---

## Database Migration

### `phase11_store_checklists.sql`

Creates `store_checklists` table:

```sql
CREATE TABLE store_checklists (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    store_id BIGINT UNSIGNED NOT NULL,
    type ENUM('open', 'close') NOT NULL,
    items JSON NOT NULL,
    notes TEXT NULL,
    cash_count DECIMAL(12,2) NULL,
    opened_by BIGINT UNSIGNED NULL,
    opened_at DATETIME NULL,
    closed_by BIGINT UNSIGNED NULL,
    closed_at DATETIME NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

**Impact:** New table only. No existing tables altered. No data migration required.

---

## New Controllers

| Controller | Route | Role Required |
|-----------|-------|---------------|
| `OperationsController` | `/operations/today` | Manager+ |
| `ControlTowerController` | `/control-tower` | Manager+ |
| `ActionCenterController` | `/action-center` | Manager+ |
| `ManagerCommandController` | `/manager/command` | Manager+ |
| `StoreChecklistController` | `/store/checklist/*` | Manager+ |
| `CompanyCalendarController` | `/company/calendar` | Manager+ |

---

## Risk Notes

- Multiple new routes, controllers, and views added simultaneously
- Database migration adds new table (no ALTER on existing tables)
- All new routes require `canManage()` permission (admin/ceo/manager only)
- No changes to existing task/bill/project logic
- No changes to authentication or authorization system

---

## Rollback Plan

### If issues found post-publish:

1. **Code rollback:** Revert to commit `41a31f9` (pre-Phase 11 main)
2. **Database:** `store_checklists` table can remain (harmless if unused) or `DROP TABLE store_checklists`
3. **Navigation:** Disable Phase 11 sidebar links via config
4. **No data loss risk:** Phase 11 creates new data only, does not modify existing records

### Rollback command:
```bash
git checkout main
git reset --hard 41a31f9
git push origin main --force  # Only if published
```

### Rollback contact:
Admin team via `/admin/releases` rollback button

---

## Dependencies

- PHP >= 8.0 ✅ (production running 8.4.20)
- MySQL >= 5.7 ✅ (production running 8.0.41)
- No new PHP extensions required
- No new npm packages
- No external API dependencies

---

## Testing Evidence

- Smoke test: `qa/reports/phase11_smoke_20260529.md` — 10/10 routes pass
- Walkthrough QA: `qa/reports/phase11_walkthrough_qa.md` — pending manual execution
- Deployment guide: `docs/PHASE11_DEPLOY_GUIDE.md`
