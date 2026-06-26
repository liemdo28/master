/**
 * DEV4 — Approval Source of Truth
 * 
 * Unified approval state across ALL surfaces:
 *   - ops.db approval_queue (gate.ts)
 *   - approval-store/approvals.db (persistent-approval-store.ts)
 *   - WhatsApp surface
 *   - Briefing surface
 *   - Status API surface
 * 
 * Before V2: Each surface queried a different store → count mismatch (P1 failure).
 * After V2: This module reads BOTH stores and produces a single authoritative count.
 * 
 * Target: BURNIN_MONITOR_TRUSTED
 */

import { getOpsDb } from './ops-db';
import fs from 'fs';
import path from 'path';

// ── Types ──────────────────────────────────────────────────────────────────

export interface ApprovalTruth {
  generated_at: string;
  
  // Unified counts (across both stores)
  pending_total: number;
  approved_total: number;
  rejected_total: number;
  expired_total: number;
  total_all_time: number;
  
  // Per-store breakdown
  ops_queue: {
    pending: number;
    approved: number;
    rejected: number;
    total: number;
  };
  persistent_store: {
    pending: number;
    approved: number;
    rejected: number;
    expired: number;
    total: number;
  };
  
  // Staleness
  oldest_pending_age_hours: number | null;
  oldest_pending_id: string | null;
  
  // Audit log verification
  audit_log_exists: boolean;
  audit_log_entries: number;
  audit_log_path: string;
  
  // Status
  consistency: 'CONSISTENT' | 'DIVERGENT' | 'DEGRADED';
  divergence_detail: string | null;
}

// ── Paths ──────────────────────────────────────────────────────────────────

const GLOBAL_DIR = process.env.GLOBAL_DIR || 'D:/Project/Master/.local-agent-global';
const AUDIT_LOG_PATH = path.join(GLOBAL_DIR, 'action-audit', 'action_log.json');

// ── Public API ─────────────────────────────────────────────────────────────

export function getApprovalSourceOfTruth(): ApprovalTruth {
  // 1. Read ops.db approval_queue
  const opsQueue = readOpsQueue();
  
  // 2. Read persistent store
  const persistentStore = readPersistentStore();
  
  // 3. Read audit log
  const auditLog = readAuditLog();
  
  // 4. Compute unified counts
  const pending_total = opsQueue.pending + persistentStore.pending;
  const approved_total = opsQueue.approved + persistentStore.approved;
  const rejected_total = opsQueue.rejected + persistentStore.rejected;
  const expired_total = persistentStore.expired;
  const total_all_time = opsQueue.total + persistentStore.total;
  
  // 5. Check consistency
  const opsPendingInPersistent = persistentStore.pending; // may overlap
  const consistency = assessConsistency(opsQueue, persistentStore);
  
  // 6. Find oldest pending
  const oldestPending = findOldestPending();
  
  return {
    generated_at: new Date().toISOString(),
    pending_total,
    approved_total,
    rejected_total,
    expired_total,
    total_all_time,
    ops_queue: opsQueue,
    persistent_store: persistentStore,
    oldest_pending_age_hours: oldestPending.age_hours,
    oldest_pending_id: oldestPending.id,
    audit_log_exists: auditLog.exists,
    audit_log_entries: auditLog.count,
    audit_log_path: AUDIT_LOG_PATH,
    consistency: consistency.status,
    divergence_detail: consistency.detail,
  };
}

// ── Internal readers ──────────────────────────────────────────────────────

function readOpsQueue(): { pending: number; approved: number; rejected: number; total: number } {
  try {
    const db = getOpsDb();
    const pending = (db.prepare("SELECT COUNT(*) as n FROM approval_queue WHERE status = 'pending'").get() as any)?.n ?? 0;
    const approved = (db.prepare("SELECT COUNT(*) as n FROM approval_queue WHERE status = 'approved'").get() as any)?.n ?? 0;
    const rejected = (db.prepare("SELECT COUNT(*) as n FROM approval_queue WHERE status = 'rejected'").get() as any)?.n ?? 0;
    const total = (db.prepare("SELECT COUNT(*) as n FROM approval_queue").get() as any)?.n ?? 0;
    return { pending, approved, rejected, total };
  } catch {
    return { pending: 0, approved: 0, rejected: 0, total: 0 };
  }
}

