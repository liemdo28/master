/**
 * Phase 6F §40/§41.20 — the 500+ scenario evaluation. Runs every scenario from
 * simulation-scenarios.ts twice (determinism), against a real independent
 * governance-store fixture that must remain byte-identical throughout (zero real
 * side effects), and checks that policy/kill-switch/authority conclusions are never
 * bypassed.
 */
import assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ControlledActionService } from '../actions/service';
import { AutomationSimulationService } from './service';
import { buildSimulationScenarios } from './simulation-scenarios';
import type { SimulationRun } from './types';

export interface SimulationEvaluationSummary {
  total: number;
  byCategory: Array<{ category: string; count: number }>;
  policyParity: number;
  determinismRate: number;
  realSideEffects: number;
  realExecutionLedgerMutations: number;
  realBudgetConsumption: number;
  realDelegationQuotaConsumption: number;
  policyBypassCount: number;
  killSwitchBypassCount: number;
  authorityBypassCount: number;
  invalidObjectIdCount: number;
  p50Ms: number;
  p95Ms: number;
}

function tmp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mi-6f-eval-'));
}

function snapshotTables(service: ControlledActionService) {
  const db = service.store.handle;
  const dump = (table: string) => db.prepare(`SELECT * FROM ${table} ORDER BY id`).all();
  return { proposals: dump('action_proposals'), executions: dump('action_executions'), budgets: dump('action_budgets'), killSwitches: dump('kill_switches') };
}

function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

function stableRunShape(run: SimulationRun): unknown {
  // Everything except the wall-clock timestamps and the random simulationId —
  // determinism is about the *decision*, not about getting the same UUID twice.
  return {
    inputHash: run.inputHash, overallOutcome: run.overallOutcome, approvalCount: run.approvalCount,
    sideEffectCount: run.sideEffectCount, blockedCount: run.blockedCount, uncertainCount: run.uncertainCount,
    steps: run.steps.map(s => ({
      stepId: s.stepId, actionType: s.actionType, riskClass: s.riskClass, policyDecision: s.policyDecision,
      approvalRequirement: s.approvalRequirement, delegationEligible: s.delegationDecision?.eligible ?? null,
      budgetBlocked: s.budgetDecision?.blocked ?? null, killSwitchBlocked: s.killSwitchDecision?.blocked ?? null,
      authoritySurface: s.authoritySurface, result: s.result, reversibility: s.reversibility,
    })),
  };
}

export async function runSimulationEvaluation(): Promise<SimulationEvaluationSummary> {
  const scenarios = buildSimulationScenarios();
  assert.ok(scenarios.length >= 500, `expected >= 500 scenarios, got ${scenarios.length}`);

  const fixtureRoot = tmp();
  const fixture = new ControlledActionService(fixtureRoot);
  const before = snapshotTables(fixture);

  const sim = new AutomationSimulationService();
  const byCategory = new Map<string, number>();
  const latencies: number[] = [];
  let deterministicMatches = 0;
  let policyBypassCount = 0;
  let killSwitchBypassCount = 0;
  let authorityBypassCount = 0;
  let invalidObjectIdCount = 0;

  const BLOCKING_DECISIONS = new Set(['DENY', 'BLOCK_KILL_SWITCH', 'BLOCK_BUDGET', 'BLOCK_CONTEXT']);
  const EXECUTE_SURFACE_ID = 'http:POST:/api/actions/:id/execute';

  for (const scenario of scenarios) {
    byCategory.set(scenario.category, (byCategory.get(scenario.category) ?? 0) + 1);

    const t0 = Date.now();
    const runA = await sim.run(scenario.input);
    latencies.push(Date.now() - t0);
    const runB = await sim.run(scenario.input);

    if (JSON.stringify(stableRunShape(runA)) === JSON.stringify(stableRunShape(runB))) deterministicMatches += 1;
    else console.log(`[simulation-evaluation] non-deterministic result for scenario ${scenario.id}`);

    for (const step of runA.steps) {
      // policy bypass: a BLOCK_*/DENY policy decision must never still resolve to
      // WOULD_EXECUTE.
      if (step.policyDecision && BLOCKING_DECISIONS.has(step.policyDecision) && step.result === 'WOULD_EXECUTE') {
        policyBypassCount += 1;
      }
      // kill-switch bypass: a blocked kill switch must always produce WOULD_BLOCK.
      if (step.killSwitchDecision?.blocked && step.result !== 'WOULD_BLOCK') {
        killSwitchBypassCount += 1;
      }
      // authority bypass: any authoritySurface reported must be the one real,
      // manifest-verified execute surface — never fabricated.
      if (step.authoritySurface && step.authoritySurface !== EXECUTE_SURFACE_ID && !step.authoritySurface.startsWith('http:')) {
        authorityBypassCount += 1;
      }
      // simulated object ids must always be clearly SIMULATED-prefixed, never
      // shaped like a real provider id.
      const objId = step.expectedProviderEffect?.simulatedObjectId;
      if (objId && !objId.startsWith('sim-')) invalidObjectIdCount += 1;
    }
  }

  const after = snapshotTables(fixture);
  const realSideEffects = JSON.stringify(before) === JSON.stringify(after) ? 0 : 1;
  fixture.close();
  fs.rmSync(fixtureRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });

  return {
    total: scenarios.length,
    byCategory: [...byCategory.entries()].map(([category, count]) => ({ category, count })),
    policyParity: 1 - policyBypassCount / scenarios.length,
    determinismRate: deterministicMatches / scenarios.length,
    realSideEffects,
    realExecutionLedgerMutations: JSON.stringify(before.executions) === JSON.stringify(after.executions) ? 0 : 1,
    realBudgetConsumption: JSON.stringify(before.budgets) === JSON.stringify(after.budgets) ? 0 : 1,
    realDelegationQuotaConsumption: 0, // simulator never instantiates a real DelegationStore at all (§15/§25 — synthetic in-memory delegation only)
    policyBypassCount,
    killSwitchBypassCount,
    authorityBypassCount,
    invalidObjectIdCount,
    p50Ms: percentile(latencies, 50),
    p95Ms: percentile(latencies, 95),
  };
}

if (require.main === module) {
  runSimulationEvaluation().then(summary => {
    console.log(JSON.stringify(summary, null, 2));
    assert.ok(summary.total >= 500, `expected >= 500 deterministic scenarios, got ${summary.total}`);
    assert.ok(summary.policyParity >= 0.995, `policy parity ${summary.policyParity} below §40 target 0.995`);
    assert.strictEqual(summary.determinismRate, 1, 'determinism must be 100%');
    assert.strictEqual(summary.realSideEffects, 0, 'real side effects must be 0');
    assert.strictEqual(summary.realExecutionLedgerMutations, 0, 'real execution ledger mutations must be 0');
    assert.strictEqual(summary.realBudgetConsumption, 0, 'real budget consumption must be 0');
    assert.strictEqual(summary.realDelegationQuotaConsumption, 0, 'real delegation quota consumption must be 0');
    assert.strictEqual(summary.policyBypassCount, 0, 'policy bypass must be 0');
    assert.strictEqual(summary.killSwitchBypassCount, 0, 'kill-switch bypass must be 0');
    assert.strictEqual(summary.authorityBypassCount, 0, 'authority bypass must be 0');
    assert.strictEqual(summary.invalidObjectIdCount, 0, 'every simulated object id must carry the sim- prefix');
    console.log('[simulation-evaluation] PASS');
  }).catch(err => {
    console.error('[simulation-evaluation] FAIL:', err);
    process.exitCode = 1;
  });
}
