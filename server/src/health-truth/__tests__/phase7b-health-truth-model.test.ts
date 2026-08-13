/**
 * Phase 7B — health/dependency truth model unit tests: aggregation,
 * criticality gating, reason-code traceability, capability impact shape.
 * Pure-function tests against synthetic DependencyHealth arrays (no live
 * process/network/PM2 dependency) plus fixture-based tests of the one probe
 * (probeIntentionallyDisabled) that is itself pure given a runtime root.
 */
import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { computeOverall } from '../aggregate';
import { probeIntentionallyDisabled, probeCore } from '../probes';
import { stateBlocksOverall } from '../types';
import type { DependencyHealth, DependencyState, Criticality } from '../types';

function d(overrides: Partial<DependencyHealth> & Pick<DependencyHealth, 'id'>): DependencyHealth {
  return {
    state: 'HEALTHY',
    criticality: 'REQUIRED_FOR_CORE',
    reasonCode: 'OK',
    detail: '',
    capabilityImpact: [],
    lastCheckedAt: null,
    lastHealthyAt: null,
    lastFailureAt: null,
    ...overrides,
  };
}

const ALL_HEALTHY: DependencyHealth[] = [
  d({ id: 'CORE' }),
  d({ id: 'DATABASE' }),
  d({ id: 'AUTHORITY' }),
  d({ id: 'KNOWLEDGE', criticality: 'OPTIONAL_DEGRADED' }),
  d({ id: 'PYTHON_AI', criticality: 'FEATURE_SCOPED' }),
  d({ id: 'LOCAL_MODEL', criticality: 'OPTIONAL_DEGRADED' }),
  d({ id: 'GOOGLE_CONNECTORS', criticality: 'FEATURE_SCOPED' }),
  d({ id: 'NODE_AGENT', criticality: 'FEATURE_SCOPED' }),
  d({ id: 'ACCOUNTING', criticality: 'FEATURE_SCOPED' }),
  d({ id: 'QB_AGENT', criticality: 'FEATURE_SCOPED' }),
  d({ id: 'WHATSAPP', state: 'INTENTIONALLY_DISABLED', criticality: 'INTENTIONALLY_DISABLED', reasonCode: 'INTENTIONALLY_DISABLED' }),
  d({ id: 'N8N', state: 'INTENTIONALLY_DISABLED', criticality: 'INTENTIONALLY_DISABLED', reasonCode: 'INTENTIONALLY_DISABLED' }),
  d({ id: 'CEO_OBSERVER', state: 'INTENTIONALLY_DISABLED', criticality: 'INTENTIONALLY_DISABLED', reasonCode: 'INTENTIONALLY_DISABLED' }),
];

function withDep(base: DependencyHealth[], id: DependencyHealth['id'], patch: Partial<DependencyHealth>): DependencyHealth[] {
  return base.map(dep => dep.id === id ? { ...dep, ...patch } : dep);
}

