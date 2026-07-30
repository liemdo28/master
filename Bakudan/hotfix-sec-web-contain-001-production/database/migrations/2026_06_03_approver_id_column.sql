-- ============================================================
-- TaskFlow — Add approver_id column to tasks table
-- Fixes SQLSTATE[42S22]: Column not found: 1054 Unknown column 't.approver_id'
-- The findById() query in models/Task.php includes LEFT JOIN users a ON t.approver_id = a.id
-- but the column doesn't exist in the preview database.
-- ============================================================

-- Check if column exists first (MySQL doesn't support ADD COLUMN IF NOT EXISTS across all versions)
SET @col_exists = (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'tasks'
      AND column_name = 'approver_id'
);
SET @sql = IF(@col_exists = 0,
    'ALTER TABLE tasks ADD COLUMN approver_id INT UNSIGNED NULL DEFAULT NULL AFTER reviewer_id',
    'SELECT 1 AS already_exists');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Add foreign key index (helps query performance for approval workflow)
CREATE INDEX IF NOT EXISTS idx_tasks_approver ON tasks(approver_id);

SELECT 'Migration 2026_06_03_approver_id_column.sql completed' AS status;