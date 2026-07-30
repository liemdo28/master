-- Phase 2 prep: Asana CEO My Tasks sync mirror fields.
-- Keeps dashboard tasks queryable while preserving Asana source data for 1:1 audit.

CREATE TABLE IF NOT EXISTS asana_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  token TEXT NOT NULL,
  workspace_id VARCHAR(50) NOT NULL,
  workspace_name VARCHAR(200) DEFAULT '',
  sync_target_project_id INT NULL DEFAULT NULL,
  sync_mode VARCHAR(30) NOT NULL DEFAULT 'project',
  last_sync_at TIMESTAMP NULL DEFAULT NULL,
  sync_enabled TINYINT(1) DEFAULT 1,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS asana_permalink_url VARCHAR(500) NULL DEFAULT NULL AFTER asana_gid,
  ADD COLUMN IF NOT EXISTS asana_modified_at DATETIME NULL DEFAULT NULL AFTER asana_permalink_url,
  ADD COLUMN IF NOT EXISTS asana_raw_json LONGTEXT NULL DEFAULT NULL AFTER asana_modified_at;

ALTER TABLE asana_settings
  ADD COLUMN IF NOT EXISTS sync_mode VARCHAR(30) NOT NULL DEFAULT 'project' AFTER sync_target_project_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_task_asana_gid ON tasks(asana_gid);
CREATE UNIQUE INDEX IF NOT EXISTS idx_asana_gid ON projects(asana_gid);

CREATE TABLE IF NOT EXISTS asana_sync_runs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sync_type VARCHAR(30) NOT NULL DEFAULT 'project',
  asana_user_gid VARCHAR(50) NULL DEFAULT NULL,
  asana_user_name VARCHAR(200) NULL DEFAULT NULL,
  workspace_gid VARCHAR(50) NULL DEFAULT NULL,
  dashboard_user_id INT NULL DEFAULT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'success',
  created_tasks INT NOT NULL DEFAULT 0,
  updated_tasks INT NOT NULL DEFAULT 0,
  skipped_tasks INT NOT NULL DEFAULT 0,
  error_message TEXT NULL DEFAULT NULL,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  finished_at TIMESTAMP NULL DEFAULT NULL,
  INDEX idx_asana_sync_runs_started (started_at),
  INDEX idx_asana_sync_runs_user (dashboard_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
