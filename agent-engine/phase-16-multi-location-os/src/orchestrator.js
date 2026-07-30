/**
 * orchestrator.js — Phase 16 Multi-Location OS.
 *
 * Wires brand/location/permission/KPI/risk engines and adds a cross-location
 * reporting view that the executive layer (Phase 19) can consume.
 */
import {
  BrandRegistry,
  LocationRegistry,
  LocationPermission,
  LocationKPILayer,
  LocationRiskEngine,
} from './engines.js';

export class MultiLocationOS {
  constructor(opts = {}) {
    this.brands = new BrandRegistry(opts);
    this.locations = new LocationRegistry(opts);
    this.permissions = new LocationPermission(opts);
    this.kpis = new LocationKPILayer(opts);
    this.risk = new LocationRiskEngine(opts);
  }

  /** Convenience: register brand + its locations in one call. */
  provisionBrand(brand, locations = []) {
    const b = this.brands.register(brand);
    for (const loc of locations) {
      this.locations.register({ ...loc, brandId: b.id });
    }
    return b;
  }

  /** Record KPIs for a location and immediately risk-evaluate. */
  observe(locationId, metrics) {
    const loc = this.locations.get(locationId);
    if (!loc) throw new Error(`unknown location ${locationId}`);
    const snap = this.kpis.record({ locationId, brandId: loc.brandId, metrics });
    const risk = this.risk.evaluate(snap);
    return { snapshot: snap, risk };
  }

  /** Cross-location executive report for a brand. */
  brandReport(brandId) {
    const brand = this.brands.get(brandId);
    const locs = this.locations.forBrand(brandId);
    const rollup = this.kpis.rollupByBrand(brandId);
    const atRisk = this.risk
      .all()
      .filter((r) => r.brandId === brandId && r.status === 'at-risk')
      .map((r) => ({ locationId: r.locationId, alerts: r.alerts }));
    return {
      brandId,
      brandName: brand?.name || null,
      locationCount: locs.length,
      rollup,
      atRisk,
      healthy: atRisk.length === 0,
    };
  }

  /** Fleet-wide report across all brands. */
  fleetReport() {
    return this.brands.all().map((b) => this.brandReport(b.id));
  }
}

export default MultiLocationOS;
