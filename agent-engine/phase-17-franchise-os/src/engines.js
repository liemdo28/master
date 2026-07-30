/**
 * engines.js — Phase 17 Franchise / Multi-Company OS building blocks.
 *
 *   • CompanyRegistry         — tenant companies (franchisees / subsidiaries).
 *   • TenantIsolation         — enforces that data/actions never leak across tenants.
 *   • CompanyPermission       — per-company capability grants.
 *   • FranchiseTemplate       — a playbook/policy bundle applied to a new franchisee.
 *   • SharedOpsModel          — which shared services a tenant is entitled to.
 *   • CrossCompanyReporting   — rollups across all tenants (HQ view).
 */
import { JsonStore, makeId } from '../../phase-12-self-improving-intelligence/src/store.js';

/* ------------------------------------------------------------------ */
/* Company Registry                                                    */
/* ------------------------------------------------------------------ */

export class CompanyRegistry {
  constructor(opts) {
    this.store = new JsonStore('company-registry', opts);
  }

  register(company) {
    const c = {
      id: company.id || makeId('CO'),
      name: company.name,
      parentId: company.parentId || null, // for subsidiaries
      franchiseTemplateId: company.franchiseTemplateId || null,
      status: company.status || 'active',
      meta: company.meta || {},
    };
    this.store.insert(c);
    return c;
  }

  get(id) {
    return this.store.find((c) => c.id === id);
  }

  all() {
    return this.store.all();
  }

  subsidiaries(parentId) {
    return this.store.filter((c) => c.parentId === parentId);
  }
}

/* ------------------------------------------------------------------ */
/* Tenant Isolation                                                   */
/* ------------------------------------------------------------------ */

export class TenantIsolation {
  constructor(opts) {
    this.store = new JsonStore('tenant-isolation', opts);
  }

  /**
   * Validate that a resource/document belongs to the requesting tenant.
   * Returns { ok: boolean, reason?: string } and logs the access attempt.
   */
  guard({ tenantId, resourceTenantId, action }) {
    const ok = tenantId === resourceTenantId;
    this.store.insert({
      id: makeId('ISO'),
      timestamp: Date.now(),
      tenantId,
      resourceTenantId,
      action: action || 'access',
      allowed: ok,
    });
    return ok
      ? { ok: true }
      : { ok: false, reason: `tenant ${tenantId} cannot access tenant ${resourceTenantId} data` };
  }

  /** Every recorded access attempt for a tenant (audit). */
  auditFor(tenantId) {
    return this.store.filter((r) => r.tenantId === tenantId);
  }

  violations() {
    return this.store.filter((r) => !r.allowed);
  }

  all() {
    return this.store.all();
  }
}

/* ------------------------------------------------------------------ */
/* Company Permission                                                 */
/* ------------------------------------------------------------------ */

export class CompanyPermission {
  constructor(opts) {
    this.store = new JsonStore('company-permission', opts);
  }

  grant({ companyId, principal, capability }) {
    const rec = {
      id: makeId('CPERM'),
      timestamp: Date.now(),
      companyId,
      principal,
      capability,
    };
    this.store.insert(rec);
    return rec;
  }

  can({ companyId, principal, capability }) {
    return !!this.store.find(
      (p) => p.companyId === companyId && p.principal === principal && p.capability === capability && !p.revoked
    );
  }

  all() {
    return this.store.all();
  }
}

/* ------------------------------------------------------------------ */
/* Franchise Template                                                 */
/* ------------------------------------------------------------------ */

export class FranchiseTemplate {
  constructor(opts) {
    this.store = new JsonStore('franchise-template', opts);
  }

  define(template) {
    const t = {
      id: template.id || makeId('TEMPLATE'),
      name: template.name,
      ops: template.ops || [], // shared services entitlements
      policies: template.policies || {}, // default config
      playbooks: template.playbooks || [], // starter playbooks
    };
    this.store.insert(t);
    return t;
  }

  get(id) {
    return this.store.find((t) => t.id === id);
  }

  /** Materialize a template into a per-tenant applied config. */
  apply(templateId, companyId) {
    const t = this.get(templateId);
    if (!t) return null;
    return {
      appliedTemplateId: t.id,
      companyId,
      ops: [...t.ops],
      policies: { ...t.policies },
      playbooks: [...t.playbooks],
      appliedAt: Date.now(),
    };
  }

  all() {
    return this.store.all();
  }
}

/* ------------------------------------------------------------------ */
/* Shared Ops Model                                                   */
/* ------------------------------------------------------------------ */

export class SharedOpsModel {
  constructor(opts) {
    this.store = new JsonStore('shared-ops', opts);
  }

  /** Record that a tenant is entitled to a shared service. */
  entitle({ companyId, service }) {
    const rec = { id: makeId('OPS'), timestamp: Date.now(), companyId, service };
    this.store.insert(rec);
    return rec;
  }

  entitled(companyId, service) {
    return !!this.store.find((r) => r.companyId === companyId && r.service === service);
  }

  forCompany(companyId) {
    return this.store.filter((r) => r.companyId === companyId).map((r) => r.service);
  }

  all() {
    return this.store.all();
  }
}
