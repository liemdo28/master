/**
 * runtime-proof.mjs — Phase 29 Data Quality & Governance OS.
 * Scenario: stale dataset -> quality issue -> owner task -> dashboard flag -> executive report.
 */
import { mkdtempSync } from 'fs'; import { tmpdir } from 'os'; import { join } from 'path'; import assert from 'assert';
import DataGovernanceOS from '../src/orchestrator.js';

const DATA_DIR = mkdtempSync(join(tmpdir(), 'mi-phase29-'));
const dg = new DataGovernanceOS({ dataDir: DATA_DIR });
let passed = 0, failed = 0;
const check = (n, f) => { try { f(); passed++; console.log('  ✅ ' + n); } catch (e) { failed++; console.error('  ❌ ' + n + ' — ' + e.message); } };
console.log('PHASE 29 — DATA QUALITY & GOVERNANCE OS :: RUNTIME PROOF\n');

// Register a dataset with an old lastSync to simulate staleness
const staleDataset = dg.catalog.register({ dataset: 'doordash_revenue', domain: 'finance', owner: 'data-eng', division: 'data-platform', freshnessThreshold: 86400 });
// Force old timestamp for staleness
const rec = dg.catalog.store.records.find((r) => r.dataset === 'doordash_revenue');
rec.lastSync = Date.now() - 345600000; // 2 days old (> 24h threshold)
dg.catalog.store.update(rec.id, { lastSync: rec.lastSync });

const r = dg.handleDataset('doordash_revenue', 'data-eng');
check('freshness STALE for old dataset', () => assert.strictEqual(r.freshness.level, 'STALE'));
check('task created on stale dataset', () => assert.ok(r.task !== null));
check('task approval-gated', () => assert.strictEqual(r.task.approvalRequired, true));
check('task routed to data-platform division', () => assert.strictEqual(r.task.division, 'data-platform'));

// Schema drift detection
const drift = dg.schema.check([{ name: 'id' }, { name: 'revenue' }], [{ name: 'id' }, { name: 'revenue' }, { name: 'currency' }], 'doordash_revenue');
check('schema drift detected (added field)', () => assert.strictEqual(drift.drifter, true));
check('added field identified', () => assert.ok(drift.added.some((f) => f.name === 'currency')));
check('drift level MEDIUM (1 field change)', () => assert.strictEqual(drift.level, 'MEDIUM'));

// Lineage
dg.lineage.link({ upstream: 'doordash_raw', downstream: 'doordash_revenue', field: 'revenue' });
const lineage = dg.lineage.forDataset('doordash_revenue');
check('lineage upstream recorded', () => assert.ok(lineage.length >= 1));

// Dashboard
const dash = r.dashboard;
check('dashboard reports stale datasets', () => assert.ok(dash.staleDatasets >= 1));
check('dashboard computes avg score', () => assert.ok(typeof dash.avgScore === 'number'));

// Trusted metric registry
dg.metrics.register({ metric: 'monthly_revenue', value: 48500, source: 'doordash-agent', trustLevel: 'TRUSTED' });
check('trusted metric registered', () => assert.strictEqual(dg.metrics.all().length, 1));

const dg2 = new DataGovernanceOS({ dataDir: DATA_DIR });
check('catalog persisted across restart', () => assert.ok(dg2.catalog.all().length >= 1));

console.log('\n  RESULT: ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);