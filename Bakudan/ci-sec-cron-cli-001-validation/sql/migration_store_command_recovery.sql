-- ============================================================
-- STORE MODULE RECOVERY MIGRATION
-- CEO Directive: Store Management Recovery (P0)
-- Date: 2026-06-22
-- ============================================================

-- 1. Store Manager Assignments table
CREATE TABLE IF NOT EXISTS store_manager_assignments (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    store_id    INT UNSIGNED NOT NULL,
    user_id     INT UNSIGNED NOT NULL,
    role        ENUM('primary_manager','assistant_manager','viewer') NOT NULL DEFAULT 'primary_manager',
    is_primary  TINYINT(1) NOT NULL DEFAULT 1,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY  uq_store_user (store_id, user_id),
    KEY         idx_sma_store (store_id),
    KEY         idx_sma_user  (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Add missing columns to stores table (idempotent)
SET @dbname = DATABASE();

-- store_code
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'stores' AND COLUMN_NAME = 'store_code');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE stores ADD COLUMN store_code VARCHAR(20) DEFAULT NULL AFTER name', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- store_type
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'stores' AND COLUMN_NAME = 'store_type');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE stores ADD COLUMN store_type ENUM(\'corporate\',\'franchise\') NOT NULL DEFAULT \'corporate\' AFTER type', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- phone
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'stores' AND COLUMN_NAME = 'phone');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE stores ADD COLUMN phone VARCHAR(30) DEFAULT NULL AFTER address', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- email
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'stores' AND COLUMN_NAME = 'email');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE stores ADD COLUMN email VARCHAR(255) DEFAULT NULL AFTER phone', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- region
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'stores' AND COLUMN_NAME = 'region');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE stores ADD COLUMN region VARCHAR(100) DEFAULT NULL AFTER store_type', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- operating_hours
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'stores' AND COLUMN_NAME = 'operating_hours');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE stores ADD COLUMN operating_hours VARCHAR(255) DEFAULT NULL AFTER region', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- manager_id (may already exist from franchise migration)
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'stores' AND COLUMN_NAME = 'manager_id');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE stores ADD COLUMN manager_id INT UNSIGNED DEFAULT NULL AFTER operating_hours', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- assistant_manager_id
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'stores' AND COLUMN_NAME = 'assistant_manager_id');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE stores ADD COLUMN assistant_manager_id INT UNSIGNED DEFAULT NULL AFTER manager_id', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- opened_at (may already exist)
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'stores' AND COLUMN_NAME = 'opened_at');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE stores ADD COLUMN opened_at DATE DEFAULT NULL AFTER assistant_manager_id', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- status
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'stores' AND COLUMN_NAME = 'status');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE stores ADD COLUMN status ENUM(\'active\',\'inactive\',\'opening_soon\',\'closed\') NOT NULL DEFAULT \'active\' AFTER is_active', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 3. Seed store_manager_assignments from existing manager_id on stores
INSERT IGNORE INTO store_manager_assignments (store_id, user_id, role, is_primary, created_at)
SELECT s.id, s.manager_id, 'primary_manager', 1, NOW()
FROM stores s
WHERE s.manager_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM store_manager_assignments sma
      WHERE sma.store_id = s.id AND sma.user_id = s.manager_id
  );

-- 4. Ensure store_health_scores table exists (StoreCommand model creates it, but belt-and-suspenders)
CREATE TABLE IF NOT EXISTS store_health_scores (
    id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    store_id      INT NOT NULL,
    score         DECIMAL(5,2) DEFAULT 100.00,
    grade         CHAR(1) DEFAULT 'A',
    metrics       JSON DEFAULT NULL,
    recorded_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_health_store (store_id),
    INDEX idx_health_date (recorded_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4b. Fix: add missing grade column to existing store_health_scores table
-- (The table may have been created before grade was added to the CREATE TABLE)
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'store_health_scores' AND COLUMN_NAME = 'grade');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE store_health_scores ADD COLUMN grade CHAR(1) DEFAULT \'A\' AFTER score', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 4c. Backfill grade values for existing records
UPDATE store_health_scores SET grade = CASE
    WHEN score >= 90 THEN 'A'
    WHEN score >= 80 THEN 'B'
    WHEN score >= 70 THEN 'C'
    WHEN score >= 60 THEN 'D'
    ELSE 'F'
END WHERE grade IS NULL OR grade = '';
