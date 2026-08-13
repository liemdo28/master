/**
 * Phase 7A acceptance — proves the governing directive's required outcomes.
 * Where a point is already proven by a dedicated test/script, this calls into
 * that same code rather than re-implementing it — one canonical proof per point.
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { runPreflight, intentionallyStoppedServices } from './validator';

interface Point { n: number; label: string; ok: boolean; detail: string; }

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

async function main(): Promise<void> {
  const points: Point[] = [];
  let n = 0;
  const add = (label: string, ok: boolean, detail: string) => points.push({ n: ++n, label, ok, detail });

  // 1-3: the three containments, structurally (functional proof lives in
  // phase7a-authority-containment.test.ts; this re-checks the source text
  // so acceptance doesn't silently pass if a future edit reverts one).
  const nodeAgentSrc = fs.readFileSync(path.join(REPO_ROOT, 'node-agent.mjs'), 'utf8');
  add('node-agent.mjs /exec retired', !nodeAgentSrc.includes('execSync') && nodeAgentSrc.includes('EXEC_RETIRED'), 'no execSync call, EXEC_RETIRED response present');

  const runnerSrc = fs.readFileSync(path.join(REPO_ROOT, 'server/src/jarvis/autonomous-task-runner.ts'), 'utf8');
  const runnerCode = stripComments(runnerSrc);
  add('jarvis/autonomous-task-runner.ts quarantined', !runnerCode.includes('child_process') && (runnerSrc.match(/QUARANTINED_PHASE_7A1/g) || []).length >= 2, 'no child_process import in code, both entrypoints quarantined');

  const gateSrc = fs.readFileSync(path.join(REPO_ROOT, 'server/src/approval/gate.ts'), 'utf8');
  add('approval/gate.ts documented as status-only', gateSrc.includes('Phase 7A.3 invariant') && !stripComments(gateSrc).includes('child_process'), 'invariant documented, no exec import in code');

  // 4: authority manifest clean
  const manifestPath = path.join(REPO_ROOT, 'server/authority-manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as { counts: { unknownMutations: number; unresolvedLegacyMutations: number } };
  add('authority manifest clean', manifest.counts.unknownMutations === 0 && manifest.counts.unresolvedLegacyMutations === 0, `unknownMutations=${manifest.counts.unknownMutations}, unresolvedLegacyMutations=${manifest.counts.unresolvedLegacyMutations}`);

  // 5: runtime preflight validator runs clean (WARN acceptable — only for
  // intentionally-stopped services) against the actual deployed runtime dir
  // if present, otherwise skipped honestly (this repo checkout is not itself
  // a deployed runtime root).
  const prodRoot = 'F:\\Projects\\mi-core';
  if (fs.existsSync(prodRoot)) {
    const report = await runPreflight(prodRoot);
    const nonIntentionalFails = report.checks.filter(c => c.status === 'FAIL');
    add('runtime preflight clean against live production root', nonIntentionalFails.length === 0, nonIntentionalFails.length === 0
      ? `overall=${report.overall} (WARNs only for: ${intentionallyStoppedServices().join(', ')})`
      : `FAIL checks: ${nonIntentionalFails.map(c => c.id).join(', ')}`);
  } else {
    add('runtime preflight clean against live production root', true, 'SKIPPED — F:\\Projects\\mi-core not present in this environment');
  }

  // 6: intentionally-stopped services remain classified, never silently
  // treated as required.
  add('intentionally-stopped services enumerated', intentionallyStoppedServices().length === 3, intentionallyStoppedServices().join(', '));

  // 7: schema unchanged at v10 (no migration performed by Phase 7A).
  const stillV10 = !fs.readdirSync(path.join(REPO_ROOT, 'server/src/personal-os')).some(f => f.toLowerCase().includes('schema-v11'));
  add('no schema v11 migration introduced', stillV10, 'no schema-v11 file found under personal-os/');

  // 8: forbidden action types/authority still absent (re-verifies the
  // standing Phase 6 invariant one more time at the acceptance boundary).
  const actionTypes = fs.readFileSync(path.join(REPO_ROOT, 'server/src/personal-os/actions/types.ts'), 'utf8');
  const forbidden = ['GMAIL_REPLY', 'GMAIL_FORWARD', 'FINANCIAL_TRANSFER', 'PURCHASE', 'SHELL_EXEC', 'RUN_COMMAND'];
  add('no new forbidden action types introduced', forbidden.every(f => !actionTypes.includes(f)), `checked: ${forbidden.join(', ')}`);

  const allPass = points.every(p => p.ok);
  console.log(JSON.stringify({ points, allPass }, null, 2));

  for (const p of points) assert.ok(p.ok, `Point ${p.n} (${p.label}) failed: ${p.detail}`);
  console.log('[phase7a-acceptance] PASS');
}

main().catch(err => { console.error(err); process.exit(1); });
