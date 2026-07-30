-- Telegram Integration: 3 tables
-- Safe to re-run (IF NOT EXISTS)

CREATE TABLE IF NOT EXISTS telegram_users (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    telegram_chat_id VARCHAR(100) NOT NULL,
    telegram_user_id VARCHAR(100) NULL DEFAULT NULL,
    telegram_username VARCHAR(255) NULL DEFAULT NULL,
    first_name VARCHAR(255) NULL DEFAULT NULL,
    last_name VARCHAR(255) NULL DEFAULT NULL,
    connect_code VARCHAR(20) NULL DEFAULT NULL,
    connect_code_expires_at DATETIME NULL DEFAULT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_telegram_user_id (user_id),
    UNIQUE KEY uq_telegram_chat_id (telegram_chat_id),
    INDEX idx_connect_code (connect_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS telegram_notification_logs (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL DEFAULT NULL,
    telegram_chat_id VARCHAR(100) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    related_entity_type VARCHAR(50) NULL DEFAULT NULL,
    related_entity_id BIGINT UNSIGNED NULL DEFAULT NULL,
    payload JSON NULL DEFAULT NULL,
    response_payload JSON NULL DEFAULT NULL,
    status ENUM('pending','sent','failed') NOT NULL DEFAULT 'pending',
    error_message TEXT NULL DEFAULT NULL,
    sent_at DATETIME NULL DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_tnl_user (user_id),
    INDEX idx_tnl_chat (telegram_chat_id),
    INDEX idx_tnl_type (event_type),
    INDEX idx_tnl_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS telegram_inbound_logs (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    telegram_chat_id VARCHAR(100) NOT NULL,
    telegram_user_id VARCHAR(100) NULL DEFAULT NULL,
    dashboard_user_id INT NULL DEFAULT NULL,
    raw_message TEXT NOT NULL,
    parsed_intent VARCHAR(100) NULL DEFAULT NULL,
    parsed_payload JSON NULL DEFAULT NULL,
    processing_status ENUM('pending','processed','failed') NOT NULL DEFAULT 'pending',
    error_message TEXT NULL DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processed_at DATETIME NULL DEFAULT NULL,
    INDEX idx_til_chat (telegram_chat_id),
    INDEX idx_til_user (dashboard_user_id),
    INDEX idx_til_status (processing_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
