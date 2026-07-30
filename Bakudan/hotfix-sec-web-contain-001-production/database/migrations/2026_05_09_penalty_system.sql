-- Migration: Penalty Management System
-- Run once on production database.
-- MySQL 5.7 compatible

-- 1. Config table (single-row, always id=1)
CREATE TABLE IF NOT EXISTS penalty_config (
    id INT AUTO_INCREMENT PRIMARY KEY,
    penalty_amount DECIMAL(12,2) NOT NULL DEFAULT 500000,
    currency VARCHAR(10) NOT NULL DEFAULT 'VND',
    updated_by INT NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed default config (safe to run multiple times)
INSERT INTO penalty_config (id, penalty_amount, currency, updated_by, updated_at)
VALUES (1, 500000, 'VND', NULL, NOW())
ON DUPLICATE KEY UPDATE id = id;

-- 2. Penalty log (one record per task, UNIQUE prevents duplicates)
CREATE TABLE IF NOT EXISTS penalty_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    task_id INT NOT NULL,
    project_id INT NULL,
    store_id INT NULL,
    user_id INT NULL,
    penalty_amount DECIMAL(12,2) NOT NULL,
    penalty_currency VARCHAR(10) NOT NULL DEFAULT 'VND',
    overdue_days INT NOT NULL DEFAULT 1,
    reason VARCHAR(255) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_task_penalty (task_id),
    INDEX idx_pl_user (user_id),
    INDEX idx_pl_project (project_id),
    INDEX idx_pl_store (store_id),
    INDEX idx_pl_created (created_at),
    INDEX idx_pl_currency (penalty_currency)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Add penalty tracking columns to tasks (MySQL 5.7 compatible)
DROP PROCEDURE IF EXISTS taskflow_migrate_penalty_columns;
DELIMITER $$
CREATE PROCEDURE taskflow_migrate_penalty_columns()
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'tasks' AND column_name = 'penalty_applied') THEN
        ALTER TABLE tasks ADD COLUMN penalty_applied TINYINT(1) NOT NULL DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'tasks' AND column_name = 'penalty_amount') THEN
        ALTER TABLE tasks ADD COLUMN penalty_amount DECIMAL(12,2) NOT NULL DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'tasks' AND column_name = 'penalty_currency') THEN
        ALTER TABLE tasks ADD COLUMN penalty_currency VARCHAR(10) NOT NULL DEFAULT 'VND';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'tasks' AND column_name = 'penalty_applied_at') THEN
        ALTER TABLE tasks ADD COLUMN penalty_applied_at DATETIME NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'tasks' AND index_name = 'idx_tasks_penalty') THEN
        ALTER TABLE tasks ADD INDEX idx_tasks_penalty (is_completed, penalty_applied, due_date);
    END IF;
END$$
DELIMITER ;

CALL taskflow_migrate_penalty_columns();
DROP PROCEDURE IF EXISTS taskflow_migrate_penalty_columns;
