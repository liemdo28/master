-- ============================================================
-- 2026_06_10_assignment_flow_fix.sql
-- Remove accepted_at gate from task visibility — handled in Task.php
-- The accepted_at column is KEPT for audit; the filter is removed in PHP code.
-- MySQL 5.7 compatible
-- ============================================================

SET @s = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='tasks' AND COLUMN_NAME='assignment_notified_at')=0, 'ALTER TABLE tasks ADD COLUMN assignment_notified_at DATETIME NULL', 'SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
