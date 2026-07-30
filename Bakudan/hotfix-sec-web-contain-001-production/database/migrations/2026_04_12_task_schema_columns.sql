-- TaskFlow: Task Schema Columns
-- Previously auto-applied by Task.php ensureSchema() on every request.
-- This migration documents the authoritative DDL for fresh deployments.
-- Run once when setting up a fresh database (after schema_v4.sql).
-- MySQL 5.7 compatible (no ADD COLUMN IF NOT EXISTS)

DROP PROCEDURE IF EXISTS taskflow_migrate_task_columns;
DELIMITER $$
CREATE PROCEDURE taskflow_migrate_task_columns()
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'tasks' AND column_name = 'accepted_at') THEN
        ALTER TABLE tasks ADD COLUMN accepted_at TIMESTAMP NULL DEFAULT NULL AFTER completed_at;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'tasks' AND column_name = 'parent_task_id') THEN
        ALTER TABLE tasks ADD COLUMN parent_task_id INT NULL DEFAULT NULL AFTER accepted_at;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'tasks' AND column_name = 'reschedule_count') THEN
        ALTER TABLE tasks ADD COLUMN reschedule_count INT DEFAULT 0 AFTER parent_task_id;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'tasks' AND column_name = 'repeat_type') THEN
        ALTER TABLE tasks ADD COLUMN repeat_type ENUM('none','daily','weekly','monthly','yearly') DEFAULT 'none' AFTER reschedule_count;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'tasks' AND column_name = 'repeat_config') THEN
        ALTER TABLE tasks ADD COLUMN repeat_config TEXT NULL DEFAULT NULL AFTER repeat_type;
    END IF;
END$$
DELIMITER ;

CALL taskflow_migrate_task_columns();
DROP PROCEDURE IF EXISTS taskflow_migrate_task_columns;

UPDATE tasks SET accepted_at = created_at WHERE accepted_at IS NULL;

CREATE TABLE IF NOT EXISTS task_watchers (
    task_id INT NOT NULL,
    user_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (task_id, user_id),
    INDEX idx_watcher_user (user_id),
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
