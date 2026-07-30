-- Phase 21 — Executive Intelligence Layer
-- Migration 001: Core executive tables with pgvector
--
-- Run: psql mi_exec -f 001_executive_tables.sql
-- Or via migration runner: node dist/db/migrate.js

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- ── Objective Runs ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS objective_runs (
  id              TEXT PRIMARY KEY,
  objective_text  TEXT NOT NULL,
  channel         TEXT NOT NULL DEFAULT 'api',
  status          TEXT NOT NULL DEFAULT 'pending',
  owner           TEXT NOT NULL DEFAULT 'ceo',
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at        TIMESTAMPTZ,
  final_confidence REAL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_objective_runs_status ON objective_runs(status);
CREATE INDEX IF NOT EXISTS idx_objective_runs_started ON objective_runs(started_at DESC);

-- ── Intent Hypotheses ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS intent_hypotheses (
  id                SERIAL PRIMARY KEY,
  objective_run_id  TEXT NOT NULL REFERENCES objective_runs(id) ON DELETE CASCADE,
  intent            TEXT NOT NULL,
  confidence        REAL NOT NULL DEFAULT 0,
  rationale         TEXT,
  missing_info      JSONB DEFAULT '[]',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_intent_hypotheses_run ON intent_hypotheses(objective_run_id);

-- ── Plans ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS plans (
  id                SERIAL PRIMARY KEY,
  objective_run_id  TEXT NOT NULL REFERENCES objective_runs(id) ON DELETE CASCADE,
  version           INTEGER NOT NULL DEFAULT 1,
  tasks_json        JSONB NOT NULL DEFAULT '[]',
  dependencies_json JSONB NOT NULL DEFAULT '[]',
  risk_level        TEXT NOT NULL DEFAULT 'low',
  success_criteria  JSONB DEFAULT '[]',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plans_run ON plans(objective_run_id);

-- ── Reasoning Frames ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS reasoning_frames (
  id                SERIAL PRIMARY KEY,
  objective_run_id  TEXT NOT NULL REFERENCES objective_runs(id) ON DELETE CASCADE,
  frame_type        TEXT NOT NULL,
  hypotheses_json   JSONB DEFAULT '[]',
  signals_json      JSONB DEFAULT '[]',
  confidence        REAL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reasoning_frames_run ON reasoning_frames(objective_run_id);

-- ── Decision Records ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS decision_records (
  id                      SERIAL PRIMARY KEY,
  objective_run_id        TEXT NOT NULL REFERENCES objective_runs(id) ON DELETE CASCADE,
  priority                TEXT NOT NULL DEFAULT 'medium',
  impact_scores_json      JSONB DEFAULT '{}',
  recommended_actions_json JSONB DEFAULT '[]',
  confidence              REAL DEFAULT 0,
  reasoning               TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_decision_records_run ON decision_records(objective_run_id);

-- ── Evidence Packets ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS evidence_packets (
  id              TEXT PRIMARY KEY,
  objective_run_id TEXT NOT NULL REFERENCES objective_runs(id) ON DELETE CASCADE,
  source_type     TEXT NOT NULL,
  source_ref      TEXT NOT NULL,
  summary         TEXT,
  sha256          TEXT,
  captured_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_only       BOOLEAN NOT NULL DEFAULT TRUE,
  artifact_path   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_evidence_packets_run ON evidence_packets(objective_run_id);

-- ── QA Gates ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS qa_gates (
  id                SERIAL PRIMARY KEY,
  objective_run_id  TEXT NOT NULL REFERENCES objective_runs(id) ON DELETE CASCADE,
  gate_name         TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pending',
  details_json      JSONB DEFAULT '{}',
  checked_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qa_gates_run ON qa_gates(objective_run_id);

-- ── Executive Briefs ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS executive_briefs (
  id                SERIAL PRIMARY KEY,
  objective_run_id  TEXT NOT NULL REFERENCES objective_runs(id) ON DELETE CASCADE,
  brief_markdown    TEXT,
  brief_json        JSONB DEFAULT '{}',
  confidence        REAL DEFAULT 0,
  sent_to_ceo       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_executive_briefs_run ON executive_briefs(objective_run_id);

-- ── Memory Items (with vector embedding) ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS memory_items (
  id                TEXT PRIMARY KEY,
  namespace         TEXT NOT NULL DEFAULT 'default',
  kind              TEXT NOT NULL DEFAULT 'general',
  title             TEXT NOT NULL,
  body              TEXT,
  embedding         vector(384),
  tags              JSONB DEFAULT '[]',
  freshness_date    TIMESTAMPTZ,
  source_refs_json  JSONB DEFAULT '[]',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_memory_items_namespace ON memory_items(namespace);
CREATE INDEX IF NOT EXISTS idx_memory_items_kind ON memory_items(kind);

-- Vector similarity search index (IVFFlat for small-medium datasets)
-- Rebuild after inserting significant data: REINDEX INDEX idx_memory_items_embedding;
CREATE INDEX IF NOT EXISTS idx_memory_items_embedding ON memory_items
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 10);

-- ── Memory Claims ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS memory_claims (
  id                  SERIAL PRIMARY KEY,
  memory_item_id      TEXT NOT NULL REFERENCES memory_items(id) ON DELETE CASCADE,
  claim_text          TEXT NOT NULL,
  evidence_refs_json  JSONB DEFAULT '[]',
  confidence          REAL DEFAULT 0,
  contradiction_refs_json JSONB DEFAULT '[]',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_memory_claims_item ON memory_claims(memory_item_id);

-- ── Skill Manifests ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS skill_manifests (
  name                TEXT PRIMARY KEY,
  version             TEXT NOT NULL DEFAULT '1.0.0',
  scope               JSONB DEFAULT '[]',
  approved            BOOLEAN NOT NULL DEFAULT FALSE,
  capabilities_json   JSONB DEFAULT '[]',
  hash                TEXT,
  policy_json         JSONB DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Skill Runs ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS skill_runs (
  id                  SERIAL PRIMARY KEY,
  skill_name          TEXT NOT NULL REFERENCES skill_manifests(name),
  objective_run_id    TEXT REFERENCES objective_runs(id) ON DELETE SET NULL,
  status              TEXT NOT NULL DEFAULT 'pending',
  inputs_json         JSONB DEFAULT '{}',
  outputs_json        JSONB DEFAULT '{}',
  evidence_refs_json  JSONB DEFAULT '[]',
  started_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at            TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_skill_runs_skill ON skill_runs(skill_name);
CREATE INDEX IF NOT EXISTS idx_skill_runs_run ON skill_runs(objective_run_id);

-- ── Schema Migrations Tracker ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS schema_migrations (
  version     TEXT PRIMARY KEY,
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO schema_migrations (version) VALUES ('001_executive_tables')
  ON CONFLICT (version) DO NOTHING;
