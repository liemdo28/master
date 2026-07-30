CREATE TABLE IF NOT EXISTS maintenance_runs (
    run_key VARCHAR(120) PRIMARY KEY,
    ran_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    note VARCHAR(255) NULL
);

SET @clear_action_center_escalations = NOT EXISTS (
    SELECT 1 FROM maintenance_runs WHERE run_key = '2026_07_10_clear_action_center_escalations'
);

INSERT INTO maintenance_runs (run_key, note)
SELECT '2026_07_10_clear_action_center_escalations', 'Cleared stale Action Center escalation tasks'
WHERE @clear_action_center_escalations = 1;

UPDATE tasks
SET is_completed = 1,
    status = 'completed',
    completed_at = COALESCE(completed_at, NOW()),
    updated_at = NOW()
WHERE @clear_action_center_escalations = 1
  AND is_completed = 0
  AND due_date < DATE_SUB(CURDATE(), INTERVAL 5 DAY);
