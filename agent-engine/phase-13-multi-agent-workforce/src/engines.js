/**
 * engines.js — Handoff, Conflict, and Review engines for the multi-agent workforce.
 *
 * • HandoffEngine   — transfers a task from one agent to another with a reason
 *                     and a context payload, leaving an auditable chain.
 * • ConflictEngine  — detects when two agents want the same exclusive resource
 *                     (e.g. the same connector credential, the same content slot)
 *                     and resolves by priority + seniority.
 * • ReviewEngine    — peer review of a completed task: a reviewer agent scores
 *                     the work; failed reviews route back to handoff.
 * • PerformanceScorecard — rolling score per agent from review outcomes.
 */
import { JsonStore, makeId } from '../../phase-12-self-improving-intelligence/src/store.js';

/* ------------------------------------------------------------------ */
/* Handoff                                                             */
/* ------------------------------------------------------------------ */

export class HandoffEngine {
  constructor(opts) {
    this.store = new JsonStore('agent-handoff', opts);
  }

  handoff({ taskId, fromAgentId, toAgentId, reason, context }) {
    const rec = {
      id: makeId('HANDOFF'),
      timestamp: Date.now(),
      taskId,
      fromAgentId,
      toAgentId,
      reason: reason || 'unspecified',
      context: context || {},
    };
    this.store.insert(rec);
    return rec;
  }

  chainForTask(taskId) {
    return this.store.filter((h) => h.taskId === taskId).reverse();
  }

  all() {
    return this.store.all();
  }
  count() {
    return this.store.count();
  }
}

/* ------------------------------------------------------------------ */
/* Conflict                                                            */
/* ------------------------------------------------------------------ */

export class ConflictEngine {
  constructor(opts) {
    this.store = new JsonStore('agent-conflict', opts);
  }

  /**
   * @param {Array} claims  [{ taskId, agentId, resource, priority, seniority }]
   * @returns {Array} resolved claims with a winner flag
   */
  resolveOverResource(claims) {
    if (!claims.length) return [];
    const resource = claims[0].resource;
    // winner = max priority, tie-break by seniority
    const sorted = [...claims].sort(
      (a, b) => (b.priority - a.priority) || (b.seniority - a.seniority)
    );
    const winner = sorted[0];

    const rec = {
      id: makeId('CONFLICT'),
      timestamp: Date.now(),
      resource,
      claimants: claims.map((c) => ({ agentId: c.agentId, taskId: c.taskId })),
      winnerAgentId: winner.agentId,
      winnerTaskId: winner.taskId,
      losers: sorted.slice(1).map((c) => ({ agentId: c.agentId, taskId: c.taskId })),
      basis: 'priority then seniority',
    };
    this.store.insert(rec);
    return rec;
  }

  all() {
    return this.store.all();
  }
  count() {
    return this.store.count();
  }
}

/* ------------------------------------------------------------------ */
/* Review                                                              */
/* ------------------------------------------------------------------ */

export class ReviewEngine {
  constructor(opts) {
    this.store = new JsonStore('agent-review', opts);
  }

  /**
   * @param {object} r
   * @param {string} r.taskId
   * @param {string} r.workAgentId
   * @param {string} r.reviewerAgentId
   * @param {number} r.score      0..1
   * @param {string} r.verdict    'pass' | 'fail' | 'needs-revision'
   * @param {string} [r.notes]
   */
  review(r) {
    const rec = {
      id: makeId('REVIEW'),
      timestamp: Date.now(),
      taskId: r.taskId,
      workAgentId: r.workAgentId,
      reviewerAgentId: r.reviewerAgentId,
      score: r.score,
      verdict: r.verdict,
      notes: r.notes || null,
    };
    this.store.insert(rec);
    return rec;
  }

  reviewsForAgent(agentId) {
    return this.store.filter((r) => r.workAgentId === agentId);
  }

  all() {
    return this.store.all();
  }
  count() {
    return this.store.count();
  }
}

/* ------------------------------------------------------------------ */
/* Performance Scorecard                                               */
/* ------------------------------------------------------------------ */

export class PerformanceScorecard {
  constructor(reviewEngine, opts) {
    this.reviews = reviewEngine;
    this.store = new JsonStore('agent-performance', opts);
  }

  /** Rolling 0..1 score for an agent from its review scores (pass weighting). */
  scoreFor(agentId) {
    const rows = this.reviews.reviewsForAgent(agentId);
    if (!rows.length) return 0.5;
    let sum = 0;
    for (const r of rows) {
      // verdict penalty: fail counts heavily against, needs-revision partial.
      let s = r.score;
      if (r.verdict === 'fail') s = Math.min(s, 0.2);
      sum += s;
    }
    return sum / rows.length;
  }

  refresh() {
    const agents = [...new Set(this.reviews.all().map((r) => r.workAgentId))];
    const card = agents.map((agentId) => ({
      agentId,
      reviews: this.reviews.reviewsForAgent(agentId).length,
      score: Number(this.scoreFor(agentId).toFixed(3)),
    }));
    const record = {
      id: 'PERFORMANCE_SCORECARD',
      timestamp: Date.now(),
      rows: card,
    };
    const all = this.store.all();
    if (all.length) this.store.update(all[0].id, record);
    else this.store.insert({ ...record, id: 'PERFORMANCE_SCORECARD' });
    return record;
  }

  all() {
    return this.store.all();
  }
}
