import type { Migration } from '../migration-runner';

const sql = `
CREATE TABLE IF NOT EXISTS seo_approval_execution_state (
  approval_id TEXT PRIMARY KEY,
  state TEXT NOT NULL DEFAULT 'READY',
  claimed_at TEXT,
  claimed_by TEXT,
  claim_token_hash TEXT,
  execution_started_at TEXT,
  execution_completed_at TEXT,
  execution_failed_at TEXT,
  failure_code TEXT,
  failure_detail TEXT,
  result_digest TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  last_updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_seo_approval_execution_state ON seo_approval_execution_state(state, last_updated_at);
`;

const migration: Migration = {
  version: 4,
  name: 'approval_execution_state',
  sql,
  up(db) {
    db.exec(sql);
  },
};

export default migration;
