/**
 * SEO Config Consistency Test
 *
 * Guards against brands.json/locations.json drift between the canonical
 * copy the live mi-core server reads and the legacy mirror kept for the
 * standalone SEO orchestrator at repo root. See:
 *   - mi-core/server/src/seo/brand-config.ts   (canonical reader)
 *   - SEO/shared/config/sync-from-canonical.js (keeps mirror in sync)
 *   - docs/seo-control-center/SEO_PATH_CONSOLIDATION.md (full writeup)
 *
 * This test does NOT run the sync script — it asserts the two copies are
 * semantically identical *right now*, so a run right after a hand-edit
 * (before anyone remembers to sync/validate) fails loudly instead of
 * silently drifting.
 *
 * Usage:
 *   node mi-core/server/src/seo/__config_tests__/config-consistency.mjs
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const path = require('path');
const fs = require('fs');

const MI_CORE_ROOT = process.env.MI_CORE_ROOT || 'D:/Project/Master/mi-core';
const CANONICAL_DIR = path.join(MI_CORE_ROOT, 'SEO', 'shared', 'config');
const ROOT_PROJECT = 'D:/Project/Master';
const LEGACY_DIR = path.join(ROOT_PROJECT, 'SEO', 'shared', 'config');

const CANONICAL_BRANDS = path.join(CANONICAL_DIR, 'brands.json');
const CANONICAL_LOCATIONS = path.join(CANONICAL_DIR, 'locations.json');
const LEGACY_BRANDS = path.join(LEGACY_DIR, 'brands.json');
const LEGACY_LOCATIONS = path.join(LEGACY_DIR, 'locations.json');

let pass = 0;
let fail = 0;
const failures = [];

function check(label, ok, detail = '') {
  if (ok) {
    pass++;
    console.log(`  ✅ ${label}`);
  } else {
    fail++;
    console.log(`  ❌ ${label}${detail ? ' — ' + detail : ''}`);
    failures.push(`${label}: ${detail}`);
  }
}

function section(name) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(name);
  console.log('='.repeat(60));
}

function readJson(filePath, labelForError) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${labelForError} does not exist: ${filePath}`);
  }
  const raw = fs.readFileSync(filePath, 'utf8');
  try {
    return JSON.parse(raw);
  } catch (e) {
    throw new Error(`${labelForError} is not valid JSON (${filePath}): ${e.message}`);
  }
}

function diffSets(setA, setB) {
  const onlyInA = [...setA].filter(x => !setB.has(x));
  const onlyInB = [...setB].filter(x => !setA.has(x));
  return { onlyInA, onlyInB };
}

// ── Load both copies ─────────────────────────────────────────────────────

section('SEO Config Consistency Test');
console.log(`Canonical dir (mi-core, live server reads this): ${CANONICAL_DIR}`);
console.log(`Legacy mirror dir (standalone orchestrator):      ${LEGACY_DIR}`);

let canonicalBrands, legacyBrandsData, canonicalLocations, legacyLocationsData;
try {
  canonicalBrands = readJson(CANONICAL_BRANDS, 'Canonical brands.json');
  legacyBrandsData = readJson(LEGACY_BRANDS, 'Legacy brands.json');
  canonicalLocations = readJson(CANONICAL_LOCATIONS, 'Canonical locations.json');
  legacyLocationsData = readJson(LEGACY_LOCATIONS, 'Legacy locations.json');
} catch (e) {
  console.error(`\nFATAL: ${e.message}`);
  process.exit(1);
}

// ── Brands: same brand_ids, same status per brand ────────────────────────

section('Brands: brand_id set + status parity');

const canonicalBrandList = canonicalBrands.brands || [];
const legacyBrandList = legacyBrandsData.brands || [];

const canonicalBrandIds = new Set(canonicalBrandList.map(b => b.brand_id));
const legacyBrandIds = new Set(legacyBrandList.map(b => b.brand_id));

{
  const { onlyInA, onlyInB } = diffSets(canonicalBrandIds, legacyBrandIds);
  check(
    'Same set of brand_ids in both copies',
    onlyInA.length === 0 && onlyInB.length === 0,
    onlyInA.length || onlyInB.length
      ? `only in canonical: [${onlyInA.join(', ')}] | only in legacy: [${onlyInB.join(', ')}]`
      : ''
  );
}

const canonicalBrandById = new Map(canonicalBrandList.map(b => [b.brand_id, b]));
const legacyBrandById = new Map(legacyBrandList.map(b => [b.brand_id, b]));

for (const brandId of canonicalBrandIds) {
  if (!legacyBrandById.has(brandId)) continue; // already reported above
  const c = canonicalBrandById.get(brandId);
  const l = legacyBrandById.get(brandId);
  check(
    `Brand "${brandId}": status matches (${c.status})`,
    c.status === l.status,
    c.status !== l.status ? `canonical="${c.status}" legacy="${l.status}"` : ''
  );
}

// ── Locations: same location_ids per brand, same status ─────────────────

section('Locations: location_id set per brand + status parity');

const canonicalLocList = canonicalLocations.locations || [];
const legacyLocList = legacyLocationsData.locations || [];

function keyOf(loc) { return `${loc.brand_id}|${loc.location_id}`; }

const canonicalLocKeys = new Set(canonicalLocList.map(keyOf));
const legacyLocKeys = new Set(legacyLocList.map(keyOf));

{
  const { onlyInA, onlyInB } = diffSets(canonicalLocKeys, legacyLocKeys);
  check(
    'Same set of (brand_id, location_id) pairs in both copies',
    onlyInA.length === 0 && onlyInB.length === 0,
    onlyInA.length || onlyInB.length
      ? `only in canonical: [${onlyInA.join(', ')}] | only in legacy: [${onlyInB.join(', ')}]`
      : ''
  );
}

const canonicalLocByKey = new Map(canonicalLocList.map(l => [keyOf(l), l]));
const legacyLocByKey = new Map(legacyLocList.map(l => [keyOf(l), l]));

for (const key of canonicalLocKeys) {
  if (!legacyLocByKey.has(key)) continue; // already reported above
  const c = canonicalLocByKey.get(key);
  const l = legacyLocByKey.get(key);
  check(
    `Location "${key}": status matches (${c.status})`,
    c.status === l.status,
    c.status !== l.status ? `canonical="${c.status}" legacy="${l.status}"` : ''
  );
}

// ── Byte-identity sanity check (informational, not a hard requirement) ──

section('Byte-identity (informational)');
const brandsIdentical = fs.readFileSync(CANONICAL_BRANDS, 'utf8') === fs.readFileSync(LEGACY_BRANDS, 'utf8');
const locationsIdentical = fs.readFileSync(CANONICAL_LOCATIONS, 'utf8') === fs.readFileSync(LEGACY_LOCATIONS, 'utf8');
console.log(`  brands.json byte-identical:    ${brandsIdentical}`);
console.log(`  locations.json byte-identical: ${locationsIdentical}`);
if (!brandsIdentical || !locationsIdentical) {
  console.log('  (Not byte-identical is OK as long as the semantic checks above passed —');
  console.log('   e.g. differing "updated_at" timestamps or key order. Run');
  console.log('   `node SEO/shared/config/sync-from-canonical.js` to force byte-identity.)');
}

// ── Summary ───────────────────────────────────────────────────────────────

section('Summary');
console.log(`Pass: ${pass}  Fail: ${fail}`);
if (fail > 0) {
  console.log('\nDIVERGENCE DETECTED between canonical and legacy config copies:');
  for (const f of failures) console.log(`  - ${f}`);
  console.log('\nFix: run `node SEO/shared/config/sync-from-canonical.js` to re-sync the');
  console.log('legacy mirror from the canonical mi-core copy, then re-run this test.');
  process.exit(1);
} else {
  console.log('\nOK: canonical and legacy config copies are semantically identical.');
  process.exit(0);
}
