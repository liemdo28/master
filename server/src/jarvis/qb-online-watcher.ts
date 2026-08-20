/**
 * QB Online Watcher
 *
 * Polls qb-agent.db every 60s to detect when qb-laptop-01 comes back online
 * after a gap of >1h. When detected, auto-inserts a TRIGGER_SYNC command so
 * the QB Desktop agent picks it up on its next heartbeat poll.
 *
 * This solves the problem: QB data goes stale when Laptop1 is offline.
 * When it reconnects, Mi automatically triggers a sync without CEO action.
 */

import Database from 'better-sqlite3';
import path from 'path';
import crypto from 'crypto';
import { sendToCeo } from '../services/whatsapp-sender';

const MACHINE_ID = 'qb-laptop-01';
const GAP_THRESHOLD_MS = 60 * 60 * 1000; // 1 hour
const POLL_INTERVAL_MS = 60 * 1000;       // check every 60s
const COMMAND_TYPE = 'TRIGGER_SYNC';
/**
 * Phase 9D — a 'pending'/'acked' TRIGGER_SYNC row older than this is treated as
 * stale (the remote agent almost certainly missed it, or is having its own
 * separate problem) and no longer counts toward the idempotency check below —
 * otherwise one lost/dropped command would silently disable this feature
 * forever. Generous relative to both POLL_INTERVAL_MS and the remote agent's
 * own heartbeat cadence, but bounded so a genuinely stuck command can't block
 * indefinitely.
 */
const STALE_COMMAND_MS = 30 * 60 * 1000; // 30 minutes
const ACTIVE_COMMAND_STATUSES = new Set(['pending', 'acked']);

let db: Database.Database | null = null;
let lastSeenAt: Date | null = null;
let wasOffline = false;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let started = false;

function getDb(): Database.Database {
  if (!db) {
    const dataDir = process.env.MI_DATA_DIR ||
      path.resolve(__dirname, '../../../data');
    db = new Database(path.join(dataDir, 'qb-agent.db'));
  }
  return db;
}

function getLastHeartbeat(): Date | null {
  try {
    const row = getDb()
      .prepare(`SELECT received_at FROM heartbeats WHERE machine_id = ?
                ORDER BY id DESC LIMIT 1`)
      .get(MACHINE_ID) as { received_at: string } | undefined;
    return row ? new Date(row.received_at) : null;
  } catch {
    return null;
  }
}

/**
 * Phase 9D — the idempotency check this worker previously lacked. Finds any
 * TRIGGER_SYNC command for this machine that is still active (pending/acked,
 * i.e. not yet completed/failed) and not stale. Read-only; the caller decides
 * what to do with the result inside the same transaction as the insert below,
 * so the check-then-insert is atomic against a concurrent poll() invocation.
 */
function findActiveSyncCommand(dbHandle: Database.Database): { command_id: string; status: string; created_at: string } | undefined {
  const cutoff = new Date(Date.now() - STALE_COMMAND_MS).toISOString();
  const rows = dbHandle.prepare(`
    SELECT command_id, status, created_at FROM commands
    WHERE machine_id = ? AND command_type = ? AND created_at >= ?
    ORDER BY created_at DESC
  `).all(MACHINE_ID, COMMAND_TYPE, cutoff) as { command_id: string; status: string; created_at: string }[];
  return rows.find(r => ACTIVE_COMMAND_STATUSES.has(r.status));
}

/**
 * Phase 9D — atomic check-then-insert: at most one active TRIGGER_SYNC command
 * may exist for this machine at a time. Returns the new command id if one was
 * genuinely inserted, or null if an active command already existed and this
 * call was correctly skipped as a duplicate. A stale pending/acked row (see
 * STALE_COMMAND_MS) does not block a fresh insert — a lost command must not
 * permanently disable recovery. Deterministic existing-row check, not a
 * time-only cooldown, so it survives process restarts (the check reads the
 * durable commands table, not any in-memory state).
 */
