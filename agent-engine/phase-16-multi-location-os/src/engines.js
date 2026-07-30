/**
 * engines.js — Phase 16 Multi-Location OS building blocks.
 *
 *   • BrandRegistry          — the brands Mi operates (each owns locations).
 *   • LocationRegistry       — physical/digital locations, each bound to a brand.
 *   • LocationPermission     — per-location capability grants (what an operator/
 *                              autonomous action may do at THIS location).
 *   • LocationKPILayer       — per-location KPI snapshots + cross-location rollup.
 *   • LocationRiskEngine     — flags locations whose KPIs breach thresholds.
 *
 * Reporting (cross-location) lives in the orchestrator and consumes these.
 */
import { JsonStore, makeId } from '../../phase-12-self-improving-intelligence/src/store.js';

/* ------------------------------------------------------------------ */
/* Brand Registry                                                      */
/* ------------------------------------------------------------------ */

export class BrandRegistry {
  constructor(opts) {
    this.store = new JsonStore('brand-registry', opts);
  }

  register(brand) {
    const b = {
      id: brand.id || makeId('BRAND'),
      name: brand.name,
      status: brand.status || 'active',
      meta: brand.meta || {},
    };
    this.store.insert(b);
    return b;
  }

  get(id) {
    return this.store.find((b) => b.id === id);
  }

  all() {
    return this.store.all();
  }
}

/* ------------------------------------------------------------------ */
/* Location Registry                                                   */
/* ------------------------------------------------------------------ */

export class LocationRegistry {
  constructor(opts) {
    this.store = new JsonStore('location-registry', opts);
  }

  register(loc) {
    const l = {
      id: loc.id || makeId('LOC'),
      name: loc.name,
      brandId: loc.brandId, // required link to a brand
      type: loc.type || 'physical', // physical | digital
      address: loc.address || null,
      timezone: loc.timezone || 'UTC',
      status: loc.status || 'active',
      meta: loc.meta || {},
    };
    this.store.insert(l);
    return l;
  }

  get(id) {
    return this.store.find((l) => l.id === id);
  }

  forBrand(brandId) {
    return this.store.filter((l) => l.brandId === brandId);
  }

  all() {
    return this.store.all();
  }
}

/* ------------------------------------------------------------------ */
/* Location Permission                                                 */
/* ------------------------------------------------------------------ */

export class LocationPermission {
  constructor(opts) {
    this.store = new JsonStore('location-permission', opts);
  }

  /** Grant a capability to a principal (operator/agent) at a location. */
  grant({ locationId, principal, capability }) {
    const rec = {
      id: makeId('PERM'),
      timestamp: Date.now(),
      locationId,
      principal,
      capability, // e.g. 'finance.refund', 'seo.publish'
    };
    this.store.insert(rec);
    return rec;
  }

  revoke(id) {
    return this.store.update(id, { revoked: true, revokedAt: Date.now() });
  }

  /** Can principal do capability at locationId? */
  can({ locationId, principal, capability }) {
    const rec = this.store.find(
      (p) =>
        p.locationId === locationId &&
        p.principal === principal &&
        p.capability === capability &&
        !p.revoked
    );
    return !!rec;
  }

  all() {
    return this.store.all();
  }
}

/* ------------------------------------------------------------------ */
/* Location KPI Layer                                                  */
/* ------------------------------------------------------------------ */

export class LocationKPILayer {
  constructor(opts) {
    this.store = new JsonStore('location-kpi', opts);
  }

  /** Record a KPI snapshot for a location. */
  record({ locationId, brandId, metrics }) {
    const rec = {
      id: makeId('KPI'),
      timestamp: Date.now(),
      locationId,
      brandId,
      metrics, // e.g. { revenue: 4200, orders: 130, rating: 4.6 }
    };
    this.store.insert(rec);
    return rec;
  }

  latest(locationId) {
    return this.store.find((k) => k.locationId === locationId);
  }

  /** Cross-location rollup by brand (sums numeric metrics, averages ratios). */
  rollupByBrand(brandId) {
    const rows = this.store.filter((k) => k.brandId === brandId);
    if (!rows.length) return null;
    const sums = {};
    const counts = {};
    for (const r of rows) {
      for (const [key, val] of Object.entries(r.metrics || {})) {
        if (typeof val === 'number') {
          sums[key] = (sums[key] || 0) + val;
          counts[key] = (counts[key] || 0) + 1;
        }
      }
    }
    const rolled = {};
    for (const [k, v] of Object.entries(sums)) {
      // rating-like fields (0..5) are averaged, everything else summed.
      rolled[k] = k === 'rating' ? v / counts[k] : v;
    }
    return { brandId, locations: rows.length, metrics: rolled };
  }

  all() {
    return this.store.all();
  }
}

/* ------------------------------------------------------------------ */
/* Location Risk Engine                                                */
/* ------------------------------------------------------------------ */

export class LocationRiskEngine {
  constructor(opts) {
    this.store = new JsonStore('location-risk', opts);
    // Default thresholds; overridable per-call.
    this.thresholds = (opts && opts.thresholds) || {
      revenue: { min: 1000 },
      rating: { min: 4.0 },
      orders: { min: 10 },
    };
  }

  /** Evaluate a KPI snapshot against thresholds. */
  evaluate(snapshot) {
    const alerts = [];
    const m = snapshot.metrics || {};
    for (const [key, rule] of Object.entries(this.thresholds)) {
      const val = m[key];
      if (typeof val !== 'number') continue;
      if (rule.min != null && val < rule.min) {
        alerts.push({ key, value: val, threshold: rule.min, direction: 'below' });
      }
      if (rule.max != null && val > rule.max) {
        alerts.push({ key, value: val, threshold: rule.max, direction: 'above' });
      }
    }
    const rec = {
      id: makeId('RISK'),
      timestamp: Date.now(),
      locationId: snapshot.locationId,
      brandId: snapshot.brandId,
      alerts,
      status: alerts.length ? 'at-risk' : 'healthy',
    };
    this.store.insert(rec);
    return rec;
  }

  atRisk() {
    return this.store.filter((r) => r.status === 'at-risk');
  }

  all() {
    return this.store.all();
  }
}
