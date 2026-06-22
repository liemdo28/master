/**
 * Audit Service — append-only audit trail for all bigdata operations.
 */

import { pgQuery } from './db-client';

export interface AuditEntry {
  actor?: string;
  action: string;
  entity_type?: string;
  entity_id?: string;
  before_json?: Record<string, unknown>;
  after_json?: Record<string, unknown>;
}

export async function auditLog(entry: AuditEntry): Promise<void> {
  try {
    await pgQuery(
      `INSERT INTO audit_log (actor, action, entity_type, entity_id, before_json, after_json)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [
        entry.actor || 'system',
        entry.action,
        entry.entity_type || null,
        entry.entity_id || null,
        entry.before_json ? JSON.stringify(entry.before_json) : null,
        entry.after_json  ? JSON.stringify(entry.after_json)  : null,
      ]
    );
  } catch {
    // Audit must never crash the main flow
    console.warn('[BigData:Audit] Failed to write audit log:', entry.action);
  }
}

export async function getAuditLog(limit = 100, actor?: string): Promise<unknown[]> {
  if (actor) {
    return pgQuery('SELECT * FROM audit_log WHERE actor=$1 ORDER BY created_at DESC LIMIT $2', [actor, limit]);
  }
  return pgQuery('SELECT * FROM audit_log ORDER BY created_at DESC LIMIT $1', [limit]);
}
