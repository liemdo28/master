-- ============================================================
-- 2026_06_10_duplicate_control.sql
-- Duplicate detection tables + task duplicate columns (MySQL 5.7 compatible)
-- ============================================================

CREATE TABLE IF NOT EXISTS duplicate_groups (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  entity_type     ENUM('bill','task','payment') NOT NULL,
  duplicate_hash  VARCHAR(64) NOT NULL,
  canonical_id    INT NULL,
  status          ENUM('pending','resolved','ignored') NOT NULL DEFAULT 'pending',
  detected_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at     DATETIME NULL,
  resolved_by     INT NULL,
  INDEX idx_dg_hash   (duplicate_hash),
  INDEX idx_dg_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS duplicate_group_items (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  group_id     INT NOT NULL,
  entity_id    INT NOT NULL,
  is_canonical TINYINT(1) NOT NULL DEFAULT 0,
  FOREIGN KEY (group_id) REFERENCES duplicate_groups(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS duplicate_resolution_log (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  group_id      INT NOT NULL,
  action        ENUM('archived','merged','ignored','marked_not_duplicate') NOT NULL,
  performed_by  INT NULL,
  notes         TEXT NULL,
  performed_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Add columns to tasks (MySQL 5.7 compatible — no ADD COLUMN IF NOT EXISTS)
SET @s = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='tasks' AND COLUMN_NAME='duplicate_hash')=0, 'ALTER TABLE tasks ADD COLUMN duplicate_hash VARCHAR(64) NULL', 'SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @s = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='tasks' AND COLUMN_NAME='archived_duplicate')=0, 'ALTER TABLE tasks ADD COLUMN archived_duplicate TINYINT(1) NOT NULL DEFAULT 0', 'SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @s = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='tasks' AND COLUMN_NAME='merged_into_task_id')=0, 'ALTER TABLE tasks ADD COLUMN merged_into_task_id INT NULL', 'SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @s = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='tasks' AND COLUMN_NAME='duplicate_reason')=0, 'ALTER TABLE tasks ADD COLUMN duplicate_reason VARCHAR(255) NULL', 'SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @idx_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='tasks' AND INDEX_NAME='idx_task_dup_hash');
SET @s = IF(@idx_exists=0,'ALTER TABLE tasks ADD INDEX idx_task_dup_hash (duplicate_hash)','SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
