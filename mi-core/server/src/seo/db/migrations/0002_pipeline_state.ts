/**
 * Migration 0002 — article pipeline state.
 *
 * Backs the article-generation pipeline state machine (see
 * ../../pipeline/article-pipeline.ts). `seo_content_items.status` remains the
 * single source of truth for "what status is this content item at" (per the
 * pipeline spec), but two new tables are needed alongside it:
 *
 *  - seo_pipeline_steps: an append-only audit log of every step attempt
 *    (start/end, status, error, blocked_reason, linked evidence row). This is
 *    what GET /api/seo/pipeline/:contentId's "step history" reads from, and
 *    what proves a step was/was not re-run after a process restart.
 *
 *  - seo_pipeline_state: one row per content item holding small mutable
 *    counters/blobs the state machine needs across steps that don't belong on
 *    seo_content_items itself (repair-loop counter, generation retry
 *    counter, the persisted content brief/outline JSON, and preview/publish
 *    scratch fields). Kept as its own table specifically so this migration
 *    never has to ALTER the existing seo_content_items table, which another
 *    engineer owns.
 */

import type Database from 'better-sqlite3';
import type { Migration } from '../migration-runner';

const SQL = `
    CREATE TABLE IF NOT EXISTS seo_pipeline_steps (
      id              TEXT PRIMARY KEY,
      created_at      TEXT NOT NULL,
      content_id      TEXT NOT NULL,
      step            TEXT NOT NULL,
      attempt_number  INTEGER NOT NULL,
      started_at      TEXT NOT NULL,
      completed_at    TEXT,
      status          TEXT NOT NULL, -- running | ok | failed | blocked | waiting
      error           TEXT,
      blocked_reason  TEXT,
      evidence_id     TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_pipestep_content ON seo_pipeline_steps(content_id);
    CREATE INDEX IF NOT EXISTS idx_pipestep_content_step ON seo_pipeline_steps(content_id, step);

    CREATE TABLE IF NOT EXISTS seo_pipeline_state (
      content_id              TEXT PRIMARY KEY,
      created_at               TEXT NOT NULL,
      updated_at               TEXT NOT NULL,
      keyword_id                TEXT,
      repair_loop_count         INTEGER NOT NULL DEFAULT 0,
      generation_attempt        INTEGER NOT NULL DEFAULT 0,
      last_qa_failure_reasons   TEXT, -- JSON string[]
      content_brief_json        TEXT,
      outline_json               TEXT,
      draft_path                TEXT,
      target_path                TEXT,
      preview_path               TEXT,
      preview_build_success      INTEGER,
      snapshot_id                TEXT,
      approval_action_id         TEXT
    );
`;

const migration: Migration = {
  version: 2,
  name: 'pipeline_state',
  sql: SQL,
  up(db: InstanceType<typeof Database>): void {
    db.exec(SQL);
  },
};

export default migration;
