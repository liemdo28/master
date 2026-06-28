/**
 * Phase 21 — Customer Experience Operating System.
 *
 * Unifies customer profiles, feedback ingestion, review intelligence, sentiment
 * risk, service recovery, and loyalty into one CX OS. Deterministic, no LLM,
 * portable JSON persistence (reuses Phase 12 JsonStore). All production-facing
 * actions (response publishing) are approval-gated — recovery tasks are drafted,
 * never auto-sent.
 *
 * Required modules (implemented as engine classes below):
 *   CustomerProfileRegistry · FeedbackIngestionEngine · ReviewIntelligenceEngine
 *   SentimentRiskEngine · ServiceRecoveryEngine · LoyaltySignalEngine
 *   CustomerExperienceScorecard
 */
import { JsonStore, makeId } from '../../phase-12-self-improving-intelligence/src/store.js';

const POSITIVE = ['great', 'love', 'excellent', 'amazing', 'best', 'fresh', 'fast', 'friendly'];
const NEGATIVE = ['bad', 'slow', 'cold', 'rude', 'wrong', 'late', 'dirty', 'worst', 'sick', 'refund'];

export class CustomerProfileRegistry {
  constructor(opts) { this.store = new JsonStore('cx-profiles', opts); }
  upsert(p) {
    const existing = this.store.find((r) => r.customerId === p.customerId);
    if (existing) return this.store.update(existing.id, { ...p });
    return this.store.insert({ id: makeId('CUST'), customerId: p.customerId, name: p.name || null, orders: p.orders || 0, loyaltyTier: p.loyaltyTier || 'standard' });
  }
  all() { return this.store.all(); }
}

export class FeedbackIngestionEngine {
  constructor(opts) { this.store = new JsonStore('cx-feedback', opts); }
  ingest(fb) {
    return this.store.insert({ id: makeId('FB'), timestamp: Date.now(), source: fb.source, brand: fb.brand, customerId: fb.customerId || null, text: fb.text, rating: fb.rating ?? null });
  }
  all() { return this.store.all(); }
  recent(brand) { return this.store.filter((f) => !brand || f.brand === brand); }
}

export class ReviewIntelligenceEngine {
  scoreText(text = '') {
    const lc = text.toLowerCase();
    let score = 0;
    for (const w of POSITIVE) if (lc.includes(w)) score += 1;
    for (const w of NEGATIVE) if (lc.includes(w)) score -= 1;
    const polarity = score > 0 ? 'positive' : score < 0 ? 'negative' : 'neutral';
    return { score, polarity };
  }
  analyze(feedback) {
    return feedback.map((f) => ({ id: f.id, brand: f.brand, ...this.scoreText(f.text), rating: f.rating }));
  }
}

export class SentimentRiskEngine {
  constructor(opts) { this.store = new JsonStore('cx-sentiment-risk', opts); }
  /** Window of analyzed reviews -> risk level for a brand. */
  evaluate(brand, analyzed) {
    const negatives = analyzed.filter((a) => a.polarity === 'negative').length;
    const total = analyzed.length || 1;
    const negRate = negatives / total;
    let level = 'LOW';
    if (negRate >= 0.5 || negatives >= 3) level = 'HIGH';
    else if (negRate >= 0.25) level = 'MEDIUM';
    const rec = { id: makeId('SRISK'), timestamp: Date.now(), brand, negatives, total, negRate: Number(negRate.toFixed(2)), level };
    this.store.insert(rec);
    return rec;
  }
  all() { return this.store.all(); }
}

export class ServiceRecoveryEngine {
  constructor(opts) { this.store = new JsonStore('cx-recovery', opts); }
  /** Create an approval-gated recovery task + a DRAFT response (never auto-sent). */
  createRecoveryTask(risk) {
    const draft = `Hi — we're sorry about your recent experience with ${risk.brand}. We'd like to make it right: please reach out for a replacement or refund. (DRAFT — pending approval)`;
    return this.store.insert({
      id: makeId('REC'), timestamp: Date.now(), brand: risk.brand, riskLevel: risk.level,
      status: 'pending_approval', approvalRequired: true, autoSent: false, responseDraft: draft,
    });
  }
  all() { return this.store.all(); }
  pending() { return this.store.filter((r) => r.status === 'pending_approval'); }
}

export class LoyaltySignalEngine {
  signal(profile) {
    if (profile.orders >= 20) return { customerId: profile.customerId, tier: 'vip', action: 'offer exclusive reward' };
    if (profile.orders >= 5) return { customerId: profile.customerId, tier: 'regular', action: 'invite to loyalty program' };
    return { customerId: profile.customerId, tier: 'new', action: 'welcome offer' };
  }
}

export class CustomerExperienceOS {
  constructor(opts = {}) {
    this.profiles = new CustomerProfileRegistry(opts);
    this.feedback = new FeedbackIngestionEngine(opts);
    this.reviews = new ReviewIntelligenceEngine(opts);
    this.sentimentRisk = new SentimentRiskEngine(opts);
    this.recovery = new ServiceRecoveryEngine(opts);
    this.loyalty = new LoyaltySignalEngine(opts);
  }

  /** Full CX cycle: ingest -> analyze -> risk -> (if risky) recovery draft. */
  processBrandFeedback(brand) {
    const fb = this.feedback.recent(brand);
    const analyzed = this.reviews.analyze(fb);
    const risk = this.sentimentRisk.evaluate(brand, analyzed);
    let recovery = null;
    if (risk.level === 'HIGH' || risk.level === 'MEDIUM') recovery = this.recovery.createRecoveryTask(risk);
    return { brand, analyzed, risk, recovery };
  }

  dashboard() {
    const risks = this.sentimentRisk.all();
    const worst = risks.reduce((m, r) => (r.negRate > (m?.negRate ?? -1) ? r : m), null);
    const pending = this.recovery.pending().length;
    return {
      status: worst && worst.level === 'HIGH' ? 'AT_RISK' : pending > 0 ? 'WATCH' : 'HEALTHY',
      profiles: this.profiles.all().length,
      feedback: this.feedback.all().length,
      sentimentRisks: risks.length,
      worstBrand: worst ? worst.brand : null,
      pendingRecoveries: pending,
    };
  }
}

export default CustomerExperienceOS;
