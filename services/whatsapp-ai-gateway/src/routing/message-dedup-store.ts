/**
 * Message Dedup Store (TypeScript) — Phase 21.6 CEO Directive P0
 *
 * Ensures ONE WhatsApp message_id → ONE owner → ONE response.
 *
 * Rules:
 *   Same message_id → never process twice
 *   TTL: 24 hours minimum
 *   Atomic claim — race-condition safe
 *
 * This is the TypeScript implementation. The existing message-dedup-store.js
 * remains for backward compatibility until all consumers migrate.
 */

import * as fs from 'fs';
import * as path from 'path';

export type MessageStatus = 'processing' | 'completed' | 'failed';

export interface DedupEntry {
  message_id: string;
  chat_id: string;
  owner_handler: string;
  status: MessageStatus;
  created_at: number;
  updated_at: number;
}

const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // every 5 minutes

const _store = new Map<string, DedupEntry>();
let _cleanupTimer: NodeJS.Timeout | null = null;
const TRACE_PATH = path.resolve(__dirname, '../../data/dedup-trace.jsonl');

function _log(level: 'info' | 'warn' | 'error', msg: string, data?: Record<string, unknown>) {
  const prefix = `[dedup] ${msg}`;
  if (level === 'info') console.info(prefix, data || '');
  else if (level === 'warn') console.warn(prefix, data || '');
  else console.error(prefix, data || '');
  try {
    fs.appendFileSync(TRACE_PATH, JSON.stringify({ ts: new Date().toISOString(), level, msg, ...data }) + '\n');
  } catch (_) {}
}

function _startCleanup() {
  if (_cleanupTimer) return;
  _cleanupTimer = setInterval(() => {
    const cutoff = Date.now() - TTL_MS;
    let pruned = 0;
    for (const [key, entry] of _store.entries()) {
      if (entry.created_at < cutoff) {
        _store.delete(key);
        pruned++;
      }
    }
    if (pruned > 0) _log('info', `Pruned ${pruned} entries (${_store.size} remaining)`);
  }, CLEANUP_INTERVAL_MS);
}
_startCleanup();

/** Check if a message_id has already been processed (within TTL). */
export function isDuplicate(messageId: string): boolean {
  if (!messageId) return false;
  const entry = _store.get(messageId);
  if (!entry) return false;
  const age = Date.now() - entry.created_at;
  if (age > TTL_MS) {
    _store.delete(messageId);
    return false;
  }
  return true;
}

/** Atomically claim a message_id. Returns false if already claimed. */
export function claim(messageId: string, chatId: string, ownerHandler: string): { claimed: boolean; existing?: DedupEntry } {
  if (!messageId) return { claimed: true, existing: undefined };
  const existing = _store.get(messageId);
  if (existing) {
    const age = Date.now() - existing.created_at;
    if (age <= TTL_MS) {
      _log('info', 'claim_rejected', { messageId, owner: existing.owner_handler, status: existing.status });
      return { claimed: false, existing };
    }
    _store.delete(messageId); // expired — allow re-claim
  }
  const now = Date.now();
  const entry: DedupEntry = {
    message_id: messageId,
    chat_id: chatId,
    owner_handler: ownerHandler,
    status: 'processing',
    created_at: now,
    updated_at: now,
  };
  _store.set(messageId, entry);
  _log('info', 'claim_acquired', { messageId, owner: ownerHandler, chatId });
  return { claimed: true, existing: undefined };
}

/** Update the processing status of a claimed message. */
export function updateStatus(messageId: string, status: MessageStatus, extra: Partial<DedupEntry> = {}): void {
  if (!messageId) return;
  const entry = _store.get(messageId);
  if (!entry) return;
  entry.status = status;
  entry.updated_at = Date.now();
  Object.assign(entry, extra);
  _log('info', 'status_updated', { messageId, status, owner: entry.owner_handler });
}

/** Get current entry for a message_id. */
export function get(messageId: string): DedupEntry | undefined {
  return _store.get(messageId);
}

/** Store statistics. */
export function getStats(): { size: number; ttl_ms: number; entries: DedupEntry[] } {
  return { size: _store.size, ttl_ms: TTL_MS, entries: Array.from(_store.values()) };
}

/** Clear all entries (for testing). */
export function clear(): void {
  _store.clear();
}

/** Shutdown cleanup timer. */
export function destroy(): void {
  if (_cleanupTimer) { clearInterval(_cleanupTimer); _cleanupTimer = null; }
  _store.clear();
}
