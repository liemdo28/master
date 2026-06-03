// ============================================================
// Agent OS - Database Schema (SQLite)
// ============================================================

export const DB_SCHEMA = `
-- Workers table
CREATE TABLE IF NOT EXISTS workers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  hostname TEXT NOT NULL,
  tailscale_ip TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'offline',
  token TEXT NOT NULL,
  registered_at TEXT NOT NULL,
  last_heartbeat TEXT,
  system_info TEXT,
  current_task_id TEXT
);

-- Tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  priority TEXT NOT NULL DEFAULT 'medium',
  project TEXT NOT NULL,
  created_by TEXT NOT NULL DEFAULT 'ceo',
  worker_id TEXT,
  payload TEXT DEFAULT '{}',
  created_at TEXT NOT NULL,
  started_at TEXT,
  completed_at TEXT,
  error TEXT,
  FOREIGN KEY (worker_id) REFERENCES workers(id)
);

-- Task logs table
CREATE TABLE IF NOT EXISTS task_logs (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  level TEXT NOT NULL DEFAULT 'info',
  message TEXT NOT NULL,
  data TEXT,
  FOREIGN KEY (task_id) REFERENCES tasks(id)
);

-- Task artifacts table
CREATE TABLE IF NOT EXISTS task_artifacts (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  name TEXT NOT NULL,
  path TEXT NOT NULL,
  size INTEGER NOT NULL DEFAULT 0,
  mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
  created_at TEXT NOT NULL,
  FOREIGN KEY (task_id) REFERENCES tasks(id)
);

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  path TEXT NOT NULL UNIQUE,
  languages TEXT DEFAULT '[]',
  frameworks TEXT DEFAULT '[]',
  has_git INTEGER NOT NULL DEFAULT 0,
  has_docker INTEGER NOT NULL DEFAULT 0,
  has_node_modules INTEGER NOT NULL DEFAULT 0,
  package_manager TEXT,
  last_modified TEXT,
  discovered_at TEXT NOT NULL
);

-- Heartbeats table
CREATE TABLE IF NOT EXISTS heartbeats (
  id TEXT PRIMARY KEY,
  worker_id TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  status TEXT NOT NULL,
  system_info TEXT,
  current_task_id TEXT,
  FOREIGN KEY (worker_id) REFERENCES workers(id)
);

-- Executions table (audit trail)
CREATE TABLE IF NOT EXISTS executions (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  worker_id TEXT NOT NULL,
  command TEXT NOT NULL,
  exit_code INTEGER,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  stdout TEXT,
  stderr TEXT,
  FOREIGN KEY (task_id) REFERENCES tasks(id),
  FOREIGN KEY (worker_id) REFERENCES workers(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_worker ON tasks(worker_id);
CREATE INDEX IF NOT EXISTS idx_task_logs_task ON task_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_heartbeats_worker ON heartbeats(worker_id);
CREATE INDEX IF NOT EXISTS idx_executions_task ON executions(task_id);
`;
