# Recurring Task Certification
**Phase 11.8 — Pre-Production Certification**
**Date:** 2026-05-30
**Status:** READY FOR EXECUTION

---

## Objective

Verify Asana-style task recurrence works correctly with real data. No duplicates on reopen/re-complete cycles.

---

## Implementation Reference

- Service: `service/RecurringTaskService.php`
- Completion: `service/TaskCompletionService.php`
- Model: `models/Task.php` (fields: `repeat_type`, `repeat_interval`, `repeat_days`, `occurrence_index`, `recurring_root_id`, `max_occurrences`)

---

## Test 1 — Weekly Recurrence

### Setup

```sql
-- Create a weekly recurring task (or use existing)
INSERT INTO tasks (title, project_id, assignee_id, due_date, status, is_completed, repeat_type, priority, visibility)
VALUES ('Weekly Certification Test', {project_id}, {user_id}, '2026-05-30', 'todo', 0, 'weekly', 'medium', 'public');
```

### Steps

| Step | Action | Expected | Result |
|------|--------|----------|--------|
| 1.1 | Complete task (POST `/api/tasks/{id}/complete`) | Task marked complete | [PENDING] |
| 1.2 | Check for new task | New task created with `due_date = 2026-06-06` (same weekday, +7 days) | [PENDING] |
| 1.3 | Verify new task fields | Same title, project, assignee, priority | [PENDING] |
| 1.4 | Verify `recurring_root_id` | Points to original task ID | [PENDING] |
| 1.5 | Verify `occurrence_index` | Incremented by 1 | [PENDING] |

### Verification Query

```sql
SELECT id, title, due_date, occurrence_index, recurring_root_id, is_completed
FROM tasks
WHERE title = 'Weekly Certification Test'
   OR recurring_root_id = {original_id}
ORDER BY occurrence_index ASC;
```

**Expected:** 2 rows — original (completed) + new occurrence (incomplete, due +7 days)

---

## Test 2 — Monthly Recurrence

### Setup

```sql
INSERT INTO tasks (title, project_id, assignee_id, due_date, status, is_completed, repeat_type, priority, visibility)
VALUES ('Monthly Certification Test', {project_id}, {user_id}, '2026-05-30', 'todo', 0, 'monthly', 'medium', 'public');
```

### Steps

| Step | Action | Expected | Result |
|------|--------|----------|--------|
| 2.1 | Complete task | Task marked complete | [PENDING] |
| 2.2 | Check for new task | New task with `due_date = 2026-06-30` (+1 month) | [PENDING] |
| 2.3 | Verify same day-of-month | Day = 30 (or last day if month is shorter) | [PENDING] |

### Verification Query

```sql
SELECT id, title, due_date, occurrence_index, recurring_root_id
FROM tasks
WHERE title = 'Monthly Certification Test'
   OR recurring_root_id = {original_id}
ORDER BY occurrence_index ASC;
```

---

## Test 3 — Reopen / Re-Complete (No Duplicates)

### Steps

| Step | Action | Expected | Result |
|------|--------|----------|--------|
| 3.1 | Complete weekly task | New occurrence created | [PENDING] |
| 3.2 | Reopen original task (toggle) | `is_completed = 0`, status back to 'todo' | [PENDING] |
| 3.3 | Complete original again | **NO new occurrence** (already spawned) | [PENDING] |
| 3.4 | Count tasks with same root | Exactly 2 (original + 1 occurrence) | [PENDING] |

### Verification Query

```sql
-- Count occurrences — should be exactly 2 after reopen+re-complete
SELECT COUNT(*) AS total_occurrences
FROM tasks
WHERE recurring_root_id = {original_id} OR id = {original_id};
-- Expected: 2 (NOT 3)
```

### Anti-Duplicate Logic

The `TaskCompletionService::complete()` method checks:
1. Task has `repeat_type != 'none'`
2. Task is not already completed
3. No existing next occurrence already exists for this root

If a next occurrence already exists, it skips creation. This prevents duplicates on reopen cycles.

---

## Test 4 — Max Occurrences Limit

### Setup

```sql
INSERT INTO tasks (title, project_id, assignee_id, due_date, status, is_completed, repeat_type, max_occurrences, occurrence_index, priority, visibility)
VALUES ('Limited Recurrence Test', {project_id}, {user_id}, '2026-05-30', 'todo', 0, 'weekly', 3, 2, 'medium', 'public');
```

### Steps

| Step | Action | Expected | Result |
|------|--------|----------|--------|
| 4.1 | Complete task (occurrence_index = 2, max = 3) | New task created (index = 3) | [PENDING] |
| 4.2 | Complete new task (index = 3, max = 3) | **NO new task** — limit reached | [PENDING] |

### Verification

```sql
SELECT COUNT(*) FROM tasks
WHERE recurring_root_id = {root_id} OR id = {root_id};
-- Expected: 3 (original + 2 occurrences, then stops)
```

---

## Test 5 — Daily Recurrence

| Step | Action | Expected | Result |
|------|--------|----------|--------|
| 5.1 | Create daily task due today | — | [PENDING] |
| 5.2 | Complete | New task due tomorrow | [PENDING] |
| 5.3 | Verify due_date = today + 1 | Correct | [PENDING] |

---

## Cleanup

```sql
DELETE FROM tasks WHERE title IN (
    'Weekly Certification Test',
    'Monthly Certification Test',
    'Limited Recurrence Test'
) OR recurring_root_id IN (
    SELECT id FROM (
        SELECT id FROM tasks WHERE title IN (
            'Weekly Certification Test',
            'Monthly Certification Test',
            'Limited Recurrence Test'
        )
    ) AS sub
);
```

---

## Certification Matrix

| Test | Status |
|------|--------|
| Weekly recurrence | [PENDING] |
| Monthly recurrence | [PENDING] |
| Reopen no-duplicate | [PENDING] |
| Max occurrences limit | [PENDING] |
| Daily recurrence | [PENDING] |

**Overall: PENDING — Execute on live environment with real data**
