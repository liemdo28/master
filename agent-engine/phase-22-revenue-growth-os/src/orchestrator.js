/**
 * Phase 22 — Sales & Revenue Growth OS.
 * Revenue opportunities, channel performance, promotion planning, offer risk,
 * sales-task routing, growth scorecard. Approval-gated plans. Deterministic.
 * Modules: RevenueOpportunityEngine · ChannelPerformanceEngine · PromotionPlanner
 *          · OfferRiskEngine · SalesTaskRouter · GrowthScorecard
 */
import { JsonStore, makeId } from '../../phase-12-self-improving-intelligence/src/store.js';

export class ChannelPerformanceEngine {
  constructor(opts) { this.store = new JsonStore('rev-channels', opts); }
  record(channel) { return this.store.insert({ id: makeId('CHAN'), timestamp: Date.now(), ...channel }); }
  analyze(channels) {
    return channels.map((c) => ({ ...c, roi: c.spend > 0 ? Number((c.revenue / c.spend).toFixed(2)) : c.revenue > 0 ? Infinity : 0 }))
      .sort((a, b) => (b.roi === Infinity ? 1e9 : b.roi) - (a.roi === Infinity ? 1e9 : a.roi));
  }
}

export class RevenueOpportunityEngine {
  constructor(opts) { this.store = new JsonStore('rev-opportunities', opts); }
  /** rank channels by headroom = (potential - current) weighted by roi */
  find(channels) {
    const ops = channels.map((c) => ({
      channel: c.channel, current: c.revenue, potential: c.potential ?? c.revenue * 1.2,
      headroom: Number(((c.potential ?? c.revenue * 1.2) - c.revenue).toFixed(2)),
      score: Number((((c.potential ?? c.revenue * 1.2) - c.revenue) * (c.spend > 0 ? c.revenue / c.spend : 1)).toFixed(2)),
    })).sort((a, b) => b.score - a.score);
    ops.forEach((o) => this.store.insert({ id: makeId('OPP'), timestamp: Date.now(), ...o }));
    return ops;
  }
  all() { return this.store.all(); }
}

export class OfferRiskEngine {
  evaluate(offer) {
    // discount erodes margin; flag if discount pushes margin below 15%
    const projectedMargin = offer.baseMargin - offer.discountPct;
    const level = projectedMargin < 0 ? 'CRITICAL' : projectedMargin < 15 ? 'HIGH' : projectedMargin < 25 ? 'MEDIUM' : 'LOW';
    return { offer: offer.name, projectedMargin: Number(projectedMargin.toFixed(1)), level, approvalRequired: level !== 'LOW' };
  }
}

export class PromotionPlanner {
  constructor(opts) { this.store = new JsonStore('rev-promotions', opts); }
  plan(opportunity, offer, risk) {
    return this.store.insert({
      id: makeId('PROMO'), timestamp: Date.now(), channel: opportunity.channel, offer: offer.name,
      headroom: opportunity.headroom, riskLevel: risk.level, status: risk.approvalRequired ? 'pending_approval' : 'ready', approvalRequired: risk.approvalRequired,
    });
  }
  all() { return this.store.all(); }
}

export class SalesTaskRouter {
  route(channel) {
    const map = { doordash: 'operations', website: 'marketing', seo: 'marketing', ads: 'marketing', instore: 'operations' };
    return { channel, division: map[channel] || 'marketing' };
  }
}

export class RevenueGrowthOS {
  constructor(opts = {}) {
    this.channels = new ChannelPerformanceEngine(opts);
    this.opportunities = new RevenueOpportunityEngine(opts);
    this.offerRisk = new OfferRiskEngine(opts);
    this.promotions = new PromotionPlanner(opts);
    this.router = new SalesTaskRouter(opts);
  }
  /** objective -> channel analysis -> opportunities -> approval-gated promo plan + routed tasks */
  growthCycle(channels, offer) {
    const analyzed = this.channels.analyze(channels);
    const ops = this.opportunities.find(channels);
    const top = ops[0];
    const risk = this.offerRisk.evaluate(offer);
    const promo = this.promotions.plan(top, offer, risk);
    const tasks = ops.slice(0, 3).map((o) => ({ ...this.router.route(o.channel), title: `Grow ${o.channel} revenue (+${o.headroom})` }));
    return { analyzed, opportunities: ops, topOpportunity: top, offerRisk: risk, promotion: promo, tasks };
  }
  dashboard() {
    const promos = this.promotions.all();
    const pending = promos.filter((p) => p.approvalRequired).length;
    return { status: pending > 0 ? 'WATCH' : 'HEALTHY', opportunities: this.opportunities.all().length, promotions: promos.length, pendingApproval: pending };
  }
}

export default RevenueGrowthOS;
