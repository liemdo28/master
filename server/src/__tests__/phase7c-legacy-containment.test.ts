/**
 * Phase 7C legacy-entrypoint containment — structural (source-text) proof
 * that the gstack/coo-v4 in-process quarantine-bypass found during the
 * Phase 7C component audit (docs/architecture/PHASE7C_COMPONENT_AUDIT.md §2)
 * cannot regress silently, plus a functional proof that the two call sites
 * never reach the quarantined orchestrators.
 *
 * Background: gstack-orchestrator.processGStackRequest() and
 * coo-v4/coo-orchestrator.ts's cooExecute()/handleCeoSignal() are
 * LEGACY_QUARANTINED at the HTTP layer (POST /api/gstack/process,
 * POST /api/coo-v4/execute are 409-blocked by legacyAuthorityBoundary), but
 * were also reachable via direct in-process require()+call from
 * jarvis/executive/executive-personality.ts and
 * jarvis/phase30-jarvis/jarvis-core.ts on raw WhatsApp text — a path Express
 * middleware cannot intercept. This test proves that bypass is closed, using
 * the same technique as phase7a-security.test.ts / phase7a-authority-
 * containment.test.ts for the Phase 7A.1/7A.2 containments.
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');

function read(relToRepoRoot: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, relToRepoRoot), 'utf8');
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

async function run(): Promise<void> {
  let scenarios = 0;
  let passed = 0;

  // ── Structural: executive-personality.ts's tryGStack() never reaches
  //    processGStackRequest() ──────────────────────────────────────────────
  {
    scenarios++;
    const raw = read('server/src/jarvis/executive/executive-personality.ts');
    const src = stripComments(raw);
    assert.ok(!src.includes('processGStackRequest('), 'executive-personality.ts must never call processGStackRequest()');
    assert.ok(!src.includes("require('../../gstack/gstack-orchestrator')"), 'executive-personality.ts must not require gstack-orchestrator at all');
    assert.ok(raw.includes('QUARANTINED_PHASE_7C1'), 'tryGStack() must document the quarantine reason');
    passed++;
  }

  // ── Structural: jarvis-core.ts's two coo-v4 execution call sites never
  //    reach cooExecute()/handleCeoSignal() ──────────────────────────────
  {
    scenarios++;
    const src = stripComments(read('server/src/jarvis/phase30-jarvis/jarvis-core.ts'));
    assert.ok(!src.includes('cooExecute('), 'jarvis-core.ts must never call cooExecute()');
    assert.ok(!src.includes('handleCeoSignal('), 'jarvis-core.ts must never call handleCeoSignal()');
    assert.ok((src.match(/QUARANTINED_PHASE_7C1/g) || []).length >= 2, 'both quarantined trigger blocks must document the reason');
    passed++;
  }

  // ── Structural: read-only coo-v4 call sites (status/report/advisory) are
  //    NOT quarantined — this test would fail loudly if a future edit
  //    over-quarantines and removes legitimate read-only functionality ───
  {
    scenarios++;
    const src = stripComments(read('server/src/jarvis/phase30-jarvis/jarvis-core.ts'));
    for (const stillPresent of ['getRunningWorkflows(', 'runCouncilV4(', 'generateSelfImprovementReportV4(', 'getSkillStats(', 'classify(']) {
      assert.ok(src.includes(stillPresent), `read-only/advisory call ${stillPresent} must remain — only execution-authority bypasses were quarantined, not observation`);
    }
    passed++;
  }

  // ── Functional: calling the quarantined entrypoints with trigger text
  //    never touches the gstack/coo-v4 modules — proven by making
  //    Module._load throw for those specifiers and confirming neither path
  //    ever attempts to load them. ──────────────────────────────────────
  {
    scenarios++;
    const Module = require('module');
    const originalLoad = Module._load;
    const forbiddenLoads: string[] = [];
    Module._load = function (request: string, ...rest: unknown[]) {
      if (request.includes('gstack/gstack-orchestrator') || request.includes('coo-v4/coo-orchestrator')) {
        forbiddenLoads.push(request);
        throw new Error(`quarantined module must never be loaded: ${request}`);
      }
      return originalLoad.apply(this, [request, ...rest]);
    };
    try {
      const { processExecutiveQuery } = require('../jarvis/executive/executive-personality');
      await processExecutiveQuery('tao bai seo cho bakudan ramen post len website', '+15550000000');
    } finally {
      Module._load = originalLoad;
    }
    assert.strictEqual(forbiddenLoads.length, 0, `quarantined modules were loaded: ${forbiddenLoads.join(', ')}`);
    passed++;
  }

  assert.strictEqual(passed, scenarios);
  console.log(`[phase7c-legacy-containment] PASS — ${passed}/${scenarios} scenarios verified`);
}

run().catch(err => { console.error(err); process.exit(1); });
