/**
 * orchestrator.js — Phase 62 Market Intelligence OS.
 *
 * From a demand history plus market-growth / competitor-gap inputs it computes a
 * demand trend and a 0–100 opportunity score, persists a snapshot, and exposes a
 * dashboard. Pure arithmetic, no LLM.
 *
 * OSS: governed per mi-core/server/src/oss-runtime/oss-worker-registry.ts
 */
import { DemandTrendEngine, OpportunityEngine } from './engines.js';
import { JsonStore, makeId } from '../../phase-12-self-improving-intelligence/src/store.js';

export class MarketIntelligenceOS {
  constructor(opts = {}) {
    this.demand = new DemandTrendEngine();
    this.opportunity = new OpportunityEngine();
    this.snapshots = new JsonStore('ph62-snap', opts);
  }

  /** @param {object} input { demandHistory: number[], marketGrowth, competitorGap } */
  analyze(input) {
    const trend = this.demand.analyze(input.demandHistory || []);
    const opp = this.opportunity.score({
      demandTrendRate: trend.normRate,
      marketGrowth: input.marketGrowth || 0,
      competitorGap: input.competitorGap || 0,
    });
    const snapshot = { id: makeId('MKT'), timestamp: Date.now(), trend, opportunity: opp };
    this.snapshots.insert(snapshot);
    return snapshot;
  }

  dashboard() {
    const snap = this.snapshots.all()[0];
    if (!snap) return { phase: 62, status: 'NO_DATA', snapshots: 0 };
    return {
      phase: 62,
      status: snap.opportunity.band,
      snapshots: this.snapshots.all().length,
      demandTrend: snap.trend.trend,
      demandRate: snap.trend.normRate,
      opportunityScore: snap.opportunity.score,
    };
  }
}

export class MarketIntelligenceOSOrchestrator { constructor(opts = {}) { this.os = new MarketIntelligenceOS(opts); } analyze(i) { return this.os.analyze(i); } dashboard() { return this.os.dashboard(); } }
export default MarketIntelligenceOSOrchestrator;
