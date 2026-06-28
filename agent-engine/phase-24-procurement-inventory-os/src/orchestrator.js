/**
 * Phase 24 — Procurement & Inventory Intelligence.
 * Vendor registry, ingredient cost, inventory signals, waste risk, COGS impact.
 * Modules: VendorRegistry · IngredientCostEngine · InventorySignalEngine
 *          · WasteRiskEngine · CogsImpactEngine · ProcurementScorecard
 */
import { JsonStore, makeId } from '../../phase-12-self-improving-intelligence/src/store.js';

export class VendorRegistry {
  constructor(opts) { this.store = new JsonStore('proc-vendors', opts); }
  register(v) { return this.store.insert({ id: makeId('VEND'), name: v.name, ingredient: v.ingredient, reliability: v.reliability ?? 0.9 }); }
  all() { return this.store.all(); }
  forIngredient(ing) { return this.store.filter((v) => v.ingredient === ing); }
}

export class IngredientCostEngine {
  constructor(opts) { this.store = new JsonStore('proc-costs', opts); }
  record(c) { return this.store.insert({ id: makeId('COST'), timestamp: Date.now(), ingredient: c.ingredient, unitCost: c.unitCost, prevCost: c.prevCost ?? c.unitCost }); }
  /** % change vs previous */
  delta(rec) { const d = ((rec.unitCost - rec.prevCost) / Math.max(0.01, rec.prevCost)) * 100; return Number(d.toFixed(1)); }
}

export class InventorySignalEngine {
  evaluate(item) {
    const ratio = item.onHand / Math.max(1, item.par);
    const signal = ratio < 0.3 ? 'reorder_now' : ratio < 0.6 ? 'reorder_soon' : 'ok';
    return { ingredient: item.ingredient, onHand: item.onHand, par: item.par, ratio: Number(ratio.toFixed(2)), signal };
  }
}

export class WasteRiskEngine {
  evaluate(item) {
    const wasteRate = item.wasted / Math.max(1, item.used + item.wasted);
    const level = wasteRate >= 0.15 ? 'HIGH' : wasteRate >= 0.07 ? 'MEDIUM' : 'LOW';
    return { ingredient: item.ingredient, wasteRate: Number(wasteRate.toFixed(2)), level };
  }
}

export class CogsImpactEngine {
  constructor(opts) { this.store = new JsonStore('proc-cogs', opts); }
  /** ingredient cost increase -> COGS risk + CFO alert if material */
  evaluate(ingredient, costDeltaPct, weightInCogs) {
    const cogsImpactPct = Number(((costDeltaPct * weightInCogs) / 100).toFixed(2));
    const level = cogsImpactPct >= 2 ? 'HIGH' : cogsImpactPct >= 0.5 ? 'MEDIUM' : 'LOW';
    const rec = { id: makeId('COGS'), timestamp: Date.now(), ingredient, costDeltaPct, weightInCogs, cogsImpactPct, level, cfoAlert: level === 'HIGH' };
    this.store.insert(rec);
    return rec;
  }
  all() { return this.store.all(); }
}

export class ProcurementInventoryOS {
  constructor(opts = {}) {
    this.vendors = new VendorRegistry(opts);
    this.costs = new IngredientCostEngine(opts);
    this.inventory = new InventorySignalEngine(opts);
    this.waste = new WasteRiskEngine(opts);
    this.cogs = new CogsImpactEngine(opts);
  }
  /** Scenario: ingredient cost increase -> COGS risk -> vendor task -> CFO alert */
  assessIngredient({ ingredient, unitCost, prevCost, weightInCogs }) {
    const costRec = this.costs.record({ ingredient, unitCost, prevCost });
    const deltaPct = this.costs.delta(costRec);
    const cogs = this.cogs.evaluate(ingredient, deltaPct, weightInCogs);
    const vendors = this.vendors.forIngredient(ingredient);
    const vendorTask = cogs.level !== 'LOW'
      ? { title: `Re-source ${ingredient} (cost +${deltaPct}%)`, division: 'finance', owner: 'procurement', altVendors: vendors.length, approvalRequired: true }
      : null;
    return { costDeltaPct: deltaPct, cogs, vendorTask, cfoAlert: cogs.cfoAlert };
  }
  dashboard() {
    const cogs = this.cogs.all();
    const high = cogs.filter((c) => c.level === 'HIGH').length;
    return { status: high > 0 ? 'AT_RISK' : 'HEALTHY', vendors: this.vendors.all().length, cogsAssessments: cogs.length, highCogsRisks: high };
  }
}

export default ProcurementInventoryOS;
