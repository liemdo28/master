-- ============================================================
-- Penalty System — 2026-04-27
-- ============================================================

-- 2.1  Add penalty tracking columns to tasks
ALTER TABLE tasks
    ADD COLUMN IF NOT EXISTS penalty_applied    TINYINT(1)     NOT NULL DEFAULT 0     AFTER timezone,
    ADD COLUMN IF NOT EXISTS penalty_amount     DECIMAL(12,2)  NOT NULL DEFAULT 0     AFTER penalty_applied,
    ADD COLUMN IF NOT EXISTS penalty_applied_at DATETIME       NULL     DEFAULT NULL  AFTER penalty_amount;

-- 2.2  Penalty configuration (admin-editable default amount)
CREATE TABLE IF NOT EXISTS penalty_config (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    penalty_amount DECIMAL(12,2) NOT NULL DEFAULT 500000,
    currency       VARCHAR(10)   NOT NULL DEFAULT 'VND',
    updated_by     INT           NULL,
    updated_at     DATETIME      NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed default row (idempotent)
INSERT INTO penalty_config (penalty_amount, currency, updated_at)
SELECT 500000, 'VND', NOW()
WHERE NOT EXISTS (SELECT 1 FROM penalty_config);

-- 2.3  Penalty log — UNIQUE on task_id prevents duplicates
CREATE TABLE IF NOT EXISTS penalty_log (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    task_id        INT           NOT NULL,
    user_id        INT           NULL,
    penalty_amount DECIMAL(12,2) NOT NULL,
    currency       VARCHAR(10)   NOT NULL DEFAULT 'VND',
    reason         VARCHAR(255)  NOT NULL,
    created_at     DATETIME      NOT NULL,
    UNIQUE KEY uniq_task_penalty (task_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
