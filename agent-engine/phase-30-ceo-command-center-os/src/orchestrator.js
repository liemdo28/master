/**
 * Phase 30 — CEO Command Center 2.0. OSS: Grafana (TCP 3030). Fallback: in-engine dashboard.
 * Modules: CEOObjectiveBoard · ApprovalCommandCenter · RiskCommandCenter · KPICommandCenter
 *          · WorkforceCommandCenter · OSSCommandCenter · AutonomyCommandCenter · DailyBriefingEngine
 */
import { JsonStore, makeId } from '../../phase-12-self-improving-intelligence/src/store.js';

export class CEOObjectiveBoard {
  constructor(opts) { this.store = new JsonStore('ceo-objectives', opts); }
  add(obj) { return this.store.insert({ id: makeId('OBJ'), timestamp: Date.now(), objective: obj.objective, priority: obj.priority || 'P2', owner: obj.owner || 'ceo', division: obj.division, status: 'active', blockers: [] }); }
  addBlocker(objId, blocker) { const r = this.store.find((x) => x.id === objId); if (r) { r.blockers.push(blocker); this.store.update(r.id, { blockers: r.blockers }); } return r; }
  active() { return this.store.filter((r) => r.status === 'active'); }
}

export class ApprovalCommandCenter {
  constructor(opts) { this.store = new JsonStore('ceo-approvals', opts); }
  add(a) { return this.store.insert({ id: makeId('CAPP'), timestamp: Date.now(), title: a.title, division: a.division, owner: a.owner, reason: a.reason, status: 'pending', urgency: a.urgency || 'normal' }); }
  pending() { return this.store.filter((r) => r.status === 'pending'); }
}

export class RiskCommandCenter {
  constructor(opts) { this.store = new JsonStore('ceo-risks', opts); }
  add(risk) { return this.store.insert({ id: makeId('RISKCC'), timestamp: Date.now(), title: risk.title, category: risk.category, level: risk.level, owner: risk.owner, division: risk.division, status: 'open' }); }
  critical() { return this.store.filter((r) => (r.level === 'HIGH' || r.level === 'CRITICAL') && r.status === 'open'); }
}

export class KPICommandCenter {
  constructor(opts) { this.store = new JsonStore('ceo-kpis', opts); }
  record(kpi) { return this.store.insert({ id: makeId('KPI'), timestamp: Date.now(), name: kpi.name, value: kpi.value, unit: kpi.unit || '', target: kpi.target || null }); }
  latest(name) { const recs = this.store.filter((r) => r.name === name); return recs.length > 0 ? recs[recs.length - 1] : null; }
}

export class WorkforceCommandCenter {
  constructor(opts) { this.store = new JsonStore('ceo-workforce', opts); }
  report(data) { return this.store.insert({ id: makeId('WFCC'), timestamp: Date.now(), activeEmployees: data.activeEmployees || 0, laborCostPct: data.laborCostPct || 0, openShifts: data.openShifts || 0, atRiskStores: data.atRiskStores || 0, status: data.status || 'HEALTHY' }); }
  latest() { const recs = this.store.all(); return recs.length > 0 ? recs[recs.length - 1] : null; }
}

export class OSSCommandCenter {
  constructor(opts) { this.store = new JsonStore('ceo-oss', opts); }
  record(ossSummary) { return this.store.insert({ id: makeId('OCC'), timestamp: Date.now(), ...ossSummary }); }
  latest() { const recs = this.store.all(); return recs.length > 0 ? recs[recs.length - 1] : null; }
}

export class AutonomyCommandCenter {
  constructor(opts) { this.store = new JsonStore('ceo-autonomy', opts); }
  log(action) { return this.store.insert({ id: makeId('AUTC'), timestamp: Date.now(), action: action.action, status: action.status || 'executed', approved: action.approved || false, outcome: action.outcome || '' }); }
  unapproved() { return this.store.filter((r) => r.approved === false); }
}

export class DailyBriefingEngine {
  constructor(opts = {}) {
    this.objectives = new CEOObjectiveBoard(opts);
    this.approvals = new ApprovalCommandCenter(opts);
    this.risks = new RiskCommandCenter(opts);
    this.kpis = new KPICommandCenter(opts);
    this.workforce = new WorkforceCommandCenter(opts);
    this.oss = new OSSCommandCenter(opts);
    this.autonomy = new AutonomyCommandCenter(opts);
  }

  /** CEO: "What needs my attention today?" */
  generateBriefing() {
    const blockers = this.objectives.active().flatMap((o) => o.blockers.map((b) => ({ objective: o.objective, blocker: b })));
    const pendingApprovals = this.approvals.pending().map((a) => ({ title: a.title, division: a.division, urgency: a.urgency }));
    const criticalRisks = this.risks.critical().map((r) => ({ title: r.title, level: r.level, owner: r.owner }));
    const unapprovedAutonomy = this.autonomy.unapproved().map((a) => ({ action: a.action, outcome: a.outcome }));
    const nextDecisions = [];
    if (pendingApprovals.length > 0) nextDecisions.push('review ' + pendingApprovals.length + ' pending approval(s)');
    if (criticalRisks.length > 0) nextDecisions.push('address ' + criticalRisks.length + ' critical risk(s)');
    if (blockers.length > 0) nextDecisions.push('unblock ' + blockers.length + ' objective blocker(s)');
    if (unapprovedAutonomy.length > 0) nextDecisions.push('approve ' + unapprovedAutonomy.length + ' autonomous action(s)');
    return {
      timestamp: new Date().toISOString(),
      activeObjectives: this.objectives.active().length,
      blockers, pendingApprovals, criticalRisks, unapprovedAutonomy,
      ossHealth: this.oss.latest(),
      workforce: this.workforce.latest(),
      nextDecisions,
      summary: 'CEO: ' + nextDecisions.length + ' decision(s). ' + (criticalRisks.length > 0 ? criticalRisks.length + ' risk(s). ' : '') + (pendingApprovals.length > 0 ? pendingApprovals.length + ' approval(s) pending.' : '') + ' System is ' + (criticalRisks.length === 0 ? 'OPERATIONAL.' : 'REQUIRES ACTION.'),
    };
  }
}

export default DailyBriefingEngine;