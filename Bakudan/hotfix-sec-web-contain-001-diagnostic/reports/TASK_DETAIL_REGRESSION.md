# TASK DETAIL REGRESSION
**Date:** 2026-06-16

---

## Field Coverage

| Field | DB Column | View Line | Status |
|-------|-----------|-----------|--------|
| title | tasks.title | detail.php ~60 | PASS |
| description | tasks.description | detail.php ~180 | PASS |
| assignee | tasks.assigned_to → users.name | detail.php ~100 | PASS |
| store | tasks.store_id → stores.name | detail.php ~110 | PASS |
| comments | task_comments | TaskComment model | PASS (tableExists guard) |
| attachments | task_attachments | detail.php ~404 | PASS (tableExists guard) |
| approval notes | task_approval_notes | ApprovalNote model | PASS (tableExists guard) |
| review notes | task_review_notes / reviewer_workspace | ReviewerNotesController | PASS |
| history | task_approval_events | detail.php ~461 | PASS (tableExists guard) |
| penalty info | tasks.penalty_applied | detail.php ~342 | PASS |
| parent task | tasks.parent_task_id | detail.php ~324 | PASS |

## Table Guards

All 4 tables use `tableExists()` guard — no SQLSTATE on missing tables:
```php
// TaskComment.php line 16
if (!$this->db->tableExists('task_comments')) return [];
// ApprovalNote.php line 57
if (!$this->db->tableExists('task_approval_notes')) return [];
```

## Accept Gate Removed

**FIXED 2026-06-16**: Removed assignee accept gate from `views/tasks/detail.php`.
- Before: "Task not yet accepted" alert + Accept button shown to ALL users when `accepted_at` is NULL
- After: Accept gate removed — assignee works task immediately on assignment
- Approver workflow (when `approval_required=1`) is UNTOUCHED

## No SQLSTATE Risk

Migrations that ensure table existence:
- `2026_06_02_p0_task_detail_schema_sync.sql` — task_comments, task_attachments, task_approval_notes
- `2026_06_10_p0_missing_reviewer_tables.sql` — reviewer workspace tables
- `2026_06_02_task_approval_workflow.sql` — task_approval_events

## Status: PASS ✅
