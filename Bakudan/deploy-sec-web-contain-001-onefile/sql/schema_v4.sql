-- v4: Asana auto-sync support

-- Track which projects/tasks came from Asana (prevent duplicates on re-sync)
ALTER TABLE projects ADD COLUMN asana_gid VARCHAR(50) NULL DEFAULT NULL;
ALTER TABLE tasks ADD COLUMN asana_gid VARCHAR(50) NULL DEFAULT NULL;
ALTER TABLE projects ADD UNIQUE INDEX idx_asana_gid (asana_gid);
ALTER TABLE tasks ADD UNIQUE INDEX idx_task_asana_gid (asana_gid);

-- Store Asana sync settings (shared across all users)
CREATE TABLE IF NOT EXISTS asana_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    token TEXT NOT NULL,
    workspace_id VARCHAR(50) NOT NULL,
    workspace_name VARCHAR(200) DEFAULT '',
    last_sync_at TIMESTAMP NULL DEFAULT NULL,
    sync_enabled TINYINT(1) DEFAULT 1,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id)
);
