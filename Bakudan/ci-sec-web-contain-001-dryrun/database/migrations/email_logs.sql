-- Email Notification Logs
CREATE TABLE IF NOT EXISTS email_logs (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    email VARCHAR(255) NOT NULL,
    type ENUM('task_assigned','due_today','overdue') NOT NULL,
    event_key VARCHAR(255) NULL,
    subject VARCHAR(500) NOT NULL,
    payload JSON NULL,
    status ENUM('sent','failed') NOT NULL DEFAULT 'sent',
    error_message TEXT NULL,
    retry_count TINYINT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_el_user (user_id),
    INDEX idx_el_type_date (type, created_at),
    INDEX idx_el_event_key (event_key),
    INDEX idx_el_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
