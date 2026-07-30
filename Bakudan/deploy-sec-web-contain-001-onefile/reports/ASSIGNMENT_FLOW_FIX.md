# ASSIGNMENT_FLOW_FIX.md
**Date:** 2026-06-10  
**Issue:** Tasks required `accepted_at IS NOT NULL` before appearing in assignee's list

## Before (Broken)
```sql
WHERE (t.assignee_id = ? OR t.created_by = ?) AND t.is_completed = 0
AND t.accepted_at IS NOT NULL   -- BLOCKED tasks until acceptance
```

Assignees could not see their tasks until they explicitly accepted each one.

## After (Fixed)
```sql
WHERE (t.assignee_id = ? OR t.created_by = ?) AND t.is_completed = 0
-- accepted_at gate removed 2026-06-10: tasks appear immediately on assignment
```

## Files Changed
- `models/Task.php` — removed `AND accepted_at IS NOT NULL` from `getByUser()`
- `controllers/TaskController.php` — added `insertTaskAssignedNotification()` helper
- `views/partials/task_assigned_popup.php` — NEW: popup shown within 5 min of assignment

## Audit
`accepted_at` column is KEPT for audit purposes. It is no longer used as a visibility gate.

## Notification Flow
1. `TaskController::create()` calls `insertTaskAssignedNotification()` when assignee is set
2. Notification inserted into `task_notifications` with `notification_type = 'task_assigned'`
3. Dashboard loads `views/partials/task_assigned_popup.php`
4. Popup polls `/api/notifications?type=task_assigned&unread=1` on load
5. Shows popup for notifications created within last 5 minutes
6. Auto-hides after 10 seconds; [View Task] and [Dismiss] buttons