function readPersistentStore(): { pending: number; approved: number; rejected: number; expired: number; total: number } {
  try {
    const DB_PATH = path.join(GLOBAL_DIR, 'approval-store', 'approvals.db');
    if (!fs.existsSync(DB_PATH)) return { pending: 0, approved: 0, rejected: 0, expired: 0, total: 0 };
    
    const Database = require('better-sqlite3');
    const db = new Database(DB_PATH, { readonly: true });
    const pending = (db.prepare("SELECT COUNT(*) as n FROM approvals WHERE status = 'pending'").get() as any)?.n ?? 0;
    const approved = (db.prepare("SELECT COUNT(*) as n FROM approvals WHERE status = 'approved'").get() as any)?.n ?? 0;
    const rejected = (db.prepare("SELECT COUNT(*) as n FROM approvals WHERE status = 'rejected'").get() as any)?.n ?? 0;
    const expired = (db.prepare("SELECT COUNT(*) as n FROM approvals WHERE status = 'expired'").get() as any)?.n ?? 0;
    const total = (db.prepare("SELECT COUNT(*) as n FROM approvals").get() as any)?.n ?? 0;
    db.close();
    return { pending, approved, rejected, expired, total };
  } catch {
    return { pending: 0, approved: 0, rejected: 0, expired: 0, total: 0 };
  }
}

function readAuditLog(): { exists: boolean; count: number } {
  try {
    if (!fs.existsSync(AUDIT_LOG_PATH)) return { exists: false, count: 0 };
    const content = fs.readFileSync(AUDIT_LOG_PATH, 'utf-8');
    const entries = JSON.parse(content);
    return { exists: true, count: Array.isArray(entries) ? entries.length : 0 };
  } catch {
    return { exists: false, count: 0 };
  }
}

function findOldestPending(): { id: string | null; age_hours: number | null } {
  try {
    const db = getOpsDb();
    const row = db.prepare(
      "SELECT id, created_at FROM approval_queue WHERE status = 'pending' ORDER BY created_at ASC LIMIT 1"
    ).get() as { id: string; created_at: string } | undefined;
    
    if (row) {
      const age_ms = Date.now() - new Date(row.created_at).getTime();
      return { id: row.id, age_hours: Math.round(age_ms / 3600_000 * 10) / 10 };
    }
    return { id: null, age_hours: null };
  } catch {
    return { id: null, age_hours: null };
  }
}

function assessConsistency(
  ops: { pending: number; total: number },
  persistent: { pending: number; total: number },
): { status: 'CONSISTENT' | 'DIVERGENT' | 'DEGRADED'; detail: string | null } {
  // If both stores are empty, that's consistent
  if (ops.total === 0 && persistent.total === 0) {
    return { status: 'CONSISTENT', detail: 'Both stores empty' };
  }
  
  // If only one store has data, it's still valid (may not have migrated yet)
  if (ops.total === 0 && persistent.total > 0) {
    return { status: 'DEGRADED', detail: 'ops.db approval_queue empty but persistent store has data — migration may be needed' };
  }
  
  if (ops.total > 0 && persistent.total === 0) {
    return { status: 'DEGRADED', detail: 'Persistent approval store empty but ops.db has data — persistence may be inactive' };
  }
  
  // Both stores have data — check for divergence in pending counts
  const diff = Math.abs(ops.pending - persistent.pending);
  if (diff > 2) {
    return { status: 'DIVERGENT', detail: `Pending count divergence: ops.db=${ops.pending}, persistent=${persistent.pending}, diff=${diff}` };
  }
  
  return { status: 'CONSISTENT', detail: `Both stores: ops.pending=${ops.pending}, persistent.pending=${persistent.pending}` };
}
