/**
 * ApprovalRequiredAction.mjs
 * Wraps any write action with an approval gate.
 * Drafts are stored locally. Execution only after CEO approves via chat or mobile.
 */

import fs from 'fs';
import path from 'path';
import { auditLog } from './ActionAuditLog.mjs';

const GLOBAL_DIR  = process.env.GLOBAL_DIR  || 'E:/Project/Master/.local-agent-global';
const DRAFTS_PATH = path.join(GLOBAL_DIR, 'action-audit', 'pending_actions.json');

// Risk levels
export const RISK = {
  READ: 1,      // auto-allowed
  WRITE: 2,     // CEO approval required
  DANGEROUS: 3, // double-approval (CEO + confirm)
};

// Level classification per action type
const ACTION_LEVELS = {
  // Level 1 — auto
  search: 1, find: 1, read: 1, preview: 1, 'generate-draft': 1, 'generate-report': 1,

  // Level 2 — approval
  'send-email': 2, 'create-event': 2, 'update-event': 2,
  'upload-file': 2, 'share-file': 2, 'create-folder': 2,
  'create-task': 2, 'update-task': 2, 'assign-task': 2, 'complete-task': 2,
  'schedule-post': 2, 'update-menu': 2, 'update-seo': 2,
  'create-draft': 2, 'reply-email': 2, 'forward-email': 2,

  // Level 3 — dangerous
  'delete-file': 3, 'delete-project': 3, 'deploy-production': 3,
  'publish-website': 3, 'cancel-event': 3, 'financial-export': 3,
  'db-migration': 3, 'kill-process': 3, 'change-role': 3,
};

function loadPending() {
  try { return JSON.parse(fs.readFileSync(DRAFTS_PATH, 'utf-8')); }
  catch { return []; }
}

function savePending(actions) {
  fs.mkdirSync(path.dirname(DRAFTS_PATH), { recursive: true });
  fs.writeFileSync(DRAFTS_PATH, JSON.stringify(actions, null, 2));
}

export class ApprovalRequiredAction {
  /**
   * Create an action draft.
   * @param {object} params
   * @param {string} params.type - action type key
   * @param {string} params.target - target system/file/person
   * @param {string} params.description - human-readable description
   * @param {object} params.payload - data needed to execute
   * @param {string} [params.before_state] - what exists now
   * @param {string} [params.rollback_plan] - how to undo
   * @returns {object} draft action
   */
  static create(params) {
    const { type, target, description, payload, before_state, rollback_plan } = params;
    const riskLevel = ACTION_LEVELS[type] || RISK.WRITE;

    const action = {
      id: `action_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,6)}`,
      type,
      target,
      description,
      payload: payload || {},
      risk_level: riskLevel,
      requires_approval: riskLevel >= RISK.WRITE,
      requires_double_approval: riskLevel >= RISK.DANGEROUS,
      status: riskLevel === RISK.READ ? 'auto_approved' : 'pending_approval',
      before_state: before_state || 'unknown',
      rollback_plan: rollback_plan || 'Cannot be undone automatically',
      created_at: new Date().toISOString(),
      approval_id: null,
      approved_at: null,
      executed_at: null,
    };

    // Persist pending actions
    if (action.requires_approval) {
      const pending = loadPending();
      pending.push(action);
      savePending(pending);
    }

    auditLog.logDraft(action);
    return action;
  }

  /** Get all pending approvals */
  static getPending() {
    return loadPending().filter(a => a.status === 'pending_approval');
  }

  /** Approve an action */
  static approve(actionId) {
    const pending = loadPending();
    const idx = pending.findIndex(a => a.id === actionId);
    if (idx === -1) return { ok: false, error: 'Action not found' };
    pending[idx].status = 'approved';
    pending[idx].approved_at = new Date().toISOString();
    savePending(pending);
    auditLog.logApproval(actionId, true);
    return { ok: true, action: pending[idx] };
  }

  /** Reject an action */
  static reject(actionId, reason = '') {
    const pending = loadPending();
    const idx = pending.findIndex(a => a.id === actionId);
    if (idx === -1) return { ok: false, error: 'Action not found' };
    pending[idx].status = 'rejected';
    pending[idx].rejected_at = new Date().toISOString();
    pending[idx].rejection_reason = reason;
    savePending(pending);
    auditLog.logApproval(actionId, false);
    return { ok: true };
  }

  /** Format for Mi response */
  static formatForResponse(action) {
    const riskLabel = action.risk_level === 3 ? '⚠️ DANGEROUS' : action.risk_level === 2 ? '🔒 Write' : '✅ Read';
    return [
      `📋 Action Draft — ${riskLabel}`,
      `Type: ${action.type}`,
      `Target: ${action.target}`,
      `Description: ${action.description}`,
      action.before_state !== 'unknown' ? `Before: ${action.before_state}` : '',
      ``,
      action.requires_double_approval
        ? `⚠️ This requires DOUBLE APPROVAL. Reply [Approve] twice to confirm.`
        : action.requires_approval
          ? `→ Awaiting CEO approval — ID: ${action.id}`
          : `→ Auto-approved (read-only action)`,
      `[Approve] [Edit] [Reject]`,
    ].filter(Boolean).join('\n');
  }
}
