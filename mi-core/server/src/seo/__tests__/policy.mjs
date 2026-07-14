/**
 * SEO Control Center — policy engine tests.
 * Exercises the REAL evaluatePolicy() in ../seo-policy-engine.ts against the
 * REAL mi-core/config/seo-policy.yaml, plus a synthetic policy file (in a
 * spawned child process, so module-level path caching doesn't leak between
 * scenarios) to prove tier precedence for a category listed in two tiers.
 *
 * Run with:  node --import tsx src/seo/__tests__/policy.mjs
 * (from mi-core/server)
 */

import { execFileSync } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const SERVER_ROOT = join(__dirname, '..', '..', '..'); // mi-core/server

let pass = 0;
let fail = 0;
const failures = [];

function check(label, condition, detail) {
  if (condition) {
    pass++;
    console.log(`  PASS  ${label}`);
  } else {
    fail++;
    failures.push(label);
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

console.log('=== policy.mjs ===');

// ── §1: Precedence — synthetic policy file proving BLOCKED > REQUIRES_APPROVAL
//    Run in a spawned child process (own process = own MI_CORE_ROOT env var =
//    own module cache), so this doesn't taint the real-config tests below. ──

console.log('\n-- Tier precedence (synthetic policy, spawned child process) --');

const synthRoot = mkdtempSync(join(tmpdir(), 'seo-policy-test-'));
try {
  const configDir = join(synthRoot, 'config');
  mkdirSync(configDir, { recursive: true });
  // "dual_listed_action" appears in BOTH BLOCKED and REQUIRES_APPROVAL.
  // Also "dual_auto" appears in both AUTO_WITH_NOTIFICATION and SAFE_AUTO to
  // prove precedence holds throughout the whole chain, not just at the top.
  const synthYaml = `
version: 99
SAFE_AUTO:
  - dual_auto
  - safe_only_action
AUTO_WITH_NOTIFICATION:
  - dual_auto
REQUIRES_APPROVAL:
  - dual_listed_action
BLOCKED:
  - dual_listed_action
`;
  writeFileSync(join(configDir, 'seo-policy.yaml'), synthYaml, 'utf8');

  const script = `
    const { evaluatePolicy } = require(${JSON.stringify(join(SERVER_ROOT, 'src', 'seo', 'seo-policy-engine.ts'))});
    const dual = evaluatePolicy('dual_listed_action');
    const dualAuto = evaluatePolicy('dual_auto');
    const safeOnly = evaluatePolicy('safe_only_action');
    console.log(JSON.stringify({ dual, dualAuto, safeOnly }));
  `;
  const scriptPath = join(synthRoot, 'run.cjs');
  // Use tsx's CJS-compatible register so require() can pull in a .ts file
  // from a plain script, matching how this repo's engine files use require().
  writeFileSync(scriptPath, script, 'utf8');

  const out = execFileSync(
    process.execPath,
    ['--import', 'tsx', scriptPath],
    {
      cwd: SERVER_ROOT,
      env: { ...process.env, MI_CORE_ROOT: synthRoot },
      encoding: 'utf8',
    }
  );
  const lastLine = out.trim().split('\n').pop();
  const result = JSON.parse(lastLine);

  check(
    'category listed in both BLOCKED and REQUIRES_APPROVAL resolves to BLOCKED',
    result.dual.tier === 'BLOCKED',
    `got ${JSON.stringify(result.dual)}`
  );
  check(
    'category listed in both AUTO_WITH_NOTIFICATION and SAFE_AUTO resolves to AUTO_WITH_NOTIFICATION',
    result.dualAuto.tier === 'AUTO_WITH_NOTIFICATION',
    `got ${JSON.stringify(result.dualAuto)}`
  );
  check(
    'category listed only in SAFE_AUTO resolves to SAFE_AUTO (sanity check on synthetic file)',
    result.safeOnly.tier === 'SAFE_AUTO',
    `got ${JSON.stringify(result.safeOnly)}`
  );
} catch (e) {
  check('synthetic precedence child process ran successfully', false, e.stderr ? e.stderr.toString() : e.message);
} finally {
  rmSync(synthRoot, { recursive: true, force: true });
}

// Also confirm by code reading that TIER_PRECEDENCE is declared in the fixed
// order BLOCKED > REQUIRES_APPROVAL > AUTO_WITH_NOTIFICATION > SAFE_AUTO —
// belt-and-suspenders with the runtime proof above.
{
  const src = readFileSync(join(SERVER_ROOT, 'src', 'seo', 'seo-policy-engine.ts'), 'utf8');
  const m = src.match(/const TIER_PRECEDENCE:[^=]*=\s*\[([^\]]*)\]/);
  const order = m ? m[1].split(',').map(s => s.trim().replace(/['"]/g, '')).filter(Boolean) : [];
  check(
    'TIER_PRECEDENCE array is declared in the order [BLOCKED, REQUIRES_APPROVAL, AUTO_WITH_NOTIFICATION, SAFE_AUTO]',
    JSON.stringify(order) === JSON.stringify(['BLOCKED', 'REQUIRES_APPROVAL', 'AUTO_WITH_NOTIFICATION', 'SAFE_AUTO']),
    `found order=${JSON.stringify(order)}`
  );
}

// ── §2: Real policy file — unknown category, production-mutation tiers ────

console.log('\n-- Real config/seo-policy.yaml --');

const { evaluatePolicy, getRawPolicy } = await import(pathToFileURL(join(SERVER_ROOT, 'src', 'seo', 'seo-policy-engine.ts')).href);

const unknown = evaluatePolicy('totally_made_up_category_' + Date.now());
check(
  'unknown category defaults to REQUIRES_APPROVAL (fail-safe, not SAFE_AUTO)',
  unknown.tier === 'REQUIRES_APPROVAL',
  `got ${unknown.tier}`
);
check(
  'unknown category is never SAFE_AUTO',
  unknown.tier !== 'SAFE_AUTO'
);
check(
  'unknown category reason mentions fail-safe default',
  /fail-safe/i.test(unknown.reason),
  unknown.reason
);

const policy = getRawPolicy();
for (const cat of ['production_deploy', 'rollback']) {
  const evalResult = evaluatePolicy(cat);
  check(
    `"${cat}" is not SAFE_AUTO`,
    evalResult.tier !== 'SAFE_AUTO',
    `got ${evalResult.tier}`
  );
  check(
    `"${cat}" is not AUTO_WITH_NOTIFICATION`,
    evalResult.tier !== 'AUTO_WITH_NOTIFICATION',
    `got ${evalResult.tier}`
  );
  check(
    `"${cat}" is present in REQUIRES_APPROVAL list in real seo-policy.yaml`,
    (policy.REQUIRES_APPROVAL || []).includes(cat),
    `REQUIRES_APPROVAL=${JSON.stringify(policy.REQUIRES_APPROVAL)}`
  );
}

// BLOCKED categories in the real file must never appear in any lower tier —
// this is what actually protects production-mutation-adjacent categories.
{
  const tiers = ['SAFE_AUTO', 'AUTO_WITH_NOTIFICATION', 'REQUIRES_APPROVAL', 'BLOCKED'];
  const seen = new Map();
  let anyDuplicate = false;
  const duplicates = [];
  for (const tier of tiers) {
    for (const cat of policy[tier] || []) {
      if (seen.has(cat)) {
        anyDuplicate = true;
        duplicates.push(`${cat} in both ${seen.get(cat)} and ${tier}`);
      } else {
        seen.set(cat, tier);
      }
    }
  }
  check(
    'no category appears in more than one tier in the real seo-policy.yaml (precedence is never actually exercised in prod)',
    !anyDuplicate,
    duplicates.join('; ')
  );
}

// ── §3: Approval expiry — documented gap, not a fake-passed test ──────────

console.log('\n-- Approval expiry concept (gap check) --');
{
  const gateSrc = readFileSync(join(SERVER_ROOT, 'src', 'approval', 'gate.ts'), 'utf8');
  const hasExpiryField = /expir/i.test(gateSrc);
  check(
    'GAP DOCUMENTED (expected false): approval/gate.ts has no expiry/TTL concept for pending approvals — ' +
      'ApprovalAction has no expires_at field, enqueue()/approve()/reject()/getPending() never check elapsed time. ' +
      'A pending REQUIRES_APPROVAL action can sit in the queue indefinitely with no automatic expiry or re-review. ' +
      'This check intentionally asserts the CURRENT (no-expiry) behavior — flip it only once gate.ts actually gains an expiry field.',
    hasExpiryField === false,
    hasExpiryField ? 'unexpected: found "expir" in gate.ts — re-check this test, a concept may now exist' : 'confirmed: no expiry concept found'
  );
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log('Failures:', failures.join(', '));
  process.exit(1);
}
