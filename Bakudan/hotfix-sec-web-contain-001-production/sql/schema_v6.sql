-- ============================================================
-- TaskFlow v6 — Deadline Penalty Feature
-- Run AFTER schema.sql + schema_v2/v3/v4/v5.sql
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. PENALTY_CONFIG
--    One row per user that admin has opted into penalty tracking.
--    Admin can disable (is_active=0) without losing history.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS penalty_config (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    user_id             INT           NOT NULL,
    amount_per_late_task DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    is_active           TINYINT(1)    NOT NULL DEFAULT 1,
    enabled_by_admin_id INT           NULL DEFAULT NULL,
    note                VARCHAR(500)  NULL DEFAULT NULL,
    created_at          TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_penalty_user (user_id),
    FOREIGN KEY (user_id)             REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (enabled_by_admin_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────────
-- 2. PENALTY_LOG
--    Audit trail: one row per (user, task) penalty event.
--    Allows re-calculation when deadline is extended.
--    calculated_at tracks when the penalty was last computed.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS penalty_log (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    user_id        INT           NOT NULL,
    task_id        INT           NOT NULL,
    late_days      INT           NOT NULL DEFAULT 0,
    amount         DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    calculated_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_penalty_log_user_task (user_id, task_id),
    FOREIGN KEY (user_id) REFERENCES users(id)  ON DELETE CASCADE,
    FOREIGN KEY (task_id) REFERENCES tasks(id)  ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX IF NOT EXISTS idx_penalty_config_user     ON penalty_config(user_id);
CREATE INDEX IF NOT EXISTS idx_penalty_config_active   ON penalty_config(is_active);
CREATE INDEX IF NOT EXISTS idx_penalty_log_user        ON penalty_log(user_id);
CREATE INDEX IF NOT EXISTS idx_penalty_log_task        ON penalty_log(task_id);
CREATE INDEX IF NOT EXISTS idx_penalty_log_calc        ON penalty_log(calculated_at);
