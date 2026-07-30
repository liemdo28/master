/**
 * memories.js — the three Phase 12 memory stores:
 *   • OutcomeMemory   — records of completed actions + their measurable result
 *   • FailureMemory   — failed/errored actions + symptom + context
 *   • ApprovalMemory  — human approval/rejection decisions + the action requested
 *
 * All three share the same shape discipline (id, timestamp, source, payload)
 * and persist through JsonStore so learning survives across runs.
 */
import { JsonStore, makeId } from './store.js';

/* ------------------------------------------------------------------ */
/* Outcome Memory                                                      */
/* ------------------------------------------------------------------ */

export class OutcomeMemory {
  constructor(opts) {
    this.store = new JsonStore('outcome-memory', opts);
  }

  /**
   * @param {object} r
   * @param {string} r.actionId
   * @param {string} r.actionType   e.g. 'doordash.read', 'qb.sync', 'seo.publish'
   * @param {string} r.status       'success' | 'partial' | 'failure'
   * @param {object} r.metrics      arbitrary measurable result (e.g. { revenue: 4200 })
   * @param {object} [r.context]
   */
  record(r) {
    const rec = {
      id: makeId('OUT'),
      timestamp: Date.now(),
      actionId: r.actionId,
      actionType: r.actionType,
      status: r.status,
      metrics: r.metrics || {},
      context: r.context || {},
    };
    this.store.insert(rec);
    return rec;
  }

  forActionType(actionType, limit = 20) {
    return this.store.filter((o) => o.actionType === actionType).slice(0, limit);
  }

  successRateByActionType(actionType) {
    const rows = this.forActionType(actionType, 1000);
    if (!rows.length) return null;
    const ok = rows.filter((o) => o.status === 'success').length;
    return { actionType, total: rows.length, success: ok, rate: ok / rows.length };
  }

  all() {
    return this.store.all();
  }
  count() {
    return this.store.count();
  }
}

/* ------------------------------------------------------------------ */
/* Failure Memory                                                      */
/* ------------------------------------------------------------------ */

export class FailureMemory {
  constructor(opts) {
    this.store = new JsonStore('failure-memory', opts);
  }

  /**
   * @param {object} r
   * @param {string} r.actionId
   * @param {string} r.actionType
   * @param {string} r.symptom     short human description of observable failure
   * @param {object} [r.context]
   * @param {object} [r.signal]    structured signal that triggered detection
   */
  record(r) {
    const rec = {
      id: makeId('FAIL'),
      timestamp: Date.now(),
      actionId: r.actionId,
      actionType: r.actionType,
      symptom: r.symptom,
      context: r.context || {},
      signal: r.signal || {},
      resolved: false,
    };
    this.store.insert(rec);
    return rec;
  }

  markResolved(id, resolution) {
    return this.store.update(id, { resolved: true, resolution, resolvedAt: Date.now() });
  }

  /** Find unresolved failures whose symptom is textually similar to `query`. */
  similar(query, limit = 5) {
    const q = String(query).toLowerCase();
    const scored = this.store
      .all()
      .map((f) => {
        const hay = `${f.symptom} ${f.actionType} ${JSON.stringify(f.signal)}`.toLowerCase();
        let score = 0;
        if (hay.includes(q)) score += 10;
        for (const w of q.split(/\s+/).filter(Boolean)) {
          if (hay.includes(w)) score += 2;
        }
        return { rec: f, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((x) => x.rec);
    return scored;
  }

  all() {
    return this.store.all();
  }
  count() {
    return this.store.count();
  }
}

/* ------------------------------------------------------------------ */
/* Approval Memory                                                     */
/* ------------------------------------------------------------------ */

export class ApprovalMemory {
  constructor(opts) {
    this.store = new JsonStore('approval-memory', opts);
  }

  /**
   * @param {object} r
   * @param {string} r.requestId
   * @param {string} r.actionType
   * @param {string} r.decision   'approved' | 'rejected'
   * @param {string} [r.reason]
   * @param {string} [r.approver]
   * @param {number} [r.riskTier]
   */
  record(r) {
    const rec = {
      id: makeId('APR'),
      timestamp: Date.now(),
      requestId: r.requestId,
      actionType: r.actionType,
      decision: r.decision,
      reason: r.reason || null,
      approver: r.approver || 'human',
      riskTier: typeof r.riskTier === 'number' ? r.riskTier : null,
    };
    this.store.insert(rec);
    return rec;
  }

  /** Learned pattern: for a given actionType, is it usually approved? */
  approvalTrendByActionType(actionType) {
    const rows = this.store.filter((a) => a.actionType === actionType);
    if (!rows.length) return null;
    const approved = rows.filter((a) => a.decision === 'approved').length;
    return {
      actionType,
      total: rows.length,
      approved,
      rate: approved / rows.length,
    };
  }

  all() {
    return this.store.all();
  }
  count() {
    return this.store.count();
  }
}
