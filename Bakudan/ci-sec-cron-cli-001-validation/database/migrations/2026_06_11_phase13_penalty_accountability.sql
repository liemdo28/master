-- Phase 13.4 — Penalty & Accountability System
-- New tables: penalty_rules, penalty_appeals, penalty_comments
-- Sample rule seed (no user penalties — admin must apply explicitly)

-- 1. Configurable penalty rules
CREATE TABLE IF NOT EXISTS penalty_rules (
    id               INT AUTO_INCREMENT PRIMARY KEY,
    name             VARCHAR(200)  NOT NULL,
    description      TEXT          NULL,
    rule_type        VARCHAR(50)   NOT NULL DEFAULT 'custom',
    suggested_amount DECIMAL(12,2) NOT NULL DEFAULT 500000.00,
    currency         VARCHAR(10)   NOT NULL DEFAULT 'VND',
    is_active        TINYINT(1)    NOT NULL DEFAULT 1,
    effective_date   DATE          NOT NULL,
    created_by       INT           NULL,
    updated_by       INT           NULL,
    created_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Appeals — users can contest a penalty_log entry
CREATE TABLE IF NOT EXISTS penalty_appeals (
    id               INT AUTO_INCREMENT PRIMARY KEY,
    penalty_log_id   INT           NOT NULL,
    user_id          INT           NOT NULL,
    reason           TEXT          NOT NULL,
    status           VARCHAR(20)   NOT NULL DEFAULT 'pending',
    reviewed_by      INT           NULL,
    reviewed_at      TIMESTAMP     NULL,
    admin_note       TEXT          NULL,
    created_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_appeal_per_log (penalty_log_id),
    FOREIGN KEY (penalty_log_id) REFERENCES penalty_log(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id)        REFERENCES users(id)        ON DELETE CASCADE,
    FOREIGN KEY (reviewed_by)    REFERENCES users(id)        ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Comments — admin/manager notes on individual penalty log entries
CREATE TABLE IF NOT EXISTS penalty_comments (
    id               INT AUTO_INCREMENT PRIMARY KEY,
    penalty_log_id   INT           NOT NULL,
    user_id          INT           NOT NULL,
    comment          TEXT          NOT NULL,
    created_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (penalty_log_id) REFERENCES penalty_log(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id)        REFERENCES users(id)        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Sample rule seed: Task Overdue is active; others seeded inactive
-- Admin must manually activate rules and apply per-user configs
INSERT INTO penalty_rules (name, description, rule_type, suggested_amount, currency, is_active, effective_date)
SELECT 'Task Overdue', 'Applied when a task passes its due date without completion.', 'task_overdue', 500000.00, 'VND', 1, CURDATE()
WHERE NOT EXISTS (SELECT 1 FROM penalty_rules WHERE rule_type = 'task_overdue');

INSERT INTO penalty_rules (name, description, rule_type, suggested_amount, currency, is_active, effective_date)
SELECT 'Verification Missed', 'Applied when a scheduled verification check is missed.', 'verification_missed', 500000.00, 'VND', 0, CURDATE()
WHERE NOT EXISTS (SELECT 1 FROM penalty_rules WHERE rule_type = 'verification_missed');

INSERT INTO penalty_rules (name, description, rule_type, suggested_amount, currency, is_active, effective_date)
SELECT 'Checklist Missed', 'Applied when a required checklist item is skipped.', 'checklist_missed', 500000.00, 'VND', 0, CURDATE()
WHERE NOT EXISTS (SELECT 1 FROM penalty_rules WHERE rule_type = 'checklist_missed');
