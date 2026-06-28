/**
 * Phase 12–20 Functional Proof Test.
 *
 * Two layers of proof per phase:
 *   A) BEHAVIOR — runs the phase's own runtime-proof as a child process and
 *      asserts exit code 0 + the exact expected pass count (no silent skips).
 *   B) SURFACE  — imports the orchestrator, instantiates it in an isolated temp
 *      dir, and asserts the default export is a class exposing the methods the
 *      source certification claims.
 *
 * This is the source-level functional certification for PR #24's Phase 12–20.
 */
import { execFileSync } from 'child_process';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENGINE_ROOT = join(__dirname, '..', '..', 'agent-engine');

let passed = 0, failed = 0;
function assert(label, condition) {
  if (condition) { console.log(`  PASS: ${label}`); passed++; }
  else { console.log(`  FAIL: ${label}`); failed++; }
}

// phase id -> { dir, expectedTests, orchestratorClass, methods }
const PHASES = [
  { id: 12, dir: 'phase-12-self-improving-intelligence', tests: 26, cls: 'SelfImprovingIntelligence', methods: ['learn', 'observeOutcome', 'observeApproval', 'scorecard'] },
  { id: 13, dir: 'phase-13-multi-agent-workforce', tests: 19, cls: 'MultiAgentWorkforce', methods: ['dispatch', 'peerReview', 'escalateAfterFail', 'resolveResourceConflict', 'scorecard'] },
  { id: 14, dir: 'phase-14-hitl-autonomy', tests: 28, cls: 'HITLAutonomy', methods: ['propose', 'approve', 'reject', 'pending'] },
  { id: 15, dir: 'phase-15-autonomous-ops', tests: 26, cls: 'AutonomousOps', methods: ['execute', 'tripKillSwitch', 'clearKillSwitch'] },
  { id: 16, dir: 'phase-16-multi-location-os', tests: 24, cls: 'MultiLocationOS', methods: ['provisionBrand', 'observe', 'brandReport', 'fleetReport'] },
  { id: 17, dir: 'phase-17-franchise-os', tests: 23, cls: 'FranchiseOS', methods: ['onboardFranchisee', 'recordMetrics', 'readMetrics', 'crossCompanyReport'] },
  { id: 18, dir: 'phase-18-knowledge-graph', tests: 18, cls: 'KnowledgeGraph', methods: ['node', 'stats'] },
  { id: 19, dir: 'phase-19-executive-simulation', tests: 18, cls: 'ExecutiveSimulation', methods: ['runDecision', 'validateAssumption'] },
  { id: 20, dir: 'phase-20-autonomous-executive-os', tests: 25, cls: 'CEOControlPanel', methods: ['setObjective', 'runCycle', 'dashboard', 'haltCompany', 'resumeCompany'] },
];

console.log('\n=== Phase 12–20 Functional Proof ===\n');

let totalTests = 0;

for (const p of PHASES) {
  console.log(`--- Phase ${p.id} (${p.cls}) ---`);

  // A) BEHAVIOR: run the phase's runtime-proof
  const proof = join(ENGINE_ROOT, p.dir, 'test', 'runtime-proof.mjs');
  let out = '';
  let exit = 0;
  try {
    out = execFileSync(process.execPath, [proof], { encoding: 'utf8' });
  } catch (e) {
    exit = e.status ?? 1;
    out = (e.stdout || '') + (e.stderr || '');
  }
  const m = out.match(/(\d+)\s+passed,\s+(\d+)\s+failed/) || out.match(/RESULT:\s*(\d+)\s+passed,\s+(\d+)\s+failed/);
  const got = m ? Number(m[1]) : -1;
  const fails = m ? Number(m[2]) : -1;
  assert(`phase ${p.id} runtime-proof exits 0`, exit === 0);
  assert(`phase ${p.id} reports ${p.tests} passed, 0 failed`, got === p.tests && fails === 0);
  if (got > 0) totalTests += got;

  // B) SURFACE: orchestrator class + claimed methods
  const orch = join(ENGINE_ROOT, p.dir, 'src', 'orchestrator.js');
  const mod = await import(pathToFileURL(orch).href);
  const Cls = mod.default;
  assert(`phase ${p.id} default export is class ${p.cls}`, typeof Cls === 'function' && Cls.name === p.cls);
  const inst = new Cls({ dataDir: mkdtempSync(join(tmpdir(), `mi-fp-${p.id}-`)) });
  const missing = p.methods.filter((meth) => typeof inst[meth] !== 'function');
  assert(`phase ${p.id} exposes [${p.methods.join(', ')}]`, missing.length === 0);
}

console.log('\n--- Aggregate ---');
assert('all 9 phases accounted for', PHASES.length === 9);
assert('aggregate runtime tests = 207 (26+19+28+26+24+23+18+18+25)', totalTests === 207);

console.log(`\n  RESULTS: ${passed} passed, ${failed} failed  (aggregated phase tests: ${totalTests})`);
process.exit(failed === 0 ? 0 : 1);
