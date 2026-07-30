/**
 * orchestrator.js — Phase 17 Franchise / Multi-Company OS.
 *
 * Wires company/tenant/permission/template/shared-ops engines and adds:
 *   • onboardFranchisee() — apply a template + entitlements to a new tenant
 *   • crossCompanyReport() — HQ rollup across all tenants
 *
 * Tenant isolation is enforced on every cross-tenant read path.
 */
import {
  CompanyRegistry,
  TenantIsolation,
  CompanyPermission,
  FranchiseTemplate,
  SharedOpsModel,
} from './engines.js';
import { JsonStore } from '../../phase-12-self-improving-intelligence/src/store.js';

export class FranchiseOS {
  constructor(opts = {}) {
    this.companies = new CompanyRegistry(opts);
    this.isolation = new TenantIsolation(opts);
    this.permissions = new CompanyPermission(opts);
    this.templates = new FranchiseTemplate(opts);
    this.sharedOps = new SharedOpsModel(opts);
    this.metrics = new JsonStore('company-metrics', opts); // per-tenant KPIs for HQ rollup
  }

  /** Onboard a franchisee: register, apply template, entitle shared services. */
  onboardFranchisee({ company, templateId, ops = [] }) {
    const c = this.companies.register({ ...company, franchiseTemplateId: templateId });
    const applied = templateId ? this.templates.apply(templateId, c.id) : null;
    for (const svc of ops) {
      this.sharedOps.entitle({ companyId: c.id, service: svc });
    }
    return { company: c, applied };
  }

  /** Record a tenant's metrics (HQ ingestion point). */
  recordMetrics(companyId, metrics) {
    return this.metrics.insert({
      id: `METRIC_${companyId}_${Date.now()}`,
      timestamp: Date.now(),
      companyId,
      metrics,
    });
  }

  /** Tenant-scoped read with isolation enforcement. */
  readMetrics({ tenantId, companyId }) {
    const guard = this.isolation.guard({ tenantId, resourceTenantId: companyId, action: 'read-metrics' });
    if (!guard.ok) return guard;
    return { ok: true, metrics: this.metrics.filter((m) => m.companyId === companyId) };
  }

  /** HQ cross-company report (no tenant scoping — HQ only). */
  crossCompanyReport() {
    const rows = this.metrics.all();
    const byCompany = {};
    for (const r of rows) {
      const c = byCompany[r.companyId] || (byCompany[r.companyId] = { companyId: r.companyId, snapshots: 0, sums: {} });
      c.snapshots++;
      for (const [k, v] of Object.entries(r.metrics || {})) {
        if (typeof v === 'number') c.sums[k] = (c.sums[k] || 0) + v;
      }
    }
    const companies = Object.values(byCompany);
    const totals = {};
    for (const c of companies) {
      for (const [k, v] of Object.entries(c.sums)) totals[k] = (totals[k] || 0) + v;
    }
    return {
      tenantCount: this.companies.all().length,
      companiesWithMetrics: companies.length,
      totals,
      perCompany: companies,
      isolationViolations: this.isolation.violations().length,
    };
  }
}

export default FranchiseOS;
