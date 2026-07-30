/**
 * Message Fingerprint — P0-3: Duplicate Workflow Elimination
 *
 * Provides content-level deduplication independent of message_id.
 * Catches same-content messages arriving from different channels,
 * retries, or gateway replays.
 *
 * Two-level dedup:
 *   Level 1: message_id replay (already handled by whatsapp.ts)
 *   Level 2: content fingerprint (this module) — catches "same text, different id"
 *
 * Fingerprint = sha256(sender + normalized_text + entity + hour_bucket)
 * Time bucket: 1 hour windows (CEO can resend within 24h and still dedup)
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// ── Configuration ───────────────────────────────────────────────────────────

const MI_CORE_ROOT = process.env.MI_CORE_ROOT || 'E:/Project/Master/mi-core';
const FINGERPRINT_DIR = path.join(MI_CORE_ROOT, '.local-agent-global', 'fingerprints');
const DEDUP_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // cleanup every 5 min

// ── Types ───────────────────────────────────────────────────────────────────

export interface FingerprintRecord {
  fingerprint: string;
  sender: string;
  normalized_text: string;
  entity: string;
  hour_bucket: string;
  first_seen: string;
  last_seen: string;
  count: number;
  blocked_count: number;
}

// ── Storage ─────────────────────────────────────────────────────────────────

function ensureDir() {
  fs.mkdirSync(FINGERPRINT_DIR, { recursive: true });
}

function recordPath(fp: string): string {
  return path.join(FINGERPRINT_DIR, `${fp}.json`);
}

function saveRecord(rec: FingerprintRecord): void {
  ensureDir();
  fs.writeFileSync(recordPath(rec.fingerprint), JSON.stringify(rec, null, 2));
}

function loadRecord(fp: string): FingerprintRecord | null {
  try {
    return JSON.parse(fs.readFileSync(recordPath(fp), 'utf8'));
  } catch {
    return null;
  }
}

function deleteRecord(fp: string): void {
  try { fs.unlinkSync(recordPath(fp)); } catch { /* ignore */ }
}

function cleanupExpired(): void {
  const cutoff = Date.now() - (DEDUP_WINDOW_MS * 24); // keep 24h of records
  ensureDir();
  const files = fs.readdirSync(FINGERPRINT_DIR).filter(f => f.endsWith('.json'));
  for (const f of files) {
    try {
      const rec: FingerprintRecord = JSON.parse(fs.readFileSync(path.join(FINGERPRINT_DIR, f), 'utf8'));
      if (new Date(rec.last_seen).getTime() < cutoff) {
        deleteRecord(rec.fingerprint);
      }
    } catch { /* corrupt file, delete it */
      try { fs.unlinkSync(path.join(FINGERPRINT_DIR, f)); } catch { /* ignore */ }
    }
  }
}

let lastCleanup = Date.now();
function maybeCleanup() {
  if (Date.now() - lastCleanup > CLEANUP_INTERVAL_MS) {
    cleanupExpired();
    lastCleanup = Date.now();
  }
}

// ── Normalization (matches idempotency-layer) ────────────────────────────────

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getHourBucket(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}T${String(now.getUTCHours()).padStart(2, '0')}`;
}

// ── Fingerprint generation ──────────────────────────────────────────────────

export function computeFingerprint(params: {
  sender: string;
  text: string;
  entity?: string;
}): string {
  const normalized = normalizeText(params.text);
  const entity = (params.entity || '').toLowerCase();
  const hourBucket = getHourBucket();
  const payload = `${params.sender}|${normalized}|${entity}|${hourBucket}`;
  return crypto.createHash('sha256').update(payload).digest('hex').slice(0, 16);
}

// ── Public API ──────────────────────────────────────────────────────────────

export interface FingerprintCheckResult {
  is_duplicate: boolean;
  existing_record: FingerprintRecord | null;
  should_block: boolean;
}

/**
 * Check if a message is a content-level duplicate.
 * Returns whether to block the message entirely.
 */
export function checkFingerprint(params: {
  sender: string;
  text: string;
  entity?: string;
}): FingerprintCheckResult {
  maybeCleanup();
  const fp = computeFingerprint(params);
  const existing = loadRecord(fp);

  if (existing) {
    existing.count++;
    existing.last_seen = new Date().toISOString();
    saveRecord(existing);

    return {
      is_duplicate: true,
      existing_record: existing,
      should_block: existing.count >= 3, // Block if seen 3+ times within same hour
    };
  }

  return {
    is_duplicate: false,
    existing_record: null,
    should_block: false,
  };
}

/**
 * Register a message fingerprint after successful processing.
 */
export function registerFingerprint(params: {
  sender: string;
  text: string;
  entity?: string;
}): FingerprintRecord {
  maybeCleanup();
  const fp = computeFingerprint(params);
  const existing = loadRecord(fp);

  if (existing) {
    existing.count++;
    existing.last_seen = new Date().toISOString();
    saveRecord(existing);
    return existing;
  }

  const rec: FingerprintRecord = {
    fingerprint: fp,
    sender: params.sender,
    normalized_text: normalizeText(params.text),
    entity: params.entity || '',
    hour_bucket: getHourBucket(),
    first_seen: new Date().toISOString(),
    last_seen: new Date().toISOString(),
    count: 1,
    blocked_count: 0,
  };
  saveRecord(rec);
  return rec;
}

/**
 * Get dedup statistics.
 */
export function getFingerprintStats(): {
  total_records: number;
  duplicates_blocked: number;
  unique_messages_24h: number;
} {
  maybeCleanup();
  ensureDir();
  const files = fs.readdirSync(FINGERPRINT_DIR).filter(f => f.endsWith('.json'));
  let totalRecords = files.length;
  let duplicatesBlocked = 0;
  let unique24h = 0;
  const cutoff = Date.now() - (24 * 60 * 60 * 1000);

  for (const f of files) {
    try {
      const rec: FingerprintRecord = JSON.parse(fs.readFileSync(path.join(FINGERPRINT_DIR, f), 'utf8'));
      duplicatesBlocked += rec.blocked_count;
      if (new Date(rec.first_seen).getTime() >= cutoff) unique24h++;
    } catch { /* skip corrupt */ }
  }

  return {
    total_records: totalRecords,
    duplicates_blocked: duplicatesBlocked,
    unique_messages_24h: unique24h,
  };
}
