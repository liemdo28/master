/**
 * OSS Coverage Audit Test (Phase 12–20).
 *
 * Validates the OSS GOVERNANCE manifest, not OSS integration. It asserts every
 * phase 12–20 has at least one governed OSS selection, every OSS entry carries
 * the full governance record (role, owner, license, license-risk, lifecycle,
 * rejected alternative + reason), and — per the CTO truth rule — that the
 * manifest HONESTLY declares these OSS are evaluated/selected but NOT yet
 * integrated into the engine source (which imports only Node builtins).
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const manifestPath = join(__dirname, '..', 'reports', 'data', 'phase-12-20-oss-manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

let passed = 0, failed = 0;
function assert(label, condition) {
  if (condition) { console.log(`  PASS: ${label}`); passed++; }
  else { console.log(`  FAIL: ${label}`); failed++; }
}

console.log('\n=== OSS Coverage Audit (Phase 12–20) ===');

const REQUIRED_FIELDS = [
  'name', 'phase', 'businessRole', 'ownerDivision', 'license', 'licenseRisk',
  'lifecycleStage', 'status', 'integrationStatus', 'usedBy', 'rejectedAlternative', 'reason',
];

console.log('\n--- Manifest honesty (CTO truth rule) ---');
assert('manifest declares integration reality EVALUATED_SELECTED_NOT_INTEGRATED',
  manifest.integrationReality === 'EVALUATED_SELECTED_NOT_INTEGRATED');
assert('manifest does NOT claim OSS is integrated/operational',
  !/INTEGRATED_OPERATIONAL|OSS_INTEGRATED/.test(JSON.stringify(manifest.integrationReality)));

console.log('\n--- Every phase 12–20 has a governed OSS selection ---');
for (let phase = 12; phase <= 20; phase++) {
  const selected = manifest.oss.filter((o) => o.phase === phase && o.status === 'SELECTED');
  assert(`phase ${phase} has >=1 SELECTED OSS`, selected.length >= 1);
}

console.log('\n--- Every OSS entry has a complete governance record ---');
let completeCount = 0;
for (const o of manifest.oss) {
  const missing = REQUIRED_FIELDS.filter((f) => o[f] === undefined || o[f] === null || String(o[f]).trim() === '');
  if (missing.length === 0) completeCount++;
  else console.log(`    (incomplete) ${o.name} p${o.phase} missing: ${missing.join(', ')}`);
}
assert('all OSS entries carry every governance field', completeCount === manifest.oss.length);

console.log('\n--- License risk is explicitly scored (no UNKNOWN) ---');
assert('every entry has a license-risk of low/medium/high',
  manifest.oss.every((o) => ['low', 'medium', 'high'].includes(o.licenseRisk)));

console.log('\n--- Each entry honestly marks integration status NOT_INTEGRATED ---');
assert('no entry falsely claims integration',
  manifest.oss.every((o) => o.integrationStatus === 'NOT_INTEGRATED'));

console.log('\n--- Each entry names a rollback/replacement alternative ---');
assert('every entry has a rejected/alternative option with a reason',
  manifest.oss.every((o) => o.rejectedAlternative.length > 0 && o.reason.length > 0));

console.log('\n--- Medium/high license-risk OSS have a low-risk rollback noted ---');
const risky = manifest.oss.filter((o) => o.licenseRisk !== 'low');
assert('flagged-license OSS each document a fallback in their reason',
  risky.every((o) => /rollback|fallback|kept|rejected|flagged/i.test(o.reason)));

console.log(`\n  RESULTS: ${passed} passed, ${failed} failed`);
console.log(`  (governed OSS entries: ${manifest.oss.length}; phases covered: 12–20)`);
process.exit(failed === 0 ? 0 : 1);
