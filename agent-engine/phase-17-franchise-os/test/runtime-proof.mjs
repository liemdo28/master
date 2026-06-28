/**
 * runtime-proof.mjs — Phase 17 Franchise / Multi-Company OS Runtime Proof.
 *
 * Defines a franchise template, onboards 2 franchisees, exercises tenant
 * isolation (deny cross-tenant read), company permissions, shared-ops
 * entitlements, and the HQ cross-company report. Isolated temp data dir.
 */
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import assert from 'assert';
import FranchiseOS from '../src/orchestrator.js';

const DATA_DIR = mkdtempSync(join(tmpdir(), 'mi-phase17-'));
const fos = new FranchiseOS({ dataDir: DATA_DIR });

let passed = 0;
let failed = 0;
function check(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (err) {
    failed++;
    console.error(`  ❌ ${name} — ${err.message}`);
  }
}

console.log('═══════════════════════════════════════════════════════════════');
console.log('  PHASE 17 — FRANCHISE / MULTI-COMPANY OS :: RUNTIME PROOF');
console.log(`  data dir: ${DATA_DIR}`);
console.log('═══════════════════════════════════════════════════════════════\n');

/* Define a franchise template ------------------------------------- */
const tpl = fos.templates.define({
  id: 'tpl-standard',
  name: 'Standard Restaurant Franchise',
  ops: ['seo', 'accounting', 'doordash'],
  policies: { refundCap: 500 },
  playbooks: ['resilient-dependency-call', 'data-freshness-guard'],
});
check('template defined with ops + playbooks', () =>
  assert.ok(tpl.ops.length >= 1 && tpl.playbooks.length >= 1)
);

/* CASE 1: onboard franchisees from the template ------------------ */
console.log('\nCASE 1: onboard 2 franchisees from the template');
const f1 = fos.onboardFranchisee({ company: { id: 'co-1', name: 'Bakudan SF' }, templateId: 'tpl-standard', ops: ['seo', 'accounting'] });
const f2 = fos.onboardFranchisee({ company: { id: 'co-2', name: 'Bakudan LA' }, templateId: 'tpl-standard', ops: ['seo'] });
check('2 companies registered', () => assert.strictEqual(fos.companies.all().length, 2));
check('onboard applied the template to co-1', () =>
  assert.strictEqual(f1.applied.appliedTemplateId, 'tpl-standard')
);
check('template policies copied into applied config', () =>
  assert.strictEqual(f1.applied.policies.refundCap, 500)
);

/* CASE 2: tenant isolation --------------------------------------- */
console.log('\nCASE 2: tenant isolation denies cross-tenant reads');
fos.recordMetrics('co-1', { revenue: 4200 });
fos.recordMetrics('co-2', { revenue: 9000 });
const own = fos.readMetrics({ tenantId: 'co-1', companyId: 'co-1' });
check('tenant can read its own metrics', () => assert.strictEqual(own.ok, true));
check('own read returns the tenant snapshots', () => assert.ok(own.metrics.length >= 1));
const cross = fos.readMetrics({ tenantId: 'co-1', companyId: 'co-2' });
check('cross-tenant read denied', () => assert.strictEqual(cross.ok, false));
check('denied read carries a reason', () => assert.ok(cross.reason));
check('isolation violation is recorded for audit', () =>
  assert.strictEqual(fos.isolation.violations().length, 1)
);

/* CASE 3: company permission ------------------------------------- */
console.log('\nCASE 3: company-scoped permissions');
fos.permissions.grant({ companyId: 'co-1', principal: 'manager-1', capability: 'finance.refund' });
check('granted principal can act in its company', () =>
  assert.strictEqual(fos.permissions.can({ companyId: 'co-1', principal: 'manager-1', capability: 'finance.refund' }), true)
);
check('permission is company-scoped (denied in co-2)', () =>
  assert.strictEqual(fos.permissions.can({ companyId: 'co-2', principal: 'manager-1', capability: 'finance.refund' }), false)
);

/* CASE 4: shared ops entitlement --------------------------------- */
console.log('\nCASE 4: shared ops model');
check('co-1 entitled to seo', () => assert.strictEqual(fos.sharedOps.entitled('co-1', 'seo'), true));
check('co-1 entitled to accounting', () => assert.strictEqual(fos.sharedOps.entitled('co-1', 'accounting'), true));
check('co-2 entitled to seo', () => assert.strictEqual(fos.sharedOps.entitled('co-2', 'seo'), true));
check('co-2 NOT entitled to accounting', () => assert.strictEqual(fos.sharedOps.entitled('co-2', 'accounting'), false));

/* CASE 5: HQ cross-company report -------------------------------- */
console.log('\nCASE 5: HQ cross-company report');
const hq = fos.crossCompanyReport();
check('HQ report sees 2 tenants', () => assert.strictEqual(hq.tenantCount, 2));
check('HQ report totals revenue across tenants', () => assert.strictEqual(hq.totals.revenue, 4200 + 9000));
check('HQ report counts isolation violations', () => assert.strictEqual(hq.isolationViolations, 1));
check('HQ per-company rollup has 2 entries', () => assert.strictEqual(hq.perCompany.length, 2));

/* Persistence ----------------------------------------------------- */
console.log('\nPERSISTENCE: re-instantiating from disk...');
const fos2 = new FranchiseOS({ dataDir: DATA_DIR });
check('companies persisted across restart', () => assert.strictEqual(fos2.companies.all().length, 2));
check('template persisted across restart', () => assert.strictEqual(fos2.templates.all().length, 1));
check('metrics persisted across restart', () => assert.ok(fos2.metrics.all().length >= 2));
check('isolation log persisted across restart', () => assert.ok(fos2.isolation.all().length >= 2));

/* Result ---------------------------------------------------------- */
console.log('\n═══════════════════════════════════════════════════════════════');
console.log(`  RESULT: ${passed} passed, ${failed} failed`);
console.log('═══════════════════════════════════════════════════════════════');
process.exit(failed === 0 ? 0 : 1);
