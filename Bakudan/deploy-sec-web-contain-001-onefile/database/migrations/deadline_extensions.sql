-- Deadline Extensions System
CREATE TABLE IF NOT EXISTS deadline_extensions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    task_id INT NOT NULL,
    requested_by INT NOT NULL,
    original_due_date DATE NOT NULL,
    requested_due_date DATE NOT NULL,
    extension_days INT NOT NULL,
    reason TEXT NOT NULL,
    status ENUM('pending','approved','rejected','auto_approved','expired') NOT NULL DEFAULT 'pending',
    reviewed_by INT NULL DEFAULT NULL,
    reviewed_at DATETIME NULL DEFAULT NULL,
    review_note TEXT NULL DEFAULT NULL,
    auto_approved TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_task_id (task_id),
    INDEX idx_requested_by (requested_by),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS monthly_extension_usage (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    year_month CHAR(7) NOT NULL COMMENT 'YYYY-MM format',
    used_count INT NOT NULL DEFAULT 0,
    quota INT NOT NULL DEFAULT 5,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_user_month (user_id, year_month)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS deadline_extension_audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    extension_id INT NOT NULL,
    task_id INT NOT NULL,
    actor_id INT NOT NULL,
    action ENUM('created','approved','rejected','auto_approved','expired','cancelled') NOT NULL,
    old_status VARCHAR(32) NULL DEFAULT NULL,
    new_status VARCHAR(32) NULL DEFAULT NULL,
    note TEXT NULL DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_extension_id (extension_id),
    INDEX idx_task_id (task_id),
    INDEX idx_actor_id (actor_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
