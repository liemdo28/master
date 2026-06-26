/**
 * DEV5 — Phase E6: Idempotency Layer
 * 
 * Prevents: duplicate reply, duplicate workflow, duplicate approval, 
 *           duplicate publish, duplicate send, duplicate deployment.
 * 
 * Idempotency key: sender + normalized_message + target_entity + intent + time_window
 */

import fs from 'fs';
import path from 'path';

// ── Types ──────────────────────────────────────────────────────────────────

export interface IdempotencyRecord {
  key: string;
  sender: string;
  normalized_message: string;
  target_entity: string;
  intent: string;
  workflow_id: string | null;
  created_at: string;
  expires_at: string;
}

// ── Storage ────────────────────────────────────────────────────────────────

const MI_CORE_ROOT = process.env.MI_CORE_ROOT || 'D:/Project/Master/mi-core';
const IDEMP_DIR = path.join(MI_CORE_ROOT, '.local-agent-global', 'idempotency');
const TIME_WINDOW_MS = 2 * 60 * 1000; // 2 minutes

function ensureDir() {
  fs.mkdirSync(IDEMP_DIR, { recursive: true });
}

function recordPath(key: string) {
  // Sanitize key for filename
  const safe = key.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 100);
  return path.join(IDEMP_DIR, `${safe}.json`);
}

function saveRecord(rec: IdempotencyRecord) {
  ensureDir();
  fs.writeFileSync(recordPath(rec.key), JSON.stringify(rec, null, 2));
}

function loadRecord(key: string): IdempotencyRecord | null {
  try { return JSON.parse(fs.readFileSync(recordPath(key), 'utf8')); } catch { return null; }
}

function listRecords(): IdempotencyRecord[] {
  ensureDir();
  return fs.readdirSync(IDEMP_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => { try { return JSON.parse(fs.readFileSync(path.join(IDEMP_DIR, f), 'utf8')); } catch { return null; } })
    .filter(Boolean)
    .sort((a: IdempotencyRecord, b: IdempotencyRecord) => b.created_at.localeCompare(a.created_at));
}

// ── Cleanup expired records ────────────────────────────────────────────────

function cleanupExpired() {
  const now = Date.now();
  const records = listRecords();
  for (const rec of records) {
    if (new Date(rec.expires_at).getTime() < now) {
      try { fs.unlinkSync(recordPath(rec.key)); } catch {}
    }
  }
}

// ── Normalization ──────────────────────────────────────────────────────────

function normalizeMessage(text: string): string {
  return text.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── Public API ─────────────────────────────────────────────────────────────

export function generateIdempotencyKey(params: {
  sender: string;
  message: string;
  target_entity: string;
  intent: string;
}): string {
  const normalized = normalizeMessage(params.message);
  return `${params.sender}|${normalized}|${params.target_entity}|${params.intent}`;
}

export function checkDuplicate(params: {
  sender: string;
  message: string;
  target_entity: string;
  intent: string;
}): { is_duplicate: boolean; existing_workflow_id: string | null; record: IdempotencyRecord | null } {
  cleanupExpired();
  const key = generateIdempotencyKey(params);
  const existing = loadRecord(key);
  
  if (existing) {
    return {
      is_duplicate: true,
      existing_workflow_id: existing.workflow_id,
      record: existing,
    };
  }
  
  return { is_duplicate: false, existing_workflow_id: null, record: null };
}

export function registerMessage(params: {
  sender: string;
  message: string;
  target_entity: string;
  intent: string;
  workflow_id: string | null;
}): IdempotencyRecord {
  const key = generateIdempotencyKey(params);
  const now = new Date();
  const expires = new Date(now.getTime() + TIME_WINDOW_MS);
  
  const rec: IdempotencyRecord = {
    key,
    sender: params.sender,
    normalized_message: normalizeMessage(params.message),
    target_entity: params.target_entity,
    intent: params.intent,
    workflow_id: params.workflow_id,
    created_at: now.toISOString(),
    expires_at: expires.toISOString(),
  };
  
  saveRecord(rec);
  return rec;
}

export function getRecord(key: string): IdempotencyRecord | null {
  return loadRecord(key);
}

export function getAllRecords(limit = 50): IdempotencyRecord[] {
  cleanupExpired();
  return listRecords().slice(0, limit);
}

export function formatDuplicateResponse(existingWorkflowId: string | null): string {
  if (existingWorkflowId) {
    return `Em da nhan yeu cau nay roi. Workflow ${existingWorkflowId} dang cho xu ly. Anh muon em lam gi them khong?`;
  }
  return 'Em da nhan yeu cau tuong tu gan day. Vui long cho 2 phut hoac gui lai voi chi tiet khac.';
}
