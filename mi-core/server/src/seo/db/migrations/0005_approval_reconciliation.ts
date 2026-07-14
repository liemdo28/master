import type { Migration } from '../migration-runner';

const sql = `
ALTER TABLE seo_approval_execution_state ADD COLUMN operation_evidence_id TEXT;
ALTER TABLE seo_approval_execution_state ADD COLUMN resource_id TEXT;
ALTER TABLE seo_approval_execution_state ADD COLUMN correlation_id TEXT;
ALTER TABLE seo_approval_execution_state ADD COLUMN manual_reconciliation_required INTEGER NOT NULL DEFAULT 0;
ALTER TABLE seo_approval_execution_state ADD COLUMN automatic_retry_allowed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE seo_approval_execution_state ADD COLUMN reconciled_at TEXT;
ALTER TABLE seo_approval_execution_state ADD COLUMN reconciled_by TEXT;
ALTER TABLE seo_approval_execution_state ADD COLUMN cancelled_at TEXT;
ALTER TABLE seo_approval_execution_state ADD COLUMN cancelled_by TEXT;
ALTER TABLE seo_approval_execution_state ADD COLUMN cancel_reason TEXT;

CREATE TABLE IF NOT EXISTS seo_approval_execution_evidence (
  id TEXT PRIMARY KEY,
  approval_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  evidence_json TEXT NOT NULL,
  actor_id TEXT,
  resource_id TEXT,
  correlation_id TEXT,
  result_digest TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_seo_approval_execution_evidence_approval ON seo_approval_execution_evidence(approval_id, created_at);
`;

const migration: Migration = {
  version: 5,
  name: 'approval_reconciliation',
  sql,
  up(db) {
    const columns = db.prepare('PRAGMA table_info(seo_approval_execution_state)').all() as Array<{ name: string }>;
    const names = new Set(columns.map((column) => column.name));
    for (const statement of [
      ['operation_evidence_id', 'ALTER TABLE seo_approval_execution_state ADD COLUMN operation_evidence_id TEXT'],
      ['resource_id', 'ALTER TABLE seo_approval_execution_state ADD COLUMN resource_id TEXT'],
      ['correlation_id', 'ALTER TABLE seo_approval_execution_state ADD COLUMN correlation_id TEXT'],
      ['manual_reconciliation_required', 'ALTER TABLE seo_approval_execution_state ADD COLUMN manual_reconciliation_required INTEGER NOT NULL DEFAULT 0'],
      ['automatic_retry_allowed', 'ALTER TABLE seo_approval_execution_state ADD COLUMN automatic_retry_allowed INTEGER NOT NULL DEFAULT 0'],
      ['reconciled_at', 'ALTER TABLE seo_approval_execution_state ADD COLUMN reconciled_at TEXT'],
      ['reconciled_by', 'ALTER TABLE seo_approval_execution_state ADD COLUMN reconciled_by TEXT'],
      ['cancelled_at', 'ALTER TABLE seo_approval_execution_state ADD COLUMN cancelled_at TEXT'],
      ['cancelled_by', 'ALTER TABLE seo_approval_execution_state ADD COLUMN cancelled_by TEXT'],
      ['cancel_reason', 'ALTER TABLE seo_approval_execution_state ADD COLUMN cancel_reason TEXT'],
    ] as const) {
      if (!names.has(statement[0])) db.exec(statement[1]);
    }
    db.exec(`
      CREATE TABLE IF NOT EXISTS seo_approval_execution_evidence (
        id TEXT PRIMARY KEY,
        approval_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        evidence_json TEXT NOT NULL,
        actor_id TEXT,
        resource_id TEXT,
        correlation_id TEXT,
        result_digest TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_seo_approval_execution_evidence_approval ON seo_approval_execution_evidence(approval_id, created_at);
    `);
  },
};

export default migration;
