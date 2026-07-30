/**
 * Conversation Store — SQLite-backed persistent chat sessions
 * 
 * Replaces the in-memory Map<string, Array<...>> with a SQLite database.
 * Survives: process restart, PM2 restart, system reboot.
 * 
 * Schema:
 *   sessions: session_id, created_at, last_active
 *   messages: id, session_id, role, content, created_at
 * 
 * Features:
 *   - Auto-expires inactive sessions after configurable TTL (default 24h)
 *   - Caps messages per session (default 100)
 *   - Automatic cleanup of expired sessions on boot + periodic
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const GLOBAL_DIR = process.env.GLOBAL_DIR || 'E:/Project/Master/.local-agent-global';
const DATA_DIR = process.env.MI_DATA_DIR || path.join(GLOBAL_DIR);

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, 'conversations.db');

// ── Configuration ──────────────────────────────────────────────────────────

/** Session TTL in milliseconds (default: 24 hours) */
const SESSION_TTL_MS = parseInt(process.env.CHAT_SESSION_TTL_MS || '86400000', 10);

/** Max messages to keep per session */
const MAX_MESSAGES_PER_SESSION = parseInt(process.env.CHAT_MAX_MESSAGES || '100', 10);

/** Cleanup interval in milliseconds (default: 15 minutes) */
const CLEANUP_INTERVAL_MS = parseInt(process.env.CHAT_CLEANUP_INTERVAL_MS || '900000', 10);

// ── Database Setup ─────────────────────────────────────────────────────────

let db: Database.Database;

function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('busy_timeout = 5000');
    initSchema();
    console.log(`[ConversationStore] SQLite initialized: ${DB_PATH}`);
  }
  return db;
}

function initSchema() {
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      session_id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_active TEXT NOT NULL DEFAULT (datetime('now'))
    );
    
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
    );
    
    CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);
    CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);
    CREATE INDEX IF NOT EXISTS idx_sessions_last_active ON sessions(last_active);
  `);
}

// ── Public API ─────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Get message history for a session.
 * Creates the session if it doesn't exist.
 * Returns messages in chronological order.
 */
export function getHistory(sessionId: string): ChatMessage[] {
  const d = getDb();
  
  // Upsert session
  d.prepare(`
    INSERT INTO sessions (session_id) VALUES (?)
    ON CONFLICT(session_id) DO UPDATE SET last_active = datetime('now')
  `).run(sessionId);
  
  // Get messages
  const rows = d.prepare(`
    SELECT role, content FROM messages 
    WHERE session_id = ? 
    ORDER BY id ASC
    LIMIT ?
  `).all(sessionId, MAX_MESSAGES_PER_SESSION) as Array<{ role: string; content: string }>;
  
  return rows.map(r => ({ role: r.role as 'user' | 'assistant', content: r.content }));
}

/**
 * Add a message to a session.
 * Auto-trims to MAX_MESSAGES_PER_SESSION.
 */
export function addMessage(sessionId: string, role: 'user' | 'assistant', content: string): void {
  const d = getDb();
  
  // Upsert session
  d.prepare(`
    INSERT INTO sessions (session_id) VALUES (?)
    ON CONFLICT(session_id) DO UPDATE SET last_active = datetime('now')
  `).run(sessionId);
  
  // Insert message
  d.prepare(`
    INSERT INTO messages (session_id, role, content) VALUES (?, ?, ?)
  `).run(sessionId, role, content);
  
  // Trim old messages beyond limit
  d.prepare(`
    DELETE FROM messages WHERE session_id = ? AND id NOT IN (
      SELECT id FROM messages WHERE session_id = ? ORDER BY id DESC LIMIT ?
    )
  `).run(sessionId, sessionId, MAX_MESSAGES_PER_SESSION);
}

/**
 * Clear history for a specific session.
 */
export function clearSession(sessionId: string): void {
  const d = getDb();
  d.prepare('DELETE FROM messages WHERE session_id = ?').run(sessionId);
  d.prepare('DELETE FROM sessions WHERE session_id = ?').run(sessionId);
}

/**
 * Get all active session IDs.
 */
export function listSessions(): string[] {
  const rows = getDb().prepare(`
    SELECT session_id FROM sessions 
    WHERE datetime(last_active) > datetime('now', '-' || ? / 60000 || ' minutes')
  `).all(SESSION_TTL_MS) as Array<{ session_id: string }>;
  return rows.map(r => r.session_id);
}

/**
 * Get session metadata.
 */
export function getSessionInfo(sessionId: string): { 
  exists: boolean; 
  messageCount: number; 
  lastActive: string | null;
  createdAt: string | null;
} {
  const d = getDb();
  const session = d.prepare('SELECT * FROM sessions WHERE session_id = ?').get(sessionId) as 
    { created_at: string; last_active: string } | undefined;
  
  if (!session) return { exists: false, messageCount: 0, lastActive: null, createdAt: null };
  
  const count = (d.prepare('SELECT COUNT(*) as cnt FROM messages WHERE session_id = ?').get(sessionId) as { cnt: number }).cnt;
  
  return {
    exists: true,
    messageCount: count,
    lastActive: session.last_active,
    createdAt: session.created_at,
  };
}

/**
 * Cleanup expired sessions and their messages.
 */
export function cleanupExpiredSessions(): { deleted: number } {
  const d = getDb();
  const cutoff = new Date(Date.now() - SESSION_TTL_MS).toISOString();
  
  // Get session IDs to delete
  const expired = d.prepare(
    'SELECT session_id FROM sessions WHERE last_active < ?'
  ).all(cutoff) as Array<{ session_id: string }>;
  
  if (expired.length === 0) return { deleted: 0 };
  
  const sessionIds = expired.map(e => e.session_id);
  const placeholders = sessionIds.map(() => '?').join(',');
  
  // Delete messages first
  d.prepare(`DELETE FROM messages WHERE session_id IN (${placeholders})`).run(...sessionIds);
  // Delete sessions
  d.prepare(`DELETE FROM sessions WHERE session_id IN (${placeholders})`).run(...sessionIds);
  
  console.log(`[ConversationStore] Cleaned up ${expired.length} expired sessions`);
  return { deleted: expired.length };
}

/**
 * Get overall store stats.
 */
export function getStoreStats(): {
  totalSessions: number;
  activeSessions: number;
  totalMessages: number;
  dbPath: string;
} {
  const d = getDb();
  const totalSessions = (d.prepare('SELECT COUNT(*) as cnt FROM sessions').get() as { cnt: number }).cnt;
  const totalMessages = (d.prepare('SELECT COUNT(*) as cnt FROM messages').get() as { cnt: number }).cnt;
  const active = listSessions();
  
  return {
    totalSessions,
    activeSessions: active.length,
    totalMessages,
    dbPath: DB_PATH,
  };
}

/**
 * Start periodic cleanup interval.
 */
export function startCleanupInterval(): NodeJS.Timeout {
  return setInterval(() => {
    try {
      cleanupExpiredSessions();
    } catch (e) {
      console.warn('[ConversationStore] Cleanup error:', e);
    }
  }, CLEANUP_INTERVAL_MS);
}

/**
 * Close the database connection (for graceful shutdown).
 */
export function closeStore(): void {
  if (db) {
    db.close();
    db = undefined!;
  }
}
