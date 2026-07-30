-- 2026-06-16: Add reviewer_due_date to tasks
-- Tracks the deadline by which the reviewer must complete their review.
-- Set automatically when reviewer_id is first assigned to a task.

ALTER TABLE tasks
    ADD COLUMN IF NOT EXISTS reviewer_due_date DATE NULL DEFAULT NULL AFTER reviewer_id,
    ADD COLUMN IF NOT EXISTS reviewer_assigned_at DATETIME NULL DEFAULT NULL AFTER reviewer_due_date;

-- Back-fill reviewer_assigned_at for existing tasks that already have a reviewer
UPDATE tasks
SET reviewer_assigned_at = COALESCE(submitted_at, created_at)
WHERE reviewer_id IS NOT NULL AND reviewer_assigned_at IS NULL;

-- Back-fill reviewer_due_date: use submitted_at + 3 days, or due_date - 1 day, whichever is sooner
UPDATE tasks
SET reviewer_due_date = CASE
    WHEN submitted_at IS NOT NULL AND due_date IS NOT NULL
        THEN LEAST(DATE_ADD(submitted_at, INTERVAL 3 DAY), DATE_SUB(due_date, INTERVAL 1 DAY))
    WHEN submitted_at IS NOT NULL
        THEN DATE_ADD(submitted_at, INTERVAL 3 DAY)
    WHEN due_date IS NOT NULL
        THEN DATE_SUB(due_date, INTERVAL 1 DAY)
    ELSE DATE_ADD(created_at, INTERVAL 3 DAY)
END
WHERE reviewer_id IS NOT NULL AND reviewer_due_date IS NULL;
