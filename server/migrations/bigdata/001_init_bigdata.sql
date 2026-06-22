-- Mi Big Data Foundation — Schema Migration v1
-- 2026-06-10

BEGIN;

-- ── 1. data_sources ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS data_sources (
  id               SERIAL PRIMARY KEY,
  name             VARCHAR(128) NOT NULL UNIQUE,
  type             VARCHAR(64)  NOT NULL, -- 'dashboard','quickbooks','doordash','ubereats','yelp','review','browser','manual','gmail','calendar','drive','asana'
  system           VARCHAR(128),          -- human-readable system name
  connection_type  VARCHAR(32)  NOT NULL DEFAULT 'push', -- 'push','pull','file','webhook'
  status           VARCHAR(32)  NOT NULL DEFAULT 'active', -- 'active','inactive','error','paused'
  owner            VARCHAR(128),
  description      TEXT,
  config_json      JSONB,                 -- non-secret config (URLs, field mappings)
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 2. ingestion_jobs ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ingestion_jobs (
  id                BIGSERIAL PRIMARY KEY,
  source_id         INTEGER NOT NULL REFERENCES data_sources(id),
  job_type          VARCHAR(64) NOT NULL, -- 'full_sync','incremental','manual','file_upload'
  status            VARCHAR(32) NOT NULL DEFAULT 'pending', -- 'pending','running','completed','failed','skipped'
  started_at        TIMESTAMPTZ,
  finished_at       TIMESTAMPTZ,
  records_ingested  INTEGER NOT NULL DEFAULT 0,
  records_failed    INTEGER NOT NULL DEFAULT 0,
  error_message     TEXT,
  metadata_json     JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_source    ON ingestion_jobs(source_id);
CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_status    ON ingestion_jobs(status);
CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_started   ON ingestion_jobs(started_at DESC);

-- ── 3. raw_objects ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS raw_objects (
  id              BIGSERIAL PRIMARY KEY,
  source_id       INTEGER NOT NULL REFERENCES data_sources(id),
  object_type     VARCHAR(64) NOT NULL, -- 'json','csv','pdf','image','screenshot','invoice','log','html'
  bucket          VARCHAR(128) NOT NULL,
  object_key      TEXT NOT NULL,
  checksum        CHAR(64),             -- SHA-256 hex
  file_size       BIGINT,
  content_type    VARCHAR(128),
  captured_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata_json   JSONB,
  UNIQUE (bucket, object_key)
);

CREATE INDEX IF NOT EXISTS idx_raw_objects_source      ON raw_objects(source_id);
CREATE INDEX IF NOT EXISTS idx_raw_objects_checksum    ON raw_objects(checksum);
CREATE INDEX IF NOT EXISTS idx_raw_objects_captured    ON raw_objects(captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_raw_objects_type        ON raw_objects(object_type);

-- ── 4. normalized_events ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS normalized_events (
  id              BIGSERIAL PRIMARY KEY,
  source_id       INTEGER NOT NULL REFERENCES data_sources(id),
  store_id        VARCHAR(64),          -- 'bakudan','raw','all'
  event_type      VARCHAR(64) NOT NULL, -- 'sale','refund','review','task','approval','log','dispute','invoice','penalty','notification'
  event_time      TIMESTAMPTZ NOT NULL,
  actor           VARCHAR(128),
  title           TEXT,
  description     TEXT,
  amount          NUMERIC(12,2),
  status          VARCHAR(64),
  raw_object_id   BIGINT REFERENCES raw_objects(id),
  metadata_json   JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_source      ON normalized_events(source_id);
CREATE INDEX IF NOT EXISTS idx_events_store       ON normalized_events(store_id);
CREATE INDEX IF NOT EXISTS idx_events_type        ON normalized_events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_time        ON normalized_events(event_time DESC);
CREATE INDEX IF NOT EXISTS idx_events_status      ON normalized_events(status);

-- ── 5. memory_chunks ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS memory_chunks (
  id              BIGSERIAL PRIMARY KEY,
  source_id       INTEGER REFERENCES data_sources(id),
  raw_object_id   BIGINT REFERENCES raw_objects(id),
  chunk_type      VARCHAR(64) NOT NULL DEFAULT 'text', -- 'text','event','decision','fact','review','log'
  title           TEXT,
  text            TEXT NOT NULL,
  embedding_id    TEXT,                 -- Qdrant point ID
  store_id        VARCHAR(64),
  tags            TEXT[],
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chunks_source       ON memory_chunks(source_id);
CREATE INDEX IF NOT EXISTS idx_chunks_type         ON memory_chunks(chunk_type);
CREATE INDEX IF NOT EXISTS idx_chunks_store        ON memory_chunks(store_id);
CREATE INDEX IF NOT EXISTS idx_chunks_embedding    ON memory_chunks(embedding_id);

-- ── 6. data_quality_checks ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS data_quality_checks (
  id            BIGSERIAL PRIMARY KEY,
  source_id     INTEGER REFERENCES data_sources(id),
  check_name    VARCHAR(128) NOT NULL,
  status        VARCHAR(32) NOT NULL,  -- 'pass','warn','fail','error'
  severity      VARCHAR(32) NOT NULL DEFAULT 'info', -- 'info','warn','critical'
  result_json   JSONB,
  checked_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quality_source   ON data_quality_checks(source_id);
CREATE INDEX IF NOT EXISTS idx_quality_status   ON data_quality_checks(status);
CREATE INDEX IF NOT EXISTS idx_quality_checked  ON data_quality_checks(checked_at DESC);

-- ── 7. audit_log ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id            BIGSERIAL PRIMARY KEY,
  actor         VARCHAR(128) NOT NULL DEFAULT 'system',
  action        VARCHAR(128) NOT NULL, -- 'ingest','delete','update','register_source','redact','query'
  entity_type   VARCHAR(64),           -- 'raw_object','normalized_event','source','chunk'
  entity_id     TEXT,
  before_json   JSONB,
  after_json    JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_actor    ON audit_log(actor);
CREATE INDEX IF NOT EXISTS idx_audit_action   ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_created  ON audit_log(created_at DESC);

-- ── Seed: built-in data sources ───────────────────────────────────────────────
INSERT INTO data_sources (name, type, system, connection_type, description) VALUES
  ('dashboard-bakudan',    'dashboard',   'dashboard.bakudanramen.com', 'pull',    'Bakudan Ramen dashboard tasks, approvals, penalties'),
  ('quickbooks-bakudan',   'quickbooks',  'QuickBooks Online — Bakudan', 'pull',   'QB sales receipts, bank feed, reconciliation logs'),
  ('quickbooks-raw',       'quickbooks',  'QuickBooks Online — Raw Sushi', 'pull', 'QB sales receipts, bank feed, reconciliation logs'),
  ('doordash',             'doordash',    'DoorDash Merchant Portal',   'pull',    'DoorDash orders, disputes, payout reports'),
  ('review-automation',    'review',      'Review Automation System',   'push',    'Google/Yelp reviews, reply status, escalations'),
  ('browser-evidence',     'browser',     'Browser Automation Agent',   'push',    'Screenshots, browser action JSON, dispute evidence'),
  ('manual-upload',        'manual',      'Manual CSV/Invoice Upload',  'push',    'Staff-uploaded CSVs, invoices, PDFs'),
  ('gmail',                'gmail',       'Gmail — CEO Account',        'pull',    'Email metadata, attachments'),
  ('google-drive',         'drive',       'Google Drive',               'pull',    'Shared files, reports, spreadsheets'),
  ('asana',                'asana',       'Asana Projects',             'pull',    'Project tasks, assignments, deadlines')
ON CONFLICT (name) DO NOTHING;

COMMIT;
