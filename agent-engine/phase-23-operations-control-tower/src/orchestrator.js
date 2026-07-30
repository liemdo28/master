/**
 * Phase 23 — Restaurant Operations Control Tower.
 * Store health, checklist compliance, food-safety monitoring, incident routing,
 * staffing risk, operations scorecard. Deterministic, approval-aware.
 * Modules: StoreHealthEngine · ChecklistComplianceEngine · FoodSafetyMonitor
 *          · IncidentRouter · StaffingRiskEngine · OperationsScorecard
 */
import { JsonStore, makeId } from '../../phase-12-self-improving-intelligence/src/store.js';

export class ChecklistComplianceEngine {
  constructor(opts) { this.store = new JsonStore('ops-checklists', opts); }
  submit(s) { return this.store.insert({ id: makeId('CHK'), timestamp: Date.now(), storeId: s.storeId, type: s.type, submitted: true }); }
  /** which required checklists are missing for a store today */
  missing(storeId, required = ['opening', 'food_safety', 'closing']) {
    const done = new Set(this.store.filter((c) => c.storeId === storeId).map((c) => c.type));
    return required.filter((r) => !done.has(r));
  }
}

export class FoodSafetyMonitor {
  constructor(opts) { this.store = new JsonStore('ops-foodsafety', opts); }
  evaluate(storeId, missingChecklists) {
    const foodSafetyMissing = missingChecklists.includes('food_safety');
    const level = foodSafetyMissing ? 'HIGH' : 'LOW';
    const rec = { id: makeId('FS'), timestamp: Date.now(), storeId, foodSafetyMissing, level };
    this.store.insert(rec);
    return rec;
  }
}

export class IncidentRouter {
  constructor(opts) { this.store = new JsonStore('ops-incidents', opts); }
  route(incident) {
    const owner = incident.level === 'HIGH' ? 'store-manager' : 'shift-lead';
    return this.store.insert({ id: makeId('INC'), timestamp: Date.now(), storeId: incident.storeId, level: incident.level, owner, status: 'alerted', approvalRequired: incident.level === 'HIGH', evidenceRef: `foodsafety:${incident.storeId}:missing` });
  }
  all() { return this.store.all(); }
}

export class StaffingRiskEngine {
  evaluate(store) {
    const ratio = store.scheduledStaff / Math.max(1, store.requiredStaff);
    const level = ratio < 0.6 ? 'HIGH' : ratio < 0.85 ? 'MEDIUM' : 'LOW';
    return { storeId: store.storeId, ratio: Number(ratio.toFixed(2)), level };
  }
}

export class StoreHealthEngine {
  constructor(opts) { this.store = new JsonStore('ops-storehealth', opts); }
  evaluate(storeId, signals) {
    const score = 100 - (signals.missingChecklists * 15) - (signals.foodSafetyMissing ? 30 : 0) - (signals.staffingLevel === 'HIGH' ? 20 : 0);
    const status = score < 50 ? 'CRITICAL' : score < 75 ? 'AT_RISK' : 'HEALTHY';
    const rec = { id: makeId('SH'), timestamp: Date.now(), storeId, score: Math.max(0, score), status };
    this.store.insert(rec);
    return rec;
  }
  all() { return this.store.all(); }
}

export class OperationsControlTower {
  constructor(opts = {}) {
    this.checklists = new ChecklistComplianceEngine(opts);
    this.foodSafety = new FoodSafetyMonitor(opts);
    this.incidents = new IncidentRouter(opts);
    this.staffing = new StaffingRiskEngine(opts);
    this.storeHealth = new StoreHealthEngine(opts);
  }
  /** Scenario: missing food-safety submission -> store risk -> manager alert -> evidence -> summary */
  inspectStore(store) {
    const missing = this.checklists.missing(store.storeId);
    const fs = this.foodSafety.evaluate(store.storeId, missing);
    const staffing = this.staffing.evaluate(store);
    const health = this.storeHealth.evaluate(store.storeId, { missingChecklists: missing.length, foodSafetyMissing: fs.foodSafetyMissing, staffingLevel: staffing.level });
    let incident = null;
    if (fs.level === 'HIGH') incident = this.incidents.route({ storeId: store.storeId, level: 'HIGH' });
    return { missing, foodSafety: fs, staffing, health, incident };
  }
  dashboard() {
    const health = this.storeHealth.all();
    const critical = health.filter((h) => h.status === 'CRITICAL').length;
    return { status: critical > 0 ? 'CRITICAL' : 'WATCH', stores: new Set(health.map((h) => h.storeId)).size, incidents: this.incidents.all().length, criticalStores: critical };
  }
}

export default OperationsControlTower;
