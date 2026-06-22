/**
 * ActionAuditLog.mjs
 * Logs all action attempts, approvals, rejections, executions.
 * Every action leaves an immutable audit trail.
 */

import fs from 'fs';
import path from 'path';

const GLOBAL_DIR = process.env.GLOBAL_DIR || 'E:/Project/Master/.local-agent-global';
const LOG_PATH   = path.join(GLOBAL_DIR, 'action-audit', 'action_log.json');

function load() {
  try { return JSON.parse(fs.readFileSync(LOG_PATH, 'utf-8')); }
  catch { return []; }
}

function save(log) {
  fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
  // Keep last 1000 entries
  const trimmed = log.slice(-1000);
  fs.writeFileSync(LOG_PATH, JSON.stringify(trimmed, null, 2));
}

export class ActionAuditLog {
  log(entry) {
    const log = load();
    const record = {
      id: `audit_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      ts: new Date().toISOString(),
      ...entry,
    };
    log.push(record);
    save(log);
    return record.id;
  }

  logDraft(action) {
    return this.log({
      event: 'action_drafted',
      action_id: action.id,
      action_type: action.type,
      target: action.target,
      description: action.description,
      risk_level: action.risk_level,
      requires_approval: action.requires_approval,
    });
  }

  logApproval(actionId, approved, approver = 'CEO') {
    return this.log({
      event: approved ? 'action_approved' : 'action_rejected',
      action_id: actionId,
      approver,
      decision: approved ? 'approved' : 'rejected',
    });
  }

  logExecution(actionId, success, result) {
    return this.log({
      event: success ? 'action_executed' : 'action_failed',
      action_id: actionId,
      success,
      result: typeof result === 'string' ? result : JSON.stringify(result).slice(0, 500),
    });
  }

  logBlocked(action, reason) {
    return this.log({
      event: 'action_blocked',
      action_type: action.type,
      description: action.description,
      reason,
    });
  }

  getRecent(limit = 20) {
    return load().slice(-limit).reverse();
  }

  getByActionId(actionId) {
    return load().filter(e => e.action_id === actionId);
  }
}

export const auditLog = new ActionAuditLog();
