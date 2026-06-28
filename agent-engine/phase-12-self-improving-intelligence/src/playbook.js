/**
 * playbook.js — Playbook Engine.
 *
 * Materializes a concrete, runnable "playbook" from a recommendation: a list
 * of ordered steps with the expected effect for each. Playbooks are the
 * bridge from "we learned something" to "Phase 13/14 can execute it safely".
 *
 * A playbook is NOT auto-applied — it is a template that the HITL layer
 * (Phase 14) turns into an approval request. Phase 12 only generates it.
 */
import { JsonStore, makeId } from './store.js';

const PLAYBOOK_TEMPLATES = {
  'resilient-dependency-call': [
    { step: 'wrap the failing call in a retry loop with exponential backoff', expect: 'transient failures self-heal' },
    { step: 'add a circuit breaker that opens after N consecutive failures', expect: 'cascading failures are stopped' },
    { step: 'emit a structured warning when the breaker opens', expect: 'operator is notified' },
  ],
  'data-freshness-guard': [
    { step: 'lower the refresh interval for the stale source', expect: 'data is fresher within SLA' },
    { step: 'add a staleness alarm on the data snapshot', expect: 'gaps are detected within minutes' },
    { step: 'add an auto re-pull on detected gap', expect: 'recovery without human action' },
  ],
  'credential-rotation': [
    { step: 'rotate the upstream credential', expect: 'auth no longer rejected' },
    { step: 'validate the new token against the upstream', expect: 'confirmed working' },
    { step: 'add an expiry monitor for the new credential', expect: 'no silent future failure' },
  ],
  'capacity-relief': [
    { step: 'increase the limit / scale the saturated resource', expect: 'load is absorbed' },
    { step: 'add backpressure so producers slow down under load', expect: 'no overload cascade' },
  ],
  'defect-fix': [
    { step: 'reproduce with the captured signal', expect: 'bug confirmed locally' },
    { step: 'implement the fix', expect: 'root cause addressed' },
    { step: 'add a regression test', expect: 'no regression' },
  ],
  'human-escalation': [
    { step: 'attach the RCA chain and signal to an escalation ticket', expect: 'human picks up with full context' },
  ],
};

export class PlaybookEngine {
  constructor(opts) {
    this.store = new JsonStore('playbook', opts);
  }

  /**
   * @param {object} recommendation RecommendationEngine.recommend() result
   * @returns {object} playbook record
   */
  fromRecommendation(recommendation) {
    const tpl = PLAYBOOK_TEMPLATES[recommendation.playbook] || PLAYBOOK_TEMPLATES['human-escalation'];
    const playbook = {
      id: makeId('PB'),
      timestamp: Date.now(),
      recommendationId: recommendation.id,
      name: recommendation.playbook,
      bucket: recommendation.bucket,
      confidence: recommendation.confidence,
      steps: tpl.map((s, i) => ({ no: i + 1, ...s })),
      status: 'draft', // draft -> queued(phase14) -> approved -> applied -> verified
    };
    this.store.insert(playbook);
    return playbook;
  }

  all() {
    return this.store.all();
  }
  count() {
    return this.store.count();
  }
}