function insertSyncCommand(): string | null {
  const dbHandle = getDb();
  try {
    return dbHandle.transaction(() => {
      const existing = findActiveSyncCommand(dbHandle);
      if (existing) {
        console.log(`[QB-WATCHER] Skipping duplicate ${COMMAND_TYPE} — active command ${existing.command_id} (status=${existing.status}, created=${existing.created_at}) already exists for ${MACHINE_ID}`);
        return null;
      }
      const commandId = `auto-sync-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
      dbHandle.prepare(`
        INSERT INTO commands (command_id, machine_id, command_type, payload_json, status, created_at)
        VALUES (?, ?, ?, '{"reason":"laptop_came_online","auto":true}', 'pending', ?)
      `).run(commandId, MACHINE_ID, COMMAND_TYPE, new Date().toISOString());
      return commandId;
    })();
  } catch (e: any) {
    console.error('[QB-WATCHER] Failed to insert sync command:', e.message);
    return null;
  }
}

async function poll() {
  try {
    const latest = getLastHeartbeat();
    if (!latest) return;

    const now = Date.now();
    const age = now - latest.getTime();

    if (age > GAP_THRESHOLD_MS) {
      // Laptop1 is offline (no heartbeat in >1h)
      if (!wasOffline) {
        wasOffline = true;
        console.log(`[QB-WATCHER] ${MACHINE_ID} went offline — last heartbeat: ${latest.toISOString()}`);
      }
    } else {
      // Recent heartbeat — Laptop1 is online
      if (wasOffline) {
        // Came back online!
        wasOffline = false;
        const gapMinutes = lastSeenAt
          ? Math.round((latest.getTime() - lastSeenAt.getTime()) / 60000)
          : '?';
        console.log(`[QB-WATCHER] ${MACHINE_ID} back online — gap: ${gapMinutes}m`);

        // Phase 9D: insertSyncCommand() now returns null when an active
        // TRIGGER_SYNC command already exists (see findActiveSyncCommand) —
        // only claim a sync was triggered, and only notify the CEO, when a
        // command was genuinely inserted this call.
        const commandId = insertSyncCommand();
        if (commandId) {
          await sendToCeo(
            `🟢 Laptop1 (QB) vừa online trở lại.\n` +
            `Em đã tự động kích hoạt QB sync để lấy dữ liệu mới nhất.\n` +
            `Command: ${commandId}`
          ).catch(() => {/* already logged */});
        }
      }
      lastSeenAt = latest;
    }
  } catch (e: any) {
    console.error('[QB-WATCHER] Poll error:', e.message);
  }
}

export function startQbOnlineWatcher() {
  if (started) return;
  started = true;

  // Initialize wasOffline state from current DB state
  const latest = getLastHeartbeat();
  if (latest) {
    wasOffline = Date.now() - latest.getTime() > GAP_THRESHOLD_MS;
    lastSeenAt = wasOffline ? null : latest;
    console.log(`[QB-WATCHER] Started — ${MACHINE_ID} currently: ${wasOffline ? 'OFFLINE' : 'ONLINE'}`);
  } else {
    wasOffline = true;
    console.log(`[QB-WATCHER] Started — no heartbeat found for ${MACHINE_ID}`);
  }

  pollTimer = setInterval(poll, POLL_INTERVAL_MS);
  // Run immediately on start
  poll().catch(() => {});
}

export function stopQbOnlineWatcher() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  started = false;
}

export function getQbWatcherStatus() {
  const latest = getLastHeartbeat();
  return {
    machine_id: MACHINE_ID,
    last_heartbeat: latest?.toISOString() || null,
    gap_seconds: latest ? Math.round((Date.now() - latest.getTime()) / 1000) : null,
    is_offline: wasOffline,
    watching: started,
    threshold_hours: GAP_THRESHOLD_MS / 3600000,
  };
}

// ── Test-only exports (Phase 9D) ────────────────────────────────────────────
// Not used by any production caller. Exposes the internals needed to test the
// idempotency fix deterministically, and to reset this module's in-memory
// state between test cases without needing a fresh process (module-level
// state — db handle, wasOffline, lastSeenAt, started — otherwise persists
// across require() calls within one test file).
export const __test__ = {
  poll,
  insertSyncCommand,
  findActiveSyncCommand: () => findActiveSyncCommand(getDb()),
  getDb,
  MACHINE_ID,
  COMMAND_TYPE,
  STALE_COMMAND_MS,
  GAP_THRESHOLD_MS,
  reset(): void {
    if (db) { db.close(); db = null; }
    wasOffline = false;
    lastSeenAt = null;
    started = false;
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  },
  setWasOffline(value: boolean): void { wasOffline = value; },
  setLastSeenAt(value: Date | null): void { lastSeenAt = value; },
};
