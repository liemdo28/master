'use strict';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import * as assert from 'assert';

const AGENT_ENGINE = join(import.meta.dirname, '..', '..', 'agent-engine');
const PHASES = [
  { id: 21, dir: 'phase-21-customer-experience-os', expected: 'CustomerExperienceOS', method: 'dashboard' },
  { id: 22, dir: 'phase-22-revenue-growth-os', expected: 'RevenueGrowthOS', method: 'dashboard' },
  { id: 23, dir: 'phase-23-operations-control-tower', expected: 'OperationsControlTower', method: 'dashboard' },
  { id: 24, dir: 'phase-24-procurement-inventory-os', expected: 'ProcurementInventoryOS', method: 'dashboard' },
  { id: 25, dir: 'phase-25-hr-labor-os', expected: 'HRLaborOS', method: 'dashboard' },
  { id: 26, dir: 'phase-26-asset-creative-os', expected: 'AssetCreativeOS', method: 'dashboard' },
  { id: 27, dir: 'phase-27-security-risk-os', expected: 'SecurityRiskOS', method: 'dashboard' },
  { id: 28, dir: 'phase-28-workflow-fabric-os', expected: 'WorkflowFabric2OS', method: 'dashboard' },
  { id: 29, dir: 'phase-29-data-governance-os', expected: 'DataGovernanceOS', method: 'dashboard' },
  { id: 30, dir: 'phase-30-ceo-command-center-os', expected: 'DailyBriefingEngine', method: 'generateBriefing' },
];
let passed = 0, failed = 0;
const check = (n, f) => { try { f(); passed++; console.log('  PASS: ' + n); } catch (e) { failed++; console.error('  FAIL: ' + n + ' -- ' + e.message); } };
console.log('PHASE 21-30 FUNCTIONAL PROOF TEST\n');
for (const p of PHASES) {
  const DATA_DIR = mkdtempSync(join(tmpdir(), 'mi-phase' + p.id + '-'));
  const mod = await import('file:///' + AGENT_ENGINE + '/' + p.dir + '/src/orchestrator.js');
  const Orch = mod.default || Object.values(mod).find((v) => typeof v === 'function');
  const inst = new Orch({ dataDir: DATA_DIR });
  console.log('  Phase ' + p.id);
  check('orchestrator is a function', () => assert.strictEqual(typeof Orch, 'function'));
  check('name matches: ' + p.expected, () => assert.strictEqual(Orch.name, p.expected));
  check('method exists: ' + p.method, () => assert.strictEqual(typeof inst[p.method], 'function'));
  check('method returns object', () => assert.strictEqual(typeof inst[p.method](), 'object'));
}
console.log('\n  RESULT: ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
