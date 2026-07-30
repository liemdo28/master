-- Mi-Core Enterprise Queue + Governance Schema
-- 2026-06-11

BEGIN;

CREATE TABLE IF NOT EXISTS queue_jobs (
  id              BIGSERIAL PRIMARY KEY,
  queue_name      VARCHAR(96) NOT NULL DEFAULT 'default',
  job_type        VARCHAR(96) NOT NULL,
  status          VARCHAR(32) NOT NULL DEFAULT 'pending',
  priority        INTEGER NOT NULL DEFAULT 100,
  attempts        INTEGER NOT NULL DEFAULT 0,
  max_attempts    INTEGER NOT NULL DEFAULT 3,
  payload_json    JSONB NOT NULL DEFAULT '{}'::jsonb,
  result_json     JSONB,
  error_message   TEXT,
  run_after       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_at       TIMESTAMPTZ,
  locked_by       VARCHAR(128),
  created_by      VARCHAR(128) NOT NULL DEFAULT 'system',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_queue_jobs_claim
  ON queue_jobs(status, run_after, priority, created_at);
CREATE INDEX IF NOT EXISTS idx_queue_jobs_type
  ON queue_jobs(job_type);
CREATE INDEX IF NOT EXISTS idx_queue_jobs_created
  ON queue_jobs(created_at DESC);

CREATE TABLE IF NOT EXISTS queue_dead_letters (
  id              BIGSERIAL PRIMARY KEY,
  job_id          BIGINT,
  queue_name      VARCHAR(96),
  job_type        VARCHAR(96),
  payload_json    JSONB,
  error_message   TEXT,
  attempts        INTEGER,
  moved_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS provider_call_audit (
  id              BIGSERIAL PRIMARY KEY,
  operation       VARCHAR(64) NOT NULL,
  primary_provider VARCHAR(64),
  selected_provider VARCHAR(64),
  model           VARCHAR(128),
  status          VARCHAR(32) NOT NULL,
  latency_ms      INTEGER,
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS permission_audit (
  id              BIGSERIAL PRIMARY KEY,
  actor           VARCHAR(128) NOT NULL,
  action          VARCHAR(128) NOT NULL,
  resource        TEXT NOT NULL,
  decision        VARCHAR(32) NOT NULL,
  reason          TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMIT;
