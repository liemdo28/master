-- ============================================
-- TaskFlow Mobile API v1 - Database Migration
-- Run on: MySQL 5.7+ / MariaDB 10.3+
-- ============================================
-- Usage: mysql -u liemdo -p taskflow_db < sql/schema_mobile_v1.sql
-- ============================================

USE taskflow_db;

-- --------------------------------------------------------
-- 1. api_tokens — token-based auth thay thế session
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS api_tokens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    device_id VARCHAR(100) DEFAULT NULL,
    device_name VARCHAR(200) DEFAULT NULL,
    platform ENUM('android','ios','web') DEFAULT 'web',
    access_token VARCHAR(64) NOT NULL,
    refresh_token VARCHAR(64) NOT NULL,
    access_token_expires_at TIMESTAMP NOT NULL,
    refresh_token_expires_at TIMESTAMP NOT NULL,
    last_used_at TIMESTAMP NULL DEFAULT NULL,
    revoked_at TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_access_token (access_token(32)),
    INDEX idx_refresh_token (refresh_token(32)),
    INDEX idx_user_active (user_id, revoked_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------
-- 2. devices — quản lý thiết bị + push tokens
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS devices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    platform ENUM('android','ios') NOT NULL,
    device_id VARCHAR(100) NOT NULL,
    device_name VARCHAR(200) DEFAULT NULL,
    app_version VARCHAR(20) DEFAULT NULL,
    os_version VARCHAR(50) DEFAULT NULL,
    push_token VARCHAR(255) DEFAULT NULL,
    push_token_updated_at TIMESTAMP NULL DEFAULT NULL,
    is_active TINYINT(1) DEFAULT 1,
    last_active_at TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY uk_user_device (user_id, device_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------
-- 3. notification_deliveries — tracking push/email delivery
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS notification_deliveries (
    id INT AUTO_INCREMENT PRIMARY KEY,
    notification_id INT NOT NULL,
    channel ENUM('email','push','in_app') NOT NULL,
    delivery_status ENUM('pending','sent','delivered','failed') DEFAULT 'pending',
    provider_response TEXT DEFAULT NULL,
    sent_at TIMESTAMP NULL DEFAULT NULL,
    delivered_at TIMESTAMP NULL DEFAULT NULL,
    failed_at TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_notification_channel (notification_id, channel)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------
-- 4. Thêm cột vào bảng notifications
-- --------------------------------------------------------
-- is_read (mặc định 0)
SET @col_exists = (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'notifications'
      AND column_name = 'is_read'
);
SET @sql = IF(@col_exists = 0,
    'ALTER TABLE notifications ADD COLUMN is_read TINYINT(1) DEFAULT 0 AFTER message',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- deep_link
SET @col_exists = (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'notifications'
      AND column_name = 'deep_link'
);
SET @sql = IF(@col_exists = 0,
    'ALTER TABLE notifications ADD COLUMN deep_link VARCHAR(255) DEFAULT NULL AFTER is_read',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- --------------------------------------------------------
-- 5. Thêm cột vào bảng users cho mobile settings
-- --------------------------------------------------------
SET @col_exists = (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'users'
      AND column_name = 'preferred_language'
);
SET @sql = IF(@col_exists = 0,
    'ALTER TABLE users ADD COLUMN preferred_language VARCHAR(5) DEFAULT ''vi'' AFTER avatar',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'users'
      AND column_name = 'notification_settings'
);
SET @sql = IF(@col_exists = 0,
    'ALTER TABLE users ADD COLUMN notification_settings JSON DEFAULT NULL AFTER email_notifications',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- --------------------------------------------------------
-- 6. Thêm cột avatar_url vào attachments (URL thay vì chỉ path)
-- --------------------------------------------------------
SET @col_exists = (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'attachments'
      AND column_name = 'file_url'
);
SET @sql = IF(@col_exists = 0,
    'ALTER TABLE attachments ADD COLUMN file_url VARCHAR(500) DEFAULT NULL AFTER original_name',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- --------------------------------------------------------
-- 7. Tạo bảng rate_limits cho login throttling
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS rate_limits (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ip_address VARCHAR(45) NOT NULL,
    action VARCHAR(30) NOT NULL DEFAULT 'login',
    attempts INT DEFAULT 1,
    locked_until TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_ip_action (ip_address, action),
    INDEX idx_locked (locked_until)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------
-- 8. Audit log cho API (login, task changes)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT DEFAULT NULL,
    action VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) DEFAULT NULL,
    entity_id INT DEFAULT NULL,
    device_id VARCHAR(100) DEFAULT NULL,
    ip_address VARCHAR(45) DEFAULT NULL,
    user_agent TEXT DEFAULT NULL,
    metadata JSON DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_user_action (user_id, action),
    INDEX idx_entity (entity_type, entity_id),
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
