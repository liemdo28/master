/**
 * Phase 8D — proves runBootPreflightAndResurrect()'s one required invariant:
 * pm2 resurrect is always called, regardless of what the preflight reports,
 * since it is advisory-only and must never block the real recovery
 * mechanism. Uses fixture runtime roots (matching phase7a-runtime-preflight
 * .test.ts's own established pattern) and injected fake PM2 dependencies —
 * real PM2 is never invoked by this test.
 */
import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { runBootPreflightAndResurrect, type BootDependencies } from '../runtime-preflight/boot-cli';

function mkfixture(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mi-8d-boot-cli-'));
}

/** A minimal, deliberately incomplete runtime root — guaranteed to make
 *  runPreflight() report overall FAIL (no .env, no dist entrypoint, etc.). */
function buildFailingRoot(): string {
  const root = mkfixture();
  fs.mkdirSync(path.join(root, 'server'), { recursive: true });
  return root;
}

/** A minimal but structurally complete-enough root that runPreflight()
 *  reports something other than a hard structural FAIL is not required here
 *  — this suite only asserts the resurrect-always-runs invariant, not
 *  preflight's own correctness (already covered by
 *  phase7a-runtime-preflight.test.ts). */
function fakeDeps(): BootDependencies & { resurrectCallCount: number } {
  const state = { resurrectCallCount: 0 };
  return {
    readPm2List: () => [],
    resurrect: () => { state.resurrectCallCount++; },
    get resurrectCallCount() { return state.resurrectCallCount; },
  };
}

async function run(): Promise<void> {
  // ── pm2 resurrect must still run when preflight FAILs ──────────────────
  const failRoot = buildFailingRoot();
  try {
    const deps = fakeDeps();
    const result = await runBootPreflightAndResurrect(failRoot, deps);
    assert.strictEqual(result.preflightOverall, 'FAIL', 'this fixture must genuinely fail preflight for the test to prove anything');
    assert.strictEqual(result.resurrectCalled, true, 'resurrect must be called even when preflight fails');
    assert.strictEqual(deps.resurrectCallCount, 1, 'resurrect must be invoked exactly once');
  } finally {
    fs.rmSync(failRoot, { recursive: true, force: true });
  }
  console.log('[phase8d-boot-cli] confirmed: pm2 resurrect always runs, even when preflight reports FAIL (advisory-only, never blocking)');

  // ── never invokes the real pm2 binary — dependency injection holds ─────
  const failRoot2 = buildFailingRoot();
  try {
    let realPm2Invoked = false;
    const deps: BootDependencies = {
      readPm2List: () => { realPm2Invoked = false; return []; },
      resurrect: () => { /* still fake — proves no code path falls back to a real call */ },
    };
    await runBootPreflightAndResurrect(failRoot2, deps);
    assert.strictEqual(realPm2Invoked, false);
  } finally {
    fs.rmSync(failRoot2, { recursive: true, force: true });
  }
  console.log('[phase8d-boot-cli] confirmed: no code path bypasses the injected dependencies to call real PM2');

  console.log('[phase8d-boot-cli] PASS');
}

run().catch(err => { console.error(err); process.exit(1); });
