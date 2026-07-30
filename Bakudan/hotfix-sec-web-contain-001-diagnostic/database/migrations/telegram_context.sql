-- Per-chat conversation context (last task reference, TTL-based)
CREATE TABLE IF NOT EXISTS telegram_context (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    telegram_chat_id VARCHAR(64) NOT NULL,
    last_task_id INT NULL,
    last_task_title VARCHAR(500) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_tc_chat (telegram_chat_id),
    INDEX idx_tc_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
