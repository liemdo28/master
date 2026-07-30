-- ============================================================
-- 2026_06_10_bill_registry_upgrade.sql
-- Bill registry schema upgrade (MySQL 5.7 compatible)
-- ============================================================

-- Add columns to bills table (IF NOT EXISTS emulated for MySQL 5.7)
SET @s = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='bills' AND COLUMN_NAME='responsible_user_id')=0, 'ALTER TABLE bills ADD COLUMN responsible_user_id INT NULL', 'SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @s = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='bills' AND COLUMN_NAME='checker_user_id')=0, 'ALTER TABLE bills ADD COLUMN checker_user_id INT NULL', 'SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @s = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='bills' AND COLUMN_NAME='approver_user_id')=0, 'ALTER TABLE bills ADD COLUMN approver_user_id INT NULL', 'SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @s = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='bills' AND COLUMN_NAME='verifier_user_id')=0, 'ALTER TABLE bills ADD COLUMN verifier_user_id INT NULL', 'SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @s = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='bills' AND COLUMN_NAME='payment_method')=0, "ALTER TABLE bills ADD COLUMN payment_method ENUM('bank_transfer','check','credit_card','ach','wire','wells_fargo','other') NULL", 'SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @s = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='bills' AND COLUMN_NAME='frequency')=0, "ALTER TABLE bills ADD COLUMN frequency ENUM('once','weekly','biweekly','monthly','quarterly','annual') NOT NULL DEFAULT 'monthly'", 'SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @s = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='bills' AND COLUMN_NAME='last_paid_date')=0, 'ALTER TABLE bills ADD COLUMN last_paid_date DATE NULL', 'SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @s = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='bills' AND COLUMN_NAME='next_due_date')=0, 'ALTER TABLE bills ADD COLUMN next_due_date DATE NULL', 'SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @s = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='bills' AND COLUMN_NAME='is_archived')=0, 'ALTER TABLE bills ADD COLUMN is_archived TINYINT(1) NOT NULL DEFAULT 0', 'SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @s = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='bills' AND COLUMN_NAME='archived_at')=0, 'ALTER TABLE bills ADD COLUMN archived_at DATETIME NULL', 'SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @s = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='bills' AND COLUMN_NAME='archived_reason')=0, 'ALTER TABLE bills ADD COLUMN archived_reason VARCHAR(255) NULL', 'SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @s = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='bills' AND COLUMN_NAME='duplicate_of_bill_id')=0, 'ALTER TABLE bills ADD COLUMN duplicate_of_bill_id INT NULL', 'SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @s = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='bills' AND COLUMN_NAME='duplicate_hash')=0, 'ALTER TABLE bills ADD COLUMN duplicate_hash VARCHAR(64) NULL', 'SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @s = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='bills' AND COLUMN_NAME='notes')=0, 'ALTER TABLE bills ADD COLUMN notes TEXT NULL', 'SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- FK guards (skip if already exists)
SET @fk_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='bills' AND COLUMN_NAME='responsible_user_id' AND REFERENCED_TABLE_NAME='users');
SET @s = IF(@fk_exists=0,'ALTER TABLE bills ADD CONSTRAINT fk_bill_responsible FOREIGN KEY (responsible_user_id) REFERENCES users(id) ON DELETE SET NULL','SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @fk_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='bills' AND COLUMN_NAME='checker_user_id' AND REFERENCED_TABLE_NAME='users');
SET @s = IF(@fk_exists=0,'ALTER TABLE bills ADD CONSTRAINT fk_bill_checker FOREIGN KEY (checker_user_id) REFERENCES users(id) ON DELETE SET NULL','SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @fk_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='bills' AND COLUMN_NAME='approver_user_id' AND REFERENCED_TABLE_NAME='users');
SET @s = IF(@fk_exists=0,'ALTER TABLE bills ADD CONSTRAINT fk_bill_approver FOREIGN KEY (approver_user_id) REFERENCES users(id) ON DELETE SET NULL','SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @fk_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='bills' AND COLUMN_NAME='verifier_user_id' AND REFERENCED_TABLE_NAME='users');
SET @s = IF(@fk_exists=0,'ALTER TABLE bills ADD CONSTRAINT fk_bill_verifier FOREIGN KEY (verifier_user_id) REFERENCES users(id) ON DELETE SET NULL','SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- Create new tables
CREATE TABLE IF NOT EXISTS bill_categories (
  id                    INT AUTO_INCREMENT PRIMARY KEY,
  name                  VARCHAR(100) NOT NULL,
  slug                  VARCHAR(100) NOT NULL UNIQUE,
  default_frequency     ENUM('once','weekly','biweekly','monthly','quarterly','annual') DEFAULT 'monthly',
  default_reminder_days INT NOT NULL DEFAULT 7,
  requires_evidence     TINYINT(1) NOT NULL DEFAULT 0,
  verification_steps    JSON NULL,
  department            VARCHAR(100) NULL,
  penalty_rule          TEXT NULL,
  is_active             TINYINT(1) NOT NULL DEFAULT 1,
  sort_order            INT NOT NULL DEFAULT 0,
  created_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO bill_categories (name, slug, default_frequency, default_reminder_days, requires_evidence, department, sort_order) VALUES
  ('Rent',               'rent',        'monthly',   14, 1, 'Operations', 1),
  ('Utility',            'utility',     'monthly',    7, 1, 'Operations', 2),
  ('Tax',                'tax',         'monthly',   14, 1, 'Finance',    3),
  ('Insurance',          'insurance',   'annual',    30, 1, 'Finance',    4),
  ('Company Credit Card','credit_card', 'monthly',    5, 1, 'Finance',    5),
  ('Vendor',             'vendor',      'monthly',    7, 0, 'Operations', 6),
  ('Payroll',            'payroll',     'biweekly',   3, 1, 'HR',         7),
  ('Compliance',         'compliance',  'annual',    30, 1, 'Legal',      8),
  ('Other',              'other',       'monthly',    7, 0, NULL,         9);

CREATE TABLE IF NOT EXISTS bill_evidence (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  bill_id      INT NOT NULL,
  uploader_id  INT NOT NULL,
  file_path    VARCHAR(500) NOT NULL,
  file_name    VARCHAR(255) NOT NULL,
  file_type    ENUM('receipt','whatsapp','email','invoice','other') NULL DEFAULT 'other',
  mime_type    VARCHAR(100) NULL,
  file_size    INT NULL,
  label        VARCHAR(255) NULL,
  uploaded_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS bill_history (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  bill_id     INT NOT NULL,
  user_id     INT NULL,
  action      VARCHAR(100) NOT NULL,
  old_status  VARCHAR(50) NULL,
  new_status  VARCHAR(50) NULL,
  note        TEXT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Index on duplicate_hash
SET @idx_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='bills' AND INDEX_NAME='idx_bill_dup_hash');
SET @s = IF(@idx_exists=0,'ALTER TABLE bills ADD INDEX idx_bill_dup_hash (duplicate_hash)','SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
