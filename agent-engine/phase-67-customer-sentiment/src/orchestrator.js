/**
 * orchestrator.js — Phase 67 Customer Sentiment OS.
 *
 * From a set of 1–5★ reviews (in chronological order) it computes sentiment
 * (average, distribution, NPS, negative ratio), detects the trend, derives a
 * combined risk/growth posture, persists a snapshot, and exposes a dashboard.
 * Pure arithmetic, no LLM.
 *
 * OSS: governed per mi-core/server/src/oss-runtime/oss-worker-registry.ts
 */
import { SentimentEngine, TrendEngine } from './engines.js';
import { JsonStore, makeId } from '../../phase-12-self-improving-intelligence/src/store.js';

export class CustomerSentimentOS {
  constructor(opts = {}) {
    this.sentiment = new SentimentEngine();
    this.trend = new TrendEngine();
    this.snapshots = new JsonStore('ph67-snap', opts);
  }

  /** @param {object} input { reviews: [{ rating }] }  // chronological, oldest first */
  analyze(input) {
    const reviews = input.reviews || [];
    const sentiment = this.sentiment.analyze(reviews);
    const trend = this.trend.detect(reviews.map((r) => r.rating));

    // Posture: negative sentiment OR declining trend with high negative ratio = at risk.
    let posture = 'STABLE';
    if (sentiment.band === 'NEGATIVE' || (trend.direction === 'declining' && sentiment.negativeRatio >= 0.3)) posture = 'AT_RISK';
    else if (sentiment.band === 'POSITIVE' && trend.direction === 'improving') posture = 'GROWTH';

    const snapshot = { id: makeId('SEN'), timestamp: Date.now(), sentiment, trend, posture };
    this.snapshots.insert(snapshot);
    return snapshot;
  }

  dashboard() {
    const snap = this.snapshots.all()[0];
    if (!snap) return { phase: 67, status: 'NO_DATA', snapshots: 0 };
    return {
      phase: 67,
      status: snap.posture,
      snapshots: this.snapshots.all().length,
      avgRating: snap.sentiment.avg,
      nps: snap.sentiment.nps,
      negativeRatio: snap.sentiment.negativeRatio,
      sentimentBand: snap.sentiment.band,
      trend: snap.trend.direction,
    };
  }
}

export class CustomerSentimentOSOrchestrator { constructor(opts = {}) { this.os = new CustomerSentimentOS(opts); } analyze(i) { return this.os.analyze(i); } dashboard() { return this.os.dashboard(); } }
export default CustomerSentimentOSOrchestrator;
