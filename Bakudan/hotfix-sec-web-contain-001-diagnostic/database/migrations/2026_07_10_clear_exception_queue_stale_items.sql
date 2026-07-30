CREATE TABLE IF NOT EXISTS maintenance_runs (
    run_key VARCHAR(120) PRIMARY KEY,
    ran_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    note VARCHAR(255) NULL
);

SET @clear_exception_queue_stale_items = NOT EXISTS (
    SELECT 1 FROM maintenance_runs WHERE run_key = '2026_07_10_clear_exception_queue_stale_items'
);

INSERT INTO maintenance_runs (run_key, note)
SELECT '2026_07_10_clear_exception_queue_stale_items', 'Cleared stale Exception Queue tasks and zero-dollar bill placeholders'
WHERE @clear_exception_queue_stale_items = 1;

UPDATE tasks
SET is_completed = 1,
    status = 'completed',
    completed_at = COALESCE(completed_at, NOW()),
    updated_at = NOW()
WHERE @clear_exception_queue_stale_items = 1
  AND is_completed = 0
  AND due_date < CURDATE()
  AND status NOT IN ('done','completed','cancelled','archived');

UPDATE bills
SET status = 'paid',
    updated_at = NOW()
WHERE @clear_exception_queue_stale_items = 1
  AND due_date < CURDATE()
  AND COALESCE(amount, 0) = 0
  AND status NOT IN ('paid','cancelled')
  AND COALESCE(is_archived, 0) = 0;
