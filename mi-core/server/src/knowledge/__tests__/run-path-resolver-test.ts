/**
 * Standalone test runner for reference-brain-path.ts
 * Run: npx tsx server/src/knowledge/__tests__/run-path-resolver-test.ts
 */
import {
  getMiCoreRoot,
  getWorkspaceRoot,
  getReferenceBrainRoot,
  getUSComplianceDBPath,
  getUSComplianceManifestPath,
  getUSComplianceCatalogPath,
  checkUSComplianceDBHealth,
} from '../reference-brain-path';
import path from 'path';

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string) {
  if (condition) {
    console.log(`  PASS: ${name}`);
    passed++;
  } else {
    console.error(`  FAIL: ${name}`);
    failed++;
  }
}

console.log('=== Reference Brain Path Resolver Tests ===\n');

// Test 1
const root = getMiCoreRoot();
assert(root.toLowerCase().includes('mi-core'), 'getMiCoreRoot contains mi-core');

// Test 2
const ws = getWorkspaceRoot();
assert(!!ws, 'getWorkspaceRoot returns value');
assert(path.resolve(ws) === path.resolve(root, '..'), 'workspace is parent of mi-core');

// Test 3
const rb = getReferenceBrainRoot();
assert(rb !== null, 'getReferenceBrainRoot not null');
assert(rb!.toLowerCase().includes('reference-brain'), 'contains reference-brain');

// Test 4
const p = getUSComplianceDBPath();
assert(p !== null, 'getUSComplianceDBPath not null');
assert(p!.toLowerCase().includes('mi-core'), 'resolved to mi-core');
assert(p!.toLowerCase().includes('us-business-compliance'), 'includes us-business-compliance');
assert(!p!.replace(/\\/g, '/').match(/\/Master\/.local-agent-global\//), 'NOT wrong parent path');

// Test 5
const m = getUSComplianceManifestPath();
assert(m !== null, 'manifest path not null');
assert(m!.includes('MI_INTEGRATION_MANIFEST'), 'manifest filename correct');

// Test 6
const c = getUSComplianceCatalogPath();
assert(c !== null, 'catalog path not null');
assert(c!.includes('source_catalog'), 'catalog filename correct');

// Test 7 - Health check
const h = checkUSComplianceDBHealth();
assert(h.exists === true, 'health: exists=true');
assert(h.resolved_path.toLowerCase().includes('mi-core'), 'health: resolved to mi-core');
assert(h.checked_paths.length > 0, 'health: checked_paths populated');
assert(h.raw_size_mb > 500, `health: raw_size_mb=${h.raw_size_mb} > 500`);
assert(h.document_count > 700, `health: docs=${h.document_count} > 700`);
assert(h.chunk_count > 500000, `health: chunks=${h.chunk_count} > 500k`);
assert(h.source_count > 700, `health: sources=${h.source_count} > 700`);
assert(h.jurisdictions.includes('federal'), 'health: has federal');
assert(h.jurisdictions.includes('texas'), 'health: has texas');
assert(h.jurisdictions.includes('california'), 'health: has california');
assert(h.jurisdictions.includes('san-antonio'), 'health: has san-antonio');
assert(h.jurisdictions.includes('stockton'), 'health: has stockton');
assert(h.domains.length > 0, 'health: has domains');
assert(h.catalog_exists === true, 'health: catalog_exists');
assert(h.manifest_exists === true, 'health: manifest_exists');
assert(h.searchable === true, 'health: searchable');
assert(h.errors.length === 0, 'health: no errors');
assert(!!h.last_indexed, 'health: last_indexed set');

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
if (failed === 0) {
  console.log('\nALL TESTS PASSED');
  console.log('resolved_path:', h.resolved_path);
  console.log('raw_size_mb:', h.raw_size_mb);
  console.log('documents:', h.document_count);
  console.log('chunks:', h.chunk_count);
  console.log('jurisdictions:', h.jurisdictions);
} else {
  process.exit(1);
}