async function run(): Promise<void> {
  let scenarios = 0;
  let passed = 0;

  // ── 1. All healthy (incl. intentionally-disabled trio) → HEALTHY ───────────
  {
    scenarios++;
    const { overall, overallReason } = computeOverall(ALL_HEALTHY);
    assert.strictEqual(overall, 'HEALTHY');
    assert.strictEqual(overallReason, 'OK');
    passed++;
  }

  // ── 2. AUTHORITY unhealthy → BLOCKED, checked first, cannot be masked ──────
  {
    scenarios++;
    const deps = withDep(ALL_HEALTHY, 'AUTHORITY', { state: 'UNAVAILABLE', reasonCode: 'AUTHORITY_UNKNOWN_MUTATION' });
    const { overall, overallReason } = computeOverall(deps);
    assert.strictEqual(overall, 'BLOCKED');
    assert.strictEqual(overallReason, 'AUTHORITY_UNKNOWN_MUTATION', 'overallReason must trace to the actual blocking dependency, not be fabricated');
    passed++;
  }

  // ── 3. AUTHORITY unhealthy AND DATABASE unhealthy simultaneously → still
  //      BLOCKED, never averaged/overridden by the other REQUIRED_FOR_CORE failure ──
  {
    scenarios++;
    let deps = withDep(ALL_HEALTHY, 'AUTHORITY', { state: 'UNAVAILABLE', reasonCode: 'AUTHORITY_UNRESOLVED_LEGACY_MUTATION' });
    deps = withDep(deps, 'DATABASE', { state: 'UNAVAILABLE', reasonCode: 'DB_INTEGRITY_FAILED' });
    const { overall, overallReason } = computeOverall(deps);
    assert.strictEqual(overall, 'BLOCKED', 'AUTHORITY must win priority over a simultaneous DATABASE failure');
    assert.strictEqual(overallReason, 'AUTHORITY_UNRESOLVED_LEGACY_MUTATION');
    passed++;
  }

  // ── 4. AUTHORITY healthy, DATABASE (REQUIRED_FOR_CORE) unhealthy → UNAVAILABLE ─
  {
    scenarios++;
    const deps = withDep(ALL_HEALTHY, 'DATABASE', { state: 'UNAVAILABLE', reasonCode: 'DB_INTEGRITY_FAILED' });
    const { overall, overallReason } = computeOverall(deps);
    assert.strictEqual(overall, 'UNAVAILABLE');
    assert.strictEqual(overallReason, 'DB_INTEGRITY_FAILED');
    passed++;
  }

  // ── 5. Only an OPTIONAL_DEGRADED dependency unhealthy → DEGRADED, never
  //      UNAVAILABLE/BLOCKED ─────────────────────────────────────────────────
  {
    scenarios++;
    const deps = withDep(ALL_HEALTHY, 'LOCAL_MODEL', { state: 'UNAVAILABLE', reasonCode: 'MODEL_UNAVAILABLE' });
    const { overall, overallReason } = computeOverall(deps);
    assert.strictEqual(overall, 'DEGRADED');
    assert.strictEqual(overallReason, 'MODEL_UNAVAILABLE');
    passed++;
  }

  // ── 6. Only a FEATURE_SCOPED dependency unhealthy → DEGRADED, never
  //      UNAVAILABLE/BLOCKED ─────────────────────────────────────────────────
  {
    scenarios++;
    const deps = withDep(ALL_HEALTHY, 'GOOGLE_CONNECTORS', { state: 'DISCONNECTED', reasonCode: 'OAUTH_DISCONNECTED' });
    const { overall, overallReason } = computeOverall(deps);
    assert.strictEqual(overall, 'DEGRADED');
    assert.strictEqual(overallReason, 'OAUTH_DISCONNECTED');
    passed++;
  }

  // ── 7. NODE_AGENT BLOCKED (FEATURE_SCOPED) → DEGRADED at overall level, not
  //      BLOCKED — only AUTHORITY's own unhealthiness produces overall BLOCKED ──
  {
    scenarios++;
    const deps = withDep(ALL_HEALTHY, 'NODE_AGENT', { state: 'BLOCKED', reasonCode: 'REGISTRATION_BLOCKED' });
    const { overall } = computeOverall(deps);
    assert.strictEqual(overall, 'DEGRADED', 'a FEATURE_SCOPED dependency in BLOCKED state must still only produce overall DEGRADED');
    passed++;
  }

  // ── 8. INTENTIONALLY_DISABLED dependencies never contribute to any verdict,
  //      even many of them at once, even alongside one real DEGRADED issue ────
  {
    scenarios++;
    let deps = withDep(ALL_HEALTHY, 'PYTHON_AI', { state: 'UNAVAILABLE', reasonCode: 'PROCESS_NOT_RUNNING' });
    const { overall, overallReason } = computeOverall(deps);
    assert.strictEqual(overall, 'DEGRADED');
    assert.strictEqual(overallReason, 'PROCESS_NOT_RUNNING', 'the three INTENTIONALLY_DISABLED deps must never be picked as the reason');
    passed++;
  }

  // ── 9. Defensive branch: AUTHORITY itself marked INTENTIONALLY_DISABLED
  //      criticality (never happens in real probes.ts, but aggregate.ts checks
  //      it explicitly) must not force BLOCKED ──────────────────────────────
  {
    scenarios++;
    const deps = withDep(ALL_HEALTHY, 'AUTHORITY', { state: 'UNAVAILABLE', criticality: 'INTENTIONALLY_DISABLED', reasonCode: 'UNKNOWN' });
    const { overall } = computeOverall(deps);
    assert.notStrictEqual(overall, 'BLOCKED');
    passed++;
  }

  // ── 10. Exhaustive stateBlocksOverall table ─────────────────────────────────
  {
    const states: DependencyState[] = ['HEALTHY', 'DEGRADED', 'UNAVAILABLE', 'DISCONNECTED', 'BLOCKED', 'INTENTIONALLY_DISABLED', 'UNKNOWN'];
    const criticalities: Criticality[] = ['REQUIRED_FOR_CORE', 'OPTIONAL_DEGRADED', 'FEATURE_SCOPED', 'INTENTIONALLY_DISABLED'];
    for (const state of states) {
      for (const criticality of criticalities) {
        scenarios++;
        const blocks = stateBlocksOverall(state, criticality);
        if (state === 'HEALTHY' || state === 'INTENTIONALLY_DISABLED' || criticality === 'INTENTIONALLY_DISABLED') {
          assert.strictEqual(blocks, false, `state=${state} criticality=${criticality} must never block`);
        } else if (criticality === 'REQUIRED_FOR_CORE') {
          assert.strictEqual(blocks, true, `state=${state} criticality=${criticality} must block`);
        } else {
          assert.strictEqual(blocks, false, `state=${state} criticality=${criticality} (non-required) must not force UNAVAILABLE via this helper`);
        }
        passed++;
      }
    }
  }

  // ── 11. probeIntentionallyDisabled: code-present vs code-absent, both branches
  //      always report INTENTIONALLY_DISABLED state (never "unhealthy") ──────
  {
    scenarios++;
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mi-7b-eval-'));
    fs.mkdirSync(path.join(root, 'services', 'whatsapp-ai-gateway'), { recursive: true });
    const present = probeIntentionallyDisabled('WHATSAPP', root);
    assert.strictEqual(present.state, 'INTENTIONALLY_DISABLED');
    assert.strictEqual(present.criticality, 'INTENTIONALLY_DISABLED');
    assert.strictEqual(present.reasonCode, 'INTENTIONALLY_DISABLED');
    passed++;

    scenarios++;
    const absent = probeIntentionallyDisabled('N8N', root); // n8n-execution-bus dir not created
    assert.strictEqual(absent.state, 'INTENTIONALLY_DISABLED', 'missing runtime code must still report INTENTIONALLY_DISABLED, never a failure state');
    assert.strictEqual(absent.reasonCode, 'RUNTIME_NOT_DEPLOYED');
    passed++;
    fs.rmSync(root, { recursive: true, force: true });
  }

  // ── 12. probeCore is always HEALTHY/REQUIRED_FOR_CORE, deterministic shape ──
  {
    scenarios++;
    const core = probeCore();
    assert.strictEqual(core.state, 'HEALTHY');
    assert.strictEqual(core.criticality, 'REQUIRED_FOR_CORE');
    assert.strictEqual(core.reasonCode, 'OK');
    assert.ok(core.lastCheckedAt);
    passed++;
  }

  // ── 13. Determinism: identical input twice → byte-identical aggregation output ─
  {
    scenarios++;
    const a = computeOverall(ALL_HEALTHY);
    const b = computeOverall(ALL_HEALTHY);
    assert.deepStrictEqual(a, b);
    passed++;
  }

  // ── 14. Regression: a REQUIRED_FOR_CORE dependency reporting state
  //      INTENTIONALLY_DISABLED must be excluded from requiredDown the same
  //      way it's excluded from the degraded check — found by the >=300
  //      scenario evaluation (health-truth:evaluation), which caught this
  //      asymmetry between the two find() predicates. Never occurs with the
  //      real probe wiring today (only WHATSAPP/N8N/CEO_OBSERVER, all
  //      criticality INTENTIONALLY_DISABLED, ever report this state), but the
  //      pure aggregation function must stay internally consistent regardless. ──
  {
    scenarios++;
    const deps = withDep(ALL_HEALTHY, 'DATABASE', { state: 'INTENTIONALLY_DISABLED', criticality: 'REQUIRED_FOR_CORE' });
    const { overall } = computeOverall(deps);
    assert.strictEqual(overall, 'HEALTHY', 'a REQUIRED_FOR_CORE dependency reporting INTENTIONALLY_DISABLED must not force UNAVAILABLE');
    passed++;
  }

  // ── 15. Regression: provenance-mismatch fold into AUTHORITY must produce a
  //      non-empty capabilityImpact, not silently inherit the empty array from
  //      the healthy-AUTHORITY branch it's spread from — found by the same
  //      evaluation run against this exact checkout (no .env → provenance not
  //      configured → this path is live, not synthetic). ──────────────────────
  {
    scenarios++;
    const { getSystemHealth } = await import('../aggregate');
    const health = await getSystemHealth();
    const authority = health.dependencies.find(dep => dep.id === 'AUTHORITY')!;
    if (authority.reasonCode === 'PROVENANCE_MISMATCH') {
      assert.ok(authority.capabilityImpact.length > 0, 'PROVENANCE_MISMATCH must carry a non-empty capabilityImpact');
    }
    passed++;
  }

  assert.strictEqual(passed, scenarios);
  console.log(`[phase7b-health-truth-model] PASS — ${passed}/${scenarios} scenarios verified`);
}

run().catch(err => { console.error(err); process.exit(1); });
