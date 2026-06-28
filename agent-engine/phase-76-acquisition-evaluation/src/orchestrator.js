/**
 * orchestrator.js — Phase 76 Acquisition Evaluation OS.
 *
 * evaluate({ target }) values an acquisition target by EBITDA multiple, compares
 * to the asking price, returns a verdict + payback, persists a snapshot, and
 * exposes a dashboard. Pure arithmetic, no LLM.
 *
 * OSS: governed per mi-core/server/src/oss-runtime/oss-worker-registry.ts
 */
import { ValuationEngine } from './engines.js';
import { JsonStore, makeId } from '../../phase-12-self-improving-intelligence/src/store.js';

export class AcquisitionEvaluationOS {
  constructor(opts = {}) {
    this.engine = new ValuationEngine();
    this.snapshots = new JsonStore('ph76-snap', opts);
  }

  /** @param {object} input { target: { name, ebitda, multiple, askingPrice, annualProfit } } */
  evaluate(input) {
    const result = this.engine.evaluate(input.target);
    const recommendation = result.verdict === 'OVERVALUED' ? 'PASS' : result.paybackYears <= 5 ? 'PURSUE' : 'NEGOTIATE';
    const snapshot = { id: makeId('ACQ'), timestamp: Date.now(), ...result, recommendation };
    this.snapshots.insert(snapshot);
    return snapshot;
  }

  dashboard() {
    const snap = this.snapshots.all()[0];
    if (!snap) return { phase: 76, status: 'NO_DATA', snapshots: 0 };
    return {
      phase: 76,
      status: snap.recommendation,
      snapshots: this.snapshots.all().length,
      target: snap.name,
      verdict: snap.verdict,
      gapPct: snap.gapPct,
      paybackYears: snap.paybackYears,
    };
  }
}

export class AcquisitionEvaluationOSOrchestrator { constructor(opts = {}) { this.os = new AcquisitionEvaluationOS(opts); } evaluate(i) { return this.os.evaluate(i); } dashboard() { return this.os.dashboard(); } }
export default AcquisitionEvaluationOSOrchestrator;
