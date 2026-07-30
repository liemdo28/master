-- schema_v8.sql — Deadline Extension System
-- Run after schema_v7.sql

CREATE TABLE IF NOT EXISTS deadline_extensions (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    task_id       INT           NOT NULL,
    user_id       INT           NOT NULL,
    old_deadline  DATE          NOT NULL,
    new_deadline  DATE          NOT NULL,
    type          ENUM('self','request') NOT NULL,
    status        ENUM('auto_approved','pending','approved','rejected') NOT NULL DEFAULT 'pending',
    reason        TEXT          NULL,
    reject_reason TEXT          NULL,
    approved_by   INT           NULL,
    approved_at   DATETIME      NULL,
    created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id)     REFERENCES tasks(id)  ON DELETE CASCADE,
    FOREIGN KEY (user_id)     REFERENCES users(id)  ON DELETE CASCADE,
    FOREIGN KEY (approved_by) REFERENCES users(id)  ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX IF NOT EXISTS idx_ext_task    ON deadline_extensions(task_id);
CREATE INDEX IF NOT EXISTS idx_ext_user    ON deadline_extensions(user_id);
CREATE INDEX IF NOT EXISTS idx_ext_status  ON deadline_extensions(status);
CREATE INDEX IF NOT EXISTS idx_ext_created ON deadline_extensions(created_at);

CREATE TABLE IF NOT EXISTS monthly_extension_usage (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    user_id         INT          NOT NULL,
    month           VARCHAR(7)   NOT NULL,   -- YYYY-MM
    extension_count INT          NOT NULL DEFAULT 0,
    updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_usage_user_month (user_id, month),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
