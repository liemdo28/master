/**
 * Migration 002: API Key Management, Audit Log, and Routed Messages tables
 */
async function up(db, dbRun) {
  // ── API Keys table ──────────────────────────────────────────────────────
  await dbRun(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id TEXT NOT NULL UNIQUE,
      api_key_hash TEXT NOT NULL,
      key_prefix TEXT NOT NULL,
      allowed_commands TEXT NOT NULL DEFAULT '/agent,/mi',
      callback_url TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      last_used_at TEXT,
      rate_limit INTEGER NOT NULL DEFAULT 60,
      permissions TEXT NOT NULL DEFAULT 'read',
      description TEXT
    )
  `);
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_api_keys_client_id ON api_keys(client_id)`);
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_api_keys_status ON api_keys(status)`);
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_api_keys_key_prefix ON api_keys(key_prefix)`);

  // ── API Key Audit Log table ─────────────────────────────────────────────
  await dbRun(`
    CREATE TABLE IF NOT EXISTS api_key_audit (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id TEXT NOT NULL,
      action TEXT NOT NULL,
      detail TEXT,
      ip_address TEXT,
      timestamp TEXT NOT NULL,
      success INTEGER NOT NULL DEFAULT 1
    )
  `);
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_api_key_audit_client ON api_key_audit(client_id)`);
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_api_key_audit_action ON api_key_audit(action)`);
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_api_key_audit_timestamp ON api_key_audit(timestamp)`);

  // ── Routed Messages table ───────────────────────────────────────────────
  await dbRun(`
    CREATE TABLE IF NOT EXISTS routed_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_chat TEXT,
      command_prefix TEXT,
      target_project TEXT,
      request_body TEXT,
      response_body TEXT,
      action_taken TEXT,
      approval_status TEXT DEFAULT 'none',
      timestamp TEXT NOT NULL,
      client_id TEXT,
      duration_ms INTEGER,
      success INTEGER NOT NULL DEFAULT 1
    )
  `);
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_routed_messages_client ON routed_messages(client_id)`);
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_routed_messages_timestamp ON routed_messages(timestamp)`);
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_routed_messages_prefix ON routed_messages(command_prefix)`);

  // ── Approvals table ─────────────────────────────────────────────────────
  await dbRun(`
    CREATE TABLE IF NOT EXISTS approvals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id TEXT,
      action TEXT NOT NULL,
      detail TEXT,
      proposed_by TEXT,
      status TEXT DEFAULT 'pending',
      approved_by TEXT,
      approved_at TEXT,
      created_at TEXT,
      metadata TEXT
    )
  `);
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_approvals_chat ON approvals(chat_id, status)`);
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_approvals_status ON approvals(status)`);
}

module.exports = { up };
