-- V5 Autonomy Engine — Audit Log Table
-- Run once against the production database.
-- Tracks every autonomous action, approval request, and rejection.

CREATE TABLE IF NOT EXISTS autonomy_log (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    plan_id         VARCHAR(64)    NULL DEFAULT NULL,
    decision_id     VARCHAR(64)    NULL DEFAULT NULL,
    execution_mode  VARCHAR(20)    NOT NULL DEFAULT 'blocked',
                    -- 'auto' | 'approval' | 'blocked' | 'pending_approval'
    executed_by     VARCHAR(20)    NOT NULL DEFAULT 'system',
                    -- 'system' (auto) | 'user' (manual apply)
    approved_by     INT            NULL DEFAULT NULL,
                    -- user_id who approved (NULL for auto or pending)
    confidence_score DECIMAL(5,2)  NULL DEFAULT NULL,
    impact_score    DECIMAL(5,2)   NULL DEFAULT NULL,
    result_status   VARCHAR(20)    NOT NULL DEFAULT 'pending_approval',
                    -- 'pending_approval' | 'approved' | 'rejected' | 'completed' | 'failed'
    result_summary  TEXT           NULL DEFAULT NULL,
    expires_at      DATETIME       NULL DEFAULT NULL,
    created_at      DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    executed_at     DATETIME       NULL DEFAULT NULL,

    INDEX idx_plan_id     (plan_id),
    INDEX idx_decision_id (decision_id),
    INDEX idx_mode        (execution_mode),
    INDEX idx_status      (result_status),
    INDEX idx_created     (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Verify
-- SELECT COUNT(*) FROM autonomy_log;
