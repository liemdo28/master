/**
 * CEO Telemetry DB — Production Telemetry Foundation
 *
 * Three core ledgers + false action tracking:
 *   T1: ceo_raw_messages      — 100% inbound message archive (P0-1)
 *   T2: ceo_decisions         — Decision ledger: intent→evidence→decision→action (P0-2)
 *   T3: ceo_outcomes          — Outcome ledger: result/approval/workflow/failure (P0-3)
 *   T4: ceo_false_actions     — False action / false approval / false finance / context failure (P0-4)
 *
 * Storage: .local-agent-global/telemetry/ceo-telemetry.db (WAL mode)
 * Pattern: identical to ops-db.ts, failure-evidence-store.ts
 */

import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

// ── Path setup ───────────────────────────────────────────────────────────────

const TELEMETRY_DIR = process.env.MI_DATA_DIR
  ? join(process.env.MI_DATA_DIR, 'telemetry')
  : join(process.cwd(), '..', '..', '.local-agent-global', 'telemetry');

if (!existsSync(TELEMETRY_DIR)) mkdirSync(TELEMETRY_DIR, { recursive: true });

const DB_PATH = join(TELEMETRY_DIR, 'ceo-telemetry.db');

// ── Database singleton ───────────────────────────────────────────────────────

let _db: InstanceType<typeof Database> | null = null;

export function getTelemetryDb(): InstanceType<typeof Database> {
  if (_db) return _db;
  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  _db.pragma('synchronous = NORMAL');
  initSchema(_db);
  console.log(`[CeoTelemetry] SQLite initialized: ${DB_PATH}`);
  return _db;
}

// ── Schema ───────────────────────────────────────────────────────────────────

function initSchema(db: InstanceType<typeof Database>): void {
  db.exec(`
    -- T1: Raw Message Archive (P0-1) — 100% coverage of every inbound CEO message
    CREATE TABLE IF NOT EXISTS ceo_raw_messages (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id      TEXT NOT NULL UNIQUE,
      timestamp       TEXT NOT NULL,
      sender          TEXT NOT NULL,
      message         TEXT NOT NULL,
      conversation_id TEXT,
      channel         TEXT DEFAULT 'whatsapp',
      raw_payload     TEXT,
      created_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_crm_timestamp    ON ceo_raw_messages(timestamp);
    CREATE INDEX IF NOT EXISTS idx_crm_sender       ON ceo_raw_messages(sender);
    CREATE INDEX IF NOT EXISTS idx_crm_conversation ON ceo_raw_messages(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_crm_channel      ON ceo_raw_messages(channel);

    -- T2: Decision Ledger (P0-2) — one row per message analyzed
    CREATE TABLE IF NOT EXISTS ceo_decisions (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id      TEXT NOT NULL UNIQUE,
      intent          TEXT NOT NULL,
      evidence_state  TEXT NOT NULL,
      decision        TEXT NOT NULL,
      action          TEXT,
      confidence      REAL,
      model_used      TEXT,
      reasoning       TEXT,
      created_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_cd_intent     ON ceo_decisions(intent);
    CREATE INDEX IF NOT EXISTS idx_cd_decision   ON ceo_decisions(decision);
    CREATE INDEX IF NOT EXISTS idx_cd_action     ON ceo_decisions(action);
    CREATE INDEX IF NOT EXISTS idx_cd_created    ON ceo_decisions(created_at);

    -- T3: Outcome Ledger (P0-3) — result of every action taken
    CREATE TABLE IF NOT EXISTS ceo_outcomes (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id      TEXT NOT NULL,
      decision_id     INTEGER,
      action          TEXT NOT NULL,
      result          TEXT NOT NULL,
      approval        TEXT,
      workflow_id     TEXT,
      failure         TEXT,
      failure_reason  TEXT,
      duration_ms     INTEGER,
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (message_id)   REFERENCES ceo_raw_messages(message_id),
      FOREIGN KEY (decision_id)  REFERENCES ceo_decisions(id)
    );
    CREATE INDEX IF NOT EXISTS idx_co_message    ON ceo_outcomes(message_id);
    CREATE INDEX IF NOT EXISTS idx_co_result     ON ceo_outcomes(result);
    CREATE INDEX IF NOT EXISTS idx_co_failure    ON ceo_outcomes(failure);
    CREATE INDEX IF NOT EXISTS idx_co_created    ON ceo_outcomes(created_at);

    -- T4: False Action Tracking (P0-4) — marked after human review
    CREATE TABLE IF NOT EXISTS ceo_false_actions (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      outcome_id      INTEGER NOT NULL,
      message_id      TEXT NOT NULL,
      false_action    INTEGER DEFAULT 0,
      false_approval  INTEGER DEFAULT 0,
      false_finance   INTEGER DEFAULT 0,
      false_image_claim INTEGER DEFAULT 0,
      context_failure INTEGER DEFAULT 0,
      reviewer        TEXT,
      review_note     TEXT,
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      reviewed_at     TEXT,
      FOREIGN KEY (outcome_id)  REFERENCES ceo_outcomes(id),
      FOREIGN KEY (message_id)  REFERENCES ceo_raw_messages(message_id)
    );
    CREATE INDEX IF NOT EXISTS idx_cfa_message    ON ceo_false_actions(message_id);
    CREATE INDEX IF NOT EXISTS idx_cfa_outcome    ON ceo_false_actions(outcome_id);
    CREATE INDEX IF NOT EXISTS idx_cfa_reviewed   ON ceo_false_actions(reviewed_at);

    -- T5: Model Freeze State (P0-6) — gates model promotions
    CREATE TABLE IF NOT EXISTS ceo_freeze_state (
      key             TEXT PRIMARY KEY,
      value           TEXT NOT NULL,
      updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Initialize freeze gate if not present
    INSERT OR IGNORE INTO ceo_freeze_state (key, value) VALUES ('model_freeze', 'active');
    INSERT OR IGNORE INTO ceo_freeze_state (key, value) VALUES ('message_threshold', '500');
    INSERT OR IGNORE INTO ceo_freeze_state (key, value) VALUES ('gemma_deploy_allowed', 'false');
    INSERT OR IGNORE INTO ceo_freeze_state (key, value) VALUES ('qwen_replace_allowed', 'false');
  `);
}

// ── Helper exports ───────────────────────────────────────────────────────────

export function nowIso(): string {
  return new Date().toISOString();
}

export function shortId(prefix = 'tel'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

// ── Message count (for freeze gate) ──────────────────────────────────────────

export function getMessageCount(): number {
  const db = getTelemetryDb();
  const row = db.prepare('SELECT COUNT(*) as n FROM ceo_raw_messages').get() as { n: number };
  return row.n;
}
