/**
 * runtime-proof.mjs — Phase 16 Multi-Location OS Runtime Proof.
 *
 * Provisions 2 brands with 3 locations, records KPIs (one breaching thresholds),
 * exercises per-location permission grants, and validates cross-location rollup
 * + risk flagging + fleet report. Isolated temp data dir; deterministic.
 */
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import assert from 'assert';
import MultiLocationOS from '../src/orchestrator.js';

const DATA_DIR = mkdtempSync(join(tmpdir(), 'mi-phase16-'));
const os = new MultiLocationOS({
  dataDir: DATA_DIR,
  thresholds: { revenue: { min: 1000 }, rating: { min: 4.0 }, orders: { min: 10 } },
});

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
console.log('  PHASE 16 — MULTI-LOCATION OS :: RUNTIME PROOF');
console.log(`  data dir: ${DATA_DIR}`);
console.log('═══════════════════════════════════════════════════════════════\n');

/* Provision -------------------------------------------------------- */
const b1 = os.provisionBrand({ id: 'brand-bakudan', name: 'Bakudan' }, [
  { id: 'loc-1', name: 'Bakudan Downtown' },
  { id: 'loc-2', name: 'Bakudan Uptown' },
]);
const b2 = os.provisionBrand({ id: 'brand-sushi', name: 'Sushi Co' }, [
  { id: 'loc-3', name: 'Sushi Co Central' },
]);

check('2 brands registered', () => assert.strictEqual(os.brands.all().length, 2));
check('3 locations registered', () => assert.strictEqual(os.locations.all().length, 3));
check('brand-bakudan has 2 locations', () =>
  assert.strictEqual(os.locations.forBrand('brand-bakudan').length, 2)
);

/* CASE 1: KPI observation + healthy risk --------------------------- */
console.log('\nCASE 1: KPI observation (healthy location)');
const o1 = os.observe('loc-1', { revenue: 4200, orders: 130, rating: 4.6 });
check('risk status healthy for good KPIs', () => assert.strictEqual(o1.risk.status, 'healthy'));
check('no alerts when all above thresholds', () => assert.strictEqual(o1.risk.alerts.length, 0));

/* CASE 2: KPI breach → at-risk ------------------------------------ */
console.log('\nCASE 2: KPI breach → at-risk');
const o2 = os.observe('loc-2', { revenue: 500, orders: 8, rating: 3.2 });
check('risk status at-risk for breaching KPIs', () => assert.strictEqual(o2.risk.status, 'at-risk'));
check('alerts include revenue below threshold', () =>
  assert.ok(o2.risk.alerts.some((a) => a.key === 'revenue' && a.direction === 'below'))
);
check('alerts include rating below threshold', () =>
  assert.ok(o2.risk.alerts.some((a) => a.key === 'rating'))
);

/* CASE 3: permission grants --------------------------------------- */
console.log('\nCASE 3: per-location permission grants');
os.permissions.grant({ locationId: 'loc-1', principal: 'operator-a', capability: 'finance.refund' });
check('granted principal can act at location', () =>
  assert.strictEqual(
    os.permissions.can({ locationId: 'loc-1', principal: 'operator-a', capability: 'finance.refund' }),
    true
  )
);
check('permission is location-scoped (denied at other location)', () =>
  assert.strictEqual(
    os.permissions.can({ locationId: 'loc-2', principal: 'operator-a', capability: 'finance.refund' }),
    false
  )
);
check('ungranted capability denied', () =>
  assert.strictEqual(
    os.permissions.can({ locationId: 'loc-1', principal: 'operator-b', capability: 'finance.refund' }),
    false
  )
);

/* CASE 4: cross-location rollup ----------------------------------- */
console.log('\nCASE 4: cross-location KPI rollup by brand');
const roll = os.kpis.rollupByBrand('brand-bakudan');
check('rollup covers 2 locations', () => assert.strictEqual(roll.locations, 2));
check('rollup sums revenue across locations', () =>
  assert.strictEqual(roll.metrics.revenue, 4200 + 500)
);
check('rollup averages rating across locations', () =>
  assert.ok(Math.abs(roll.metrics.rating - (4.6 + 3.2) / 2) < 1e-9)
);

/* CASE 5: brand report + at-risk list ----------------------------- */
console.log('\nCASE 5: brand report with at-risk locations');
const rep = os.brandReport('brand-bakudan');
check('brand report names the brand', () => assert.strictEqual(rep.brandName, 'Bakudan'));
check('brand report locationCount = 2', () => assert.strictEqual(rep.locationCount, 2));
check('brand report flags loc-2 as at-risk', () =>
  assert.ok(rep.atRisk.some((a) => a.locationId === 'loc-2'))
);
check('brand report healthy=false (has at-risk)', () => assert.strictEqual(rep.healthy, false));

/* CASE 6: fleet report -------------------------------------------- */
console.log('\nCASE 6: fleet report across all brands');
const fleet = os.fleetReport();
check('fleet report has one entry per brand', () => assert.strictEqual(fleet.length, 2));
check('fleet report includes sushi brand', () =>
  assert.ok(fleet.some((r) => r.brandId === 'brand-sushi'))
);

/* Persistence ------------------------------------------------------ */
console.log('\nPERSISTENCE: re-instantiating from disk...');
const os2 = new MultiLocationOS({
  dataDir: DATA_DIR,
  thresholds: { revenue: { min: 1000 }, rating: { min: 4.0 }, orders: { min: 10 } },
});
check('brands persisted across restart', () => assert.strictEqual(os2.brands.all().length, 2));
check('locations persisted across restart', () => assert.strictEqual(os2.locations.all().length, 3));
check('KPI snapshots persisted across restart', () => assert.ok(os2.kpis.all().length >= 2));
check('permissions persisted across restart', () => assert.ok(os2.permissions.all().length >= 1));

/* Result ---------------------------------------------------------- */
console.log('\n═══════════════════════════════════════════════════════════════');
console.log(`  RESULT: ${passed} passed, ${failed} failed`);
console.log('═══════════════════════════════════════════════════════════════');
process.exit(failed === 0 ? 0 : 1);
