/**
 * recommendation.js — Recommendation Engine.
 *
 * Turns a root-cause bucket + decision-replay match into an actionable,
 * evidence-backed recommendation with a confidence score and an "actionable"
 * flag (so HITL Phase 14 knows whether to queue it for approval).
 *
 * It is deliberately rule-driven (not an LLM call) so recommendations are
 * deterministic and auditable, and so the engine works offline in CI.
 */
import { JsonStore, makeId } from './store.js';

const REMEDIATION = {
  external_dependency: {
    action: 'Implement retry with exponential backoff + circuit breaker for the failing dependency',
    playbook: 'resilient-dependency-call',
  },
  data_freshness: {
    action: 'Tighten the refresh SLA and add a staleness alarm with auto re-pull on gap',
    playbook: 'data-freshness-guard',
  },
  auth: {
    action: 'Rotate the credential and validate the refreshed token against the upstream',
    playbook: 'credential-rotation',
  },
  capacity: {
    action: 'Increase capacity / add backpressure handling for the saturated resource',
    playbook: 'capacity-relief',
  },
  code_defect: {
    action: 'Open a fix task with the captured traceback and add a regression test',
    playbook: 'defect-fix',
  },
  unknown: {
    action: 'Escalate for human root-cause review; insufficient signal to auto-remediate',
    playbook: 'human-escalation',
  },
};

export class RecommendationEngine {
  constructor(opts) {
    this.store = new JsonStore('recommendation', opts);
  }

  /**
   * @param {object} args
   * @param {object} args.rca       RootCauseEngine.analyze() result
   * @param {object} [args.replay]  DecisionReplayEngine.replay() result (optional)
   * @returns {object} recommendation record
   */
  recommend({ rca, replay }) {
    const bucket = rca?.bucket || 'unknown';
    const rem = REMEDIATION[bucket] || REMEDIATION.unknown;

    // Confidence blends replay match confidence with RCA depth.
    let base = 50; // unknown baseline
    if (replay) {
      if (replay.confidence === 'HIGH') base = 90;
      else if (replay.confidence === 'MEDIUM') base = 70;
      else if (replay.confidence === 'LOW') base = 55;
      else base = 50;
    }
    // Deeper, well-formed RCA chains add a little confidence.
    base += Math.min(8, (rca?.depth || 0) * 2);
    base = Math.max(0, Math.min(100, Math.round(base)));

    const confidence = base >= 70 ? 'HIGH' : base >= 45 ? 'MEDIUM' : 'LOW';
    const actionable = bucket !== 'unknown';

    const rec = {
      id: makeId('REC'),
      timestamp: Date.now(),
      symptom: rca?.symptom,
      rcaId: rca?.id || null,
      replayId: replay?.id || null,
      replayMatchScore: replay?.matchScore ?? 0,
      bucket,
      confidence,
      confidenceScore: base,
      action: rem.action,
      playbook: rem.playbook,
      actionable,
      evidence: {
        root: rca?.root || null,
        matchedFailure: replay?.match || null,
      },
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
