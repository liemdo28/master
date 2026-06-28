/**
 * Phase 29 — Data Quality & Governance OS.
 * Modules: DataCatalog · FreshnessEngine · LineageEngine · SchemaDriftDetector · DataQualityScorecard · TrustedMetricRegistry
 * OSS: OpenMetadata (TCP 8585). Fallback: in-engine catalog + freshness tracking.
 */
import { JsonStore, makeId } from '../../phase-12-self-improving-intelligence/src/store.js';

export class DataCatalog {
  constructor(opts) { this.store = new JsonStore('dg-catalog', opts); }
  register(d) { return this.store.insert({ id: makeId('DCAT'), timestamp: Date.now(), dataset: d.dataset, domain: d.domain, owner: d.owner, division: d.division, freshnessThreshold: d.freshnessThreshold || 86400, lastSync: d.lastSync || Date.now(), qualityScore: null }); }
  all() { return this.store.all(); }
  byDataset(dataset) { return this.store.find((r) => r.dataset === dataset); }
  updateQuality(dataset, qualityScore) { const r = this.byDataset(dataset); if (r) this.store.update(r.id, { qualityScore }); return r; }
}

export class FreshnessEngine {
  constructor(opts) { this.store = new JsonStore('dg-freshness', opts); }
  record(dataset) {
    const age = (Date.now() - dataset.lastSync) / 1000;
    const isStale = age > (dataset.freshnessThreshold || 86400);
    const level = isStale ? (age > (dataset.freshnessThreshold * 3) ? 'STALE' : 'STALE_SOON') : 'FRESH';
    const rec = { id: makeId('FRESH'), timestamp: Date.now(), dataset: dataset.dataset, ageSeconds: Math.round(age), level, threshold: dataset.freshnessThreshold || 86400, owner: dataset.owner };
    this.store.insert(rec);
    return rec;
  }
  all() { return this.store.all(); }
  stale() { return this.store.filter((r) => r.level !== 'FRESH'); }
}

export class LineageEngine {
  constructor(opts) { this.store = new JsonStore('dg-lineage', opts); }
  link({ upstream, downstream, field }) { return this.store.insert({ id: makeId('LIN'), timestamp: Date.now(), upstream, downstream, field, status: 'active' }); }
  forDataset(dataset) { return this.store.filter((r) => r.upstream === dataset || r.downstream === dataset); }
  all() { return this.store.all(); }
}

export class SchemaDriftDetector {
  check(schemaBefore, schemaAfter, dataset) {
    const added = (schemaAfter || []).filter((f) => !(schemaBefore || []).some((b) => b.name === f.name));
    const removed = (schemaBefore || []).filter((f) => !(schemaAfter || []).some((a) => a.name === f.name));
    const drifter = added.length > 0 || removed.length > 0;
    return { dataset, drifter, added, removed, level: added.length + removed.length >= 3 ? 'HIGH' : drifter ? 'MEDIUM' : 'NONE' };
  }
}

export class DataQualityScorecard {
  score(dataset, freshness, lineage) {
    let score = 100;
    if (freshness && freshness.level !== 'FRESH') score -= 20;
    if (lineage && lineage.length > 0) score -= 5;
    return { dataset, score: Math.max(0, score), level: score >= 90 ? 'GOOD' : score >= 70 ? 'FAIR' : 'POOR' };
  }
  dashboard(catalog, freshness, lineages) {
    const scored = (catalog || []).map((d) => {
      const f = (freshness || []).find((x) => x.dataset === d.dataset);
      const l = (lineages || []).filter((x) => x.upstream === d.dataset || x.downstream === d.dataset);
      return this.score(d, f, l);
    });
    const avg = scored.length > 0 ? scored.reduce((s, x) => s + x.score, 0) / scored.length : 0;
    const stale = (freshness || []).filter((f) => f.level !== 'FRESH').length;
    return { datasets: scored.length, avgScore: Number(avg.toFixed(1)), staleDatasets: stale, status: avg >= 90 ? 'GOOD' : avg >= 70 ? 'FAIR' : 'POOR' };
  }
}

export class TrustedMetricRegistry {
  constructor(opts) { this.store = new JsonStore('dg-metrics', opts); }
  register(m) { return this.store.insert({ id: makeId('TMET'), timestamp: Date.now(), metric: m.metric, value: m.value, source: m.source, trustLevel: m.trustLevel || 'UNVERIFIED', notes: m.notes || '' }); }
  all() { return this.store.all(); }
}

export class DataGovernanceOS {
  constructor(opts = {}) {
    this.catalog = new DataCatalog(opts);
    this.freshness = new FreshnessEngine(opts);
    this.lineage = new LineageEngine(opts);
    this.schema = new SchemaDriftDetector();
    this.scorecard = new DataQualityScorecard();
    this.metrics = new TrustedMetricRegistry(opts);
  }

  /** Scenario: stale dataset -> quality issue -> owner task -> dashboard flag -> executive report. */
  handleDataset(datasetName, owner) {
    const dataset = this.catalog.byDataset(datasetName) || this.catalog.register({ dataset: datasetName, domain: 'operations', owner, division: 'data-platform', freshnessThreshold: 86400 });
    const fresh = this.freshness.record(dataset);
    let task = null;
    if (fresh.level !== 'FRESH') {
      task = { title: 'Fix stale dataset: ' + datasetName, division: 'data-platform', owner, status: 'pending_approval', approvalRequired: true, freshness: fresh };
    }
    return { dataset, freshness: fresh, task, dashboard: this.dashboard() };
  }

  dashboard() { return this.scorecard.dashboard(this.catalog.all(), this.freshness.all(), this.lineage.all()); }
}

export default DataGovernanceOS;