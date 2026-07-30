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

function insertSyncCommand(): string {
  const commandId = `auto-sync-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  try {
    getDb().prepare(`
      INSERT INTO commands (command_id, machine_id, command_type, payload_json, status, created_at)
      VALUES (?, ?, 'TRIGGER_SYNC', '{"reason":"laptop_came_online","auto":true}', 'pending', ?)
    `).run(commandId, MACHINE_ID, new Date().toISOString());
  } catch (e: any) {
    console.error('[QB-WATCHER] Failed to insert sync command:', e.message);
  }
  return commandId;
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
        console.log(`[QB-WATCHER] ${MACHINE_ID} back online — gap: ${gapMinutes}m — triggering sync`);

        const commandId = insertSyncCommand();

        await sendToCeo(
          `🟢 Laptop1 (QB) vừa online trở lại.\n` +
          `Em đã tự động kích hoạt QB sync để lấy dữ liệu mới nhất.\n` +
          `Command: ${commandId}`
        ).catch(() => {/* already logged */});
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
