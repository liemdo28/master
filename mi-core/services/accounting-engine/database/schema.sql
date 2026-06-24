-- accounting-engine/database/schema.sql
-- WAL mode and performance PRAGMAs are set programmatically in DatabaseManager.js

-- Sessions: tracks agent/QA sessions
CREATE TABLE IF NOT EXISTS sessions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id   TEXT    UNIQUE NOT NULL,
  project_name TEXT,
  started_at   TEXT    NOT NULL,
  ended_at     TEXT,
  status       TEXT    NOT NULL DEFAULT 'active',  -- active|completed|failed|aborted
  metadata     TEXT    DEFAULT '{}'                -- JSON
);

-- Resource metrics: collected in batches every 5–15 s
CREATE TABLE IF NOT EXISTS resource_metrics (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id       TEXT,
  timestamp        TEXT    NOT NULL,
  cpu_pct          REAL    DEFAULT 0,
  memory_mb        REAL    DEFAULT 0,
  heap_used_mb     REAL    DEFAULT 0,
  heap_total_mb    REAL    DEFAULT 0,
  rss_mb           REAL    DEFAULT 0,
  memory_delta_pct REAL    DEFAULT 0,
  gpu_mb           REAL,
  disk_free_mb     REAL
);

-- Audit ledger: hash-chain immutable — never UPDATE or DELETE rows here
CREATE TABLE IF NOT EXISTS audit_ledger (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  sequence       INTEGER UNIQUE NOT NULL,
  prev_hash      TEXT    NOT NULL,
  current_hash   TEXT    NOT NULL,
  event_type     TEXT    NOT NULL,
  actor          TEXT    DEFAULT 'system',
  payload        TEXT    NOT NULL,   -- JSON (raw, may contain masked values)
  masked_payload TEXT    NOT NULL,   -- JSON with secrets replaced by [MASKED]
  timestamp      TEXT    NOT NULL
);

-- Patch ledger: full lifecycle with lineage
CREATE TABLE IF NOT EXISTS patch_ledger (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  patch_id          TEXT    UNIQUE NOT NULL,
  parent_patch      TEXT,                          -- lineage: ID of previous patch this builds on
  branch_name       TEXT,
  deployment_target TEXT    DEFAULT 'local',
  affected_modules  TEXT    DEFAULT '[]',          -- JSON array of module names
  task              TEXT    NOT NULL,
  status            TEXT    NOT NULL DEFAULT 'proposed', -- proposed|applied|rejected|rolled_back|failed
  risk_level        TEXT    DEFAULT 'low',         -- low|medium|high
  rollback_reason   TEXT,
  approval_status   TEXT    DEFAULT 'pending',     -- pending|approved|rejected
  approved_by       TEXT,
  files_changed     TEXT    DEFAULT '[]',          -- JSON array
  created_at        TEXT    NOT NULL,
  applied_at        TEXT,
  rolled_back_at    TEXT
);

-- QA accounting: tracks cost and regression per run
CREATE TABLE IF NOT EXISTS qa_runs (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id              TEXT    UNIQUE NOT NULL,
  session_id          TEXT,
  project_name        TEXT,
  started_at          TEXT    NOT NULL,
  completed_at        TEXT,
  total_tests         INTEGER DEFAULT 0,
  failed_tests        INTEGER DEFAULT 0,
  flaky_tests         INTEGER DEFAULT 0,
  qa_reruns           INTEGER DEFAULT 0,
  regression_score    REAL    DEFAULT 0.0,         -- 0.0–1.0, lower is better
  fix_time_minutes    REAL    DEFAULT 0.0,
  repeated_issue_key  TEXT,                        -- dedup key for known recurring failures
  build_success       INTEGER DEFAULT 0,           -- boolean 0|1
  test_success        INTEGER DEFAULT 0,
  qa_score            REAL,                        -- 0–100
  qa_grade            TEXT,                        -- PASS|WARNING|FAIL
  total_cost_cents    INTEGER DEFAULT 0
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_resource_metrics_session  ON resource_metrics(session_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_ledger_sequence     ON audit_ledger(sequence);
CREATE INDEX IF NOT EXISTS idx_audit_ledger_type         ON audit_ledger(event_type, timestamp);
CREATE INDEX IF NOT EXISTS idx_patch_ledger_status       ON patch_ledger(status, created_at);
CREATE INDEX IF NOT EXISTS idx_patch_ledger_parent       ON patch_ledger(parent_patch);
CREATE INDEX IF NOT EXISTS idx_qa_runs_session           ON qa_runs(session_id, started_at);
CREATE INDEX IF NOT EXISTS idx_sessions_status           ON sessions(status, started_at);
