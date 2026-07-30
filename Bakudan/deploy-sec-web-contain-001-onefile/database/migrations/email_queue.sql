-- Email Queue for async sending
CREATE TABLE IF NOT EXISTS email_queue (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    to_email VARCHAR(255) NOT NULL,
    to_name VARCHAR(255) NOT NULL DEFAULT '',
    subject VARCHAR(500) NOT NULL,
    body LONGTEXT NOT NULL,
    status ENUM('pending','sending','sent','failed') NOT NULL DEFAULT 'pending',
    attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
    last_error TEXT NULL,
    event_type VARCHAR(100) NOT NULL DEFAULT 'general',
    related_entity_type VARCHAR(100) NULL,
    related_entity_id INT NULL,
    user_id INT NULL,
    event_key VARCHAR(255) NULL,
    payload JSON NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    sent_at DATETIME NULL,
    INDEX idx_eq_status_attempts (status, attempts),
    INDEX idx_eq_event_key (event_key),
    INDEX idx_eq_created (created_at),
    INDEX idx_eq_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
