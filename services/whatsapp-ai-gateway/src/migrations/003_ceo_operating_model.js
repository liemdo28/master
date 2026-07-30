/**
 * Migration 003: CEO Operating Model
 *
 * Adds tables for:
 *   - ceo_workflow_audit: all workflow event auditing
 *   - evidence_photos: evidence photo storage with submission links
 *   - group_workflow_config: per-group workflow configuration
 */
async function up(db, dbRun) {
  // CEO Workflow Audit table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS ceo_workflow_audit (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id TEXT NOT NULL UNIQUE,
      chat_id TEXT,
      group_id TEXT,
      store_id TEXT,
      sender TEXT,
      sender_name TEXT,
      message_id TEXT,
      workflow TEXT NOT NULL,
      event_type TEXT NOT NULL,
      status TEXT DEFAULT 'ok',
      metadata TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_ceo_audit_workflow ON ceo_workflow_audit(workflow)`);
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_ceo_audit_event ON ceo_workflow_audit(event_type)`);
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_ceo_audit_chat ON ceo_workflow_audit(chat_id)`);
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_ceo_audit_time ON ceo_workflow_audit(created_at)`);

  // Evidence Photos table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS evidence_photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      evidence_id TEXT NOT NULL UNIQUE,
      chat_id TEXT,
      sender TEXT,
      sender_name TEXT,
      group_name TEXT,
      timestamp TEXT,
      image_path TEXT,
      subtype TEXT DEFAULT 'other',
      linked_submission_id TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_evidence_chat ON evidence_photos(chat_id)`);
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_evidence_submission ON evidence_photos(linked_submission_id)`);

  // Group workflow config table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS group_workflow_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id TEXT NOT NULL UNIQUE,
      group_name TEXT,
      store_id TEXT,
      store_name TEXT,
      mi_admin_private_chats TEXT DEFAULT '',
      mi_group_mode TEXT DEFAULT 'mention_only',
      agent_group_mode TEXT DEFAULT 'prefix_only',
      enabled_workflows TEXT DEFAULT 'food_safety_capture',
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_group_workflow_active ON group_workflow_config(active)`);

  // app_config keys for CEO operating model
  await dbRun(`
    INSERT OR IGNORE INTO app_config (key, value, updated_at)
    VALUES ('FOOD_SAFETY_ENABLED_GROUPS', '', datetime('now'))
  `);
  await dbRun(`
    INSERT OR IGNORE INTO app_config (key, value, updated_at)
    VALUES ('MI_ADMIN_PRIVATE_CHATS', '', datetime('now'))
  `);
  await dbRun(`
    INSERT OR IGNORE INTO app_config (key, value, updated_at)
    VALUES ('MI_GROUP_MODE', 'mention_only', datetime('now'))
  `);
  await dbRun(`
    INSERT OR IGNORE INTO app_config (key, value, updated_at)
    VALUES ('AGENT_GROUP_MODE', 'prefix_only', datetime('now'))
  `);
  await dbRun(`
    INSERT OR IGNORE INTO app_config (key, value, updated_at)
    VALUES ('DEFAULT_NO_PREFIX_BEHAVIOR', 'silent_or_help', datetime('now'))
  `);
}

module.exports = { up };
