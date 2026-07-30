-- P0 Dashboard Requirements Migration
-- 2026-06-12
-- MySQL 5.7 compatible — uses conditional logic via stored procedures

-- ── task_templates table ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS task_templates (
    id                   INT AUTO_INCREMENT PRIMARY KEY,
    task_type            VARCHAR(100) NOT NULL,
    title                VARCHAR(255) NOT NULL,
    applies_to           ENUM('all','specific') DEFAULT 'all',
    frequency            ENUM('daily','weekly','monthly','quarterly','annual','one_time') NOT NULL,
    due_date_rule        VARCHAR(100) DEFAULT NULL COMMENT 'e.g. last_day_of_month, day_15',
    grace_period_days    INT DEFAULT 0,
    required_evidence_type VARCHAR(100) DEFAULT NULL COMMENT 'bank_transaction,receipt,payroll_report,filing_receipt',
    verification_source  VARCHAR(100) DEFAULT NULL COMMENT 'bank,email,payroll_provider,google_drive',
    escalation_chain     TEXT DEFAULT NULL,
    criticality          ENUM('low','medium','high','critical') DEFAULT 'medium',
    store_id             INT DEFAULT NULL COMMENT 'NULL = applies to all stores',
    is_active            TINYINT(1) DEFAULT 1,
    created_at           DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at           DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── verification_results table ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS verification_results (
    id                   INT AUTO_INCREMENT PRIMARY KEY,
    task_id              INT NOT NULL,
    verification_status  ENUM('pending','verified','failed','exception') NOT NULL DEFAULT 'pending',
    confidence_score     DECIMAL(5,4) DEFAULT NULL COMMENT '0.0000 to 1.0000',
    evidence_source      VARCHAR(100) DEFAULT NULL,
    evidence_date        DATE DEFAULT NULL,
    evidence_amount      DECIMAL(10,2) DEFAULT NULL,
    evidence_payee       VARCHAR(255) DEFAULT NULL,
    notes                TEXT DEFAULT NULL,
    verified_by          INT DEFAULT NULL COMMENT 'user_id or NULL for agent',
    created_at           DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at           DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_task_id (task_id),
    INDEX idx_verification_status (verification_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Add missing columns to tasks ─────────────────────────────────────────────
-- MySQL 5.7: no IF NOT EXISTS for ALTER TABLE ADD COLUMN
-- We use SET @exist / PREPARE pattern

SET @exist := (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tasks' AND COLUMN_NAME = 'task_type');
SET @sql := IF(@exist = 0,
    'ALTER TABLE tasks ADD COLUMN task_type VARCHAR(100) NULL AFTER title',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exist := (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tasks' AND COLUMN_NAME = 'period');
SET @sql := IF(@exist = 0,
    'ALTER TABLE tasks ADD COLUMN period VARCHAR(20) NULL COMMENT "e.g. 2026-06" AFTER task_type',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exist := (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tasks' AND COLUMN_NAME = 'expected_amount');
SET @sql := IF(@exist = 0,
    'ALTER TABLE tasks ADD COLUMN expected_amount DECIMAL(10,2) NULL AFTER period',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exist := (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tasks' AND COLUMN_NAME = 'vendor_payee');
SET @sql := IF(@exist = 0,
    'ALTER TABLE tasks ADD COLUMN vendor_payee VARCHAR(255) NULL AFTER expected_amount',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exist := (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tasks' AND COLUMN_NAME = 'required_evidence_type');
SET @sql := IF(@exist = 0,
    'ALTER TABLE tasks ADD COLUMN required_evidence_type VARCHAR(100) NULL AFTER vendor_payee',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exist := (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tasks' AND COLUMN_NAME = 'source_system');
SET @sql := IF(@exist = 0,
    'ALTER TABLE tasks ADD COLUMN source_system VARCHAR(100) NULL AFTER required_evidence_type',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exist := (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tasks' AND COLUMN_NAME = 'criticality');
SET @sql := IF(@exist = 0,
    'ALTER TABLE tasks ADD COLUMN criticality ENUM("low","medium","high","critical") NULL AFTER source_system',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exist := (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tasks' AND COLUMN_NAME = 'verification_status');
SET @sql := IF(@exist = 0,
    'ALTER TABLE tasks ADD COLUMN verification_status ENUM("not_checked","pending","verified","failed","exception") DEFAULT "not_checked" AFTER criticality',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ── Seed default task templates ───────────────────────────────────────────────
INSERT IGNORE INTO task_templates (id, task_type, title, frequency, due_date_rule, grace_period_days, required_evidence_type, verification_source, criticality)
VALUES
(1, 'rent',        'Monthly Rent Payment',        'monthly',    'day_1',              3,  'bank_transaction', 'bank',            'critical'),
(2, 'electricity', 'Electricity Bill Payment',    'monthly',    'last_day_of_month',  5,  'receipt',          'email',           'high'),
(3, 'payroll',     'Payroll Run',                 'weekly',     'friday',             1,  'payroll_report',   'payroll_provider','critical'),
(4, 'sales_tax',   'Sales Tax Filing',            'quarterly',  'last_day_of_quarter',7,  'filing_receipt',   'email',           'critical'),
(5, 'insurance',   'Insurance Renewal',           'annual',     'policy_date',        14, 'policy_document',  'email',           'high'),
(6, 'utilities',   'Water / Gas Bill',            'monthly',    'last_day_of_month',  5,  'receipt',          'email',           'medium');
