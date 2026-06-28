/**
 * Duplicate Task / Workflow Overlap Audit Test.
 *
 * Exercises the REAL Executive-Coordination duplicate detector
 * (server/src/executive-coordination/duplicate-detector.ts) — Jaccard + semantic
 * boost, threshold 0.4 — against the six overlap scenarios the CEO directive
 * names. Proves duplicates are DETECTED, can be MERGED (canonical preserved),
 * and that distinct work is NOT falsely merged (no task explosion, no over-merge).
 *
 * Honesty note: this is the coordination-layer dedup (where tasks are actually
 * created). Cross-source idempotency (single-use approval tokens, evidence keys)
 * is covered by other layers and is documented in the audit report, not faked here.
 */
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER = join(__dirname, '..', 'server');
const require = createRequire(join(SERVER, 'index.js'));
const dd = require(join(SERVER, 'dist', 'executive-coordination', 'duplicate-detector.js'));

let passed = 0, failed = 0;
function assert(label, condition) {
  if (condition) { console.log(`  PASS: ${label}`); passed++; }
  else { console.log(`  FAIL: ${label}`); failed++; }
}

let seq = 0;
const task = (title, division = 'marketing', owner = 'agent-a') => ({
  id: `T-${++seq}`, title, division, owner, duplicateOf: null,
});
function pairMatched(a, b) {
  const matches = dd.detectDuplicates([a, b]);
  return matches.some((m) => (m.taskA === a.id && m.taskB === b.id) || (m.taskA === b.id && m.taskB === a.id));
}

console.log('\n=== Duplicate Task / Workflow Overlap Audit ===');

console.log('\n--- Scenario 1: same objective submitted twice ---');
assert('identical objective titles detected as duplicate',
  pairMatched(task('Increase Raw Sushi online revenue'), task('Increase Raw Sushi online revenue')));

console.log('\n--- Scenario 2: same task created by two different agents ---');
const t2a = task('Run SEO Audit for Bakudan', 'marketing', 'agent-seo-1');
const t2b = task('Run SEO Review for Bakudan', 'marketing', 'agent-seo-2');
assert('two agents creating the same task are detected (semantic seo+review)', pairMatched(t2a, t2b));

console.log('\n--- Scenario 3: same workflow triggered by n8n AND agent-engine ---');
assert('n8n-triggered and agent-triggered same workflow detected',
  pairMatched(task('Sync DoorDash metrics', 'operations', 'n8n'), task('Sync DoorDash metrics', 'operations', 'agent-engine')));

console.log('\n--- Scenario 4: same OSS capability selected twice ---');
assert('overlapping OSS-capability tasks detected (deploy dashboard)',
  pairMatched(task('Deploy Metabase dashboard', 'it'), task('Deploy dashboard', 'it')));

console.log('\n--- Scenario 5: same connector evidence / report task twice ---');
assert('duplicate report tasks detected (semantic report cluster)',
  pairMatched(task('Generate revenue report', 'finance'), task('Generate revenue analytics', 'finance')));

console.log('\n--- Scenario 6: same approval-gated campaign requested twice ---');
assert('duplicate campaign-launch tasks detected',
  pairMatched(task('Launch Q3 marketing campaign', 'marketing'), task('Launch Q3 marketing campaign', 'marketing')));

console.log('\n--- Merge preserves canonical + owner + no explosion ---');
const canonical = task('Increase Raw Sushi revenue 10%', 'executive', 'ceo');
const dup = task('Increase Raw Sushi revenue 10%', 'executive', 'agent-x');
const all = [canonical, dup];
const matches = dd.detectDuplicates(all);
assert('one duplicate pair found (not a storm)', matches.length === 1);
const marked = dd.markDuplicate(canonical.id, dup.id, (id, patch) => {
  const t = all.find((x) => x.id === id);
  if (!t) return null;
  Object.assign(t, patch);
  return t;
});
assert('markDuplicate returns canonical + marked', marked && marked.canonical === canonical.id && marked.marked === dup.id);
assert('duplicate now points to canonical (merged, not deleted)', dup.duplicateOf === canonical.id);
assert('canonical task preserved (owner intact)', canonical.owner === 'ceo' && !canonical.duplicateOf);
const summary = dd.getDuplicateSummary(all);
assert('summary counts exactly 1 duplicate', summary.totalDuplicates === 1);
assert('summary names the canonical task', summary.canonicalTasks.includes(canonical.id));
assert('re-detecting after merge yields no new pairs (no re-explosion)', dd.detectDuplicates(all).length === 0);

console.log('\n--- No false-merge of genuinely distinct work ---');
assert('SEO audit vs paying a vendor invoice are NOT merged',
  !pairMatched(task('Run SEO Audit', 'marketing'), task('Pay vendor invoice', 'finance')));
assert('hire a chef vs deploy a dashboard are NOT merged',
  !pairMatched(task('Hire a head chef', 'operations'), task('Deploy analytics dashboard', 'it')));

console.log(`\n  RESULTS: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
