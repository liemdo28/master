/**
 * orchestrator.js — Phase 12 Self-Improving Intelligence orchestrator.
 *
 * Wires the engines into the canonical learning cycle:
 *
 *   failure detected
 *     -> decision replay (have we seen this before?)
 *     -> root cause analysis (5-Whys + bucketing)
 *     -> recommendation (evidence-backed, confidence-scored)
 *     -> playbook (concrete steps for Phase 13/14 to act on)
 *     -> learning scorecard updated
 *
 * Nothing here mutates production. Phase 12 only LEARNS and RECOMMENDS.
 */
import { OutcomeMemory, FailureMemory, ApprovalMemory } from './memories.js';
import { DecisionReplayEngine } from './decision-replay.js';
import { RootCauseEngine } from './root-cause.js';
import { RecommendationEngine } from './recommendation.js';
import { PlaybookEngine } from './playbook.js';
import { JsonStore } from './store.js';

export class SelfImprovingIntelligence {
  constructor(opts = {}) {
    this.outcomes = new OutcomeMemory(opts);
    this.failures = new FailureMemory(opts);
    this.approvals = new ApprovalMemory(opts);
    this.replay = new DecisionReplayEngine(this.failures, opts);
    this.rca = new RootCauseEngine(opts);
    this.recommendation = new RecommendationEngine(opts);
    this.playbook = new PlaybookEngine(opts);
    this.scorecardStore = new JsonStore('learning-scorecard', opts);
  }

  /**
   * Run the full learning cycle for a single failure observation.
   * @param {object} failure { actionId, actionType, symptom, signal?, context? }
   * @returns {object} { failure, replay, rca, recommendation, playbook }
   */
  learn(failure) {
    const f = this.failures.record(failure);
    const replay = this.replay.replay({
      symptom: failure.symptom,
      actionType: failure.actionType,
      signal: failure.signal,
    });
    const rca = this.rca.analyze({
      symptom: failure.symptom,
      signal: failure.signal,
      context: failure.context,
    });
    const recommendation = this.recommendation.recommend({ rca, replay });
    const playbook = this.playbook.fromRecommendation(recommendation);
    this._refreshScorecard();
    return { failure: f, replay, rca, recommendation, playbook };
  }

  /** Record an outcome so the engines have data about what succeeded too. */
  observeOutcome(o) {
    return this.outcomes.record(o);
  }

  /** Record a human approval/rejection decision for later pattern learning. */
  observeApproval(a) {
    return this.approvals.record(a);
  }

  scorecard() {
    const existing = this.scorecardStore.all()[0];
    return existing || this._refreshScorecard();
  }

  _refreshScorecard() {
    const card = {
      id: 'LEARNING_SCORECARD',
      timestamp: Date.now(),
      failuresAnalyzed: this.failures.count(),
      outcomesStored: this.outcomes.count(),
      approvalsLearned: this.approvals.count(),
      playbooksGenerated: this.playbook.count(),
      recommendationsGenerated: this.recommendation.count(),
      rcaPatternsFound: this.rca.count(),
      replaysRun: this.replay.count(),
      topBucket: this._topBucket(),
    };
    // upsert single-row scorecard
    const all = this.scorecardStore.all();
    if (all.length) {
      this.scorecardStore.update(all[0].id, card);
    } else {
      this.scorecardStore.insert({ ...card, id: 'LEARNING_SCORECARD' });
    }
    return card;
  }

  _topBucket() {
    const counts = {};
    for (const r of this.rca.all()) counts[r.bucket] = (counts[r.bucket] || 0) + 1;
    let top = null;
    let n = 0;
    for (const [k, v] of Object.entries(counts)) {
      if (v > n) {
        n = v;
        top = k;
      }
    }
    return top;
  }
}

export default SelfImprovingIntelligence;
