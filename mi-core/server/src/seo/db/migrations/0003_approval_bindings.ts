import type { Migration } from '../migration-runner';

const sql = `
-- Persist canonical action target/location for object-ID scope checks.
ALTER TABLE seo_actions ADD COLUMN target TEXT;
CREATE INDEX IF NOT EXISTS idx_action_target ON seo_actions(target);

CREATE TABLE IF NOT EXISTS seo_approval_bindings (
  approval_id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  action_key TEXT NOT NULL,
  target TEXT NOT NULL,
  brand_id TEXT NOT NULL,
  location_id TEXT,
  actor_id TEXT,
  payload_hash TEXT,
  created_at TEXT NOT NULL,
  consumed_at TEXT,
  consumed_by TEXT,
  execution_result TEXT
);
CREATE INDEX IF NOT EXISTS idx_seo_approval_binding_brand ON seo_approval_bindings(brand_id, location_id);
CREATE INDEX IF NOT EXISTS idx_seo_approval_binding_action ON seo_approval_bindings(category, action_key, target);
`;

const migration: Migration = {
  version: 3,
  name: 'approval_bindings',
  sql,
  up(db) {
    const columns = db.prepare('PRAGMA table_info(seo_actions)').all() as Array<{ name: string }>;
    if (!columns.some(column => column.name === 'target')) {
      db.exec('ALTER TABLE seo_actions ADD COLUMN target TEXT;');
    }
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_action_target ON seo_actions(target);

      CREATE TABLE IF NOT EXISTS seo_approval_bindings (
        approval_id TEXT PRIMARY KEY,
        category TEXT NOT NULL,
        action_key TEXT NOT NULL,
        target TEXT NOT NULL,
        brand_id TEXT NOT NULL,
        location_id TEXT,
        actor_id TEXT,
        payload_hash TEXT,
        created_at TEXT NOT NULL,
        consumed_at TEXT,
        consumed_by TEXT,
        execution_result TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_seo_approval_binding_brand ON seo_approval_bindings(brand_id, location_id);
      CREATE INDEX IF NOT EXISTS idx_seo_approval_binding_action ON seo_approval_bindings(category, action_key, target);
    `);
  },
};

export default migration;
