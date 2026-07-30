'use strict';
/**
 * agent-os-tests.js
 * Unit tests for Phase 1–2 Agent-OS tooling layer.
 */

let pass = 0, fail = 0;
function test(name, fn) {
  try {
    const result = fn();
    if (result && typeof result.then === 'function') {
      result.then(() => { console.log(`  ✅ ${name}`); pass++; }).catch(err => { console.error(`  ❌ ${name}: ${err.message}`); fail++; });
      return result;
    }
    console.log(`  ✅ ${name}`); pass++;
  } catch (err) { console.error(`  ❌ ${name}: ${err.message}`); fail++; }
}
async function run() {
  console.log('\n=== Agent-OS Tests ===\n');

  // Browser tool
  test('T01: browser-tool exports isAvailable', () => {
    const bt = require('../src/agent-tools/browser/browser-tool');
    if (typeof bt.isAvailable !== 'function') throw new Error('isAvailable missing');
  });
  test('T02: browser-tool exports newPage', () => {
    const bt = require('../src/agent-tools/browser/browser-tool');
    if (typeof bt.newPage !== 'function') throw new Error('newPage missing');
  });
  test('T03: whatsapp-web-tool exports checkWhatsAppSession', () => {
    const wt = require('../src/agent-tools/browser/whatsapp-web-tool');
    if (typeof wt.checkWhatsAppSession !== 'function') throw new Error('missing');
  });
  test('T04: google-sheet-tool exports verifyGoogleSheetRow', () => {
    const gs = require('../src/agent-tools/browser/google-sheet-tool');
    if (typeof gs.verifyGoogleSheetRow !== 'function') throw new Error('missing');
  });
  test('T05: dashboard-smoke-tool exports runSmokeSuite', () => {
    const ds = require('../src/agent-tools/browser/dashboard-smoke-tool');
    if (typeof ds.runSmokeSuite !== 'function') throw new Error('missing');
  });

  // Memory layer
  test('T06: qdrant-client exports isConfigured', () => {
    const q = require('../src/agent-tools/memory/qdrant-client');
    if (typeof q.isConfigured !== 'function') throw new Error('missing');
    q.isConfigured(); // no throw
  });
  test('T07: qdrant-client isConfigured returns false without QDRANT_URL', () => {
    delete process.env.QDRANT_URL;
    const q = require('../src/agent-tools/memory/qdrant-client');
    if (q.isConfigured()) throw new Error('should be false without QDRANT_URL');
  });
  test('T08: sqlite-search-fallback exports indexRecord and search', () => {
    const s = require('../src/agent-tools/memory/sqlite-search-fallback');
    if (typeof s.indexRecord !== 'function') throw new Error('indexRecord missing');
    if (typeof s.search !== 'function') throw new Error('search missing');
  });
  test('T09: vector-store exports indexRecord, search, getStatus', () => {
    const vs = require('../src/agent-tools/memory/vector-store');
    ['indexRecord', 'search', 'getStatus'].forEach(fn => {
      if (typeof vs[fn] !== 'function') throw new Error(`${fn} missing`);
    });
  });
  test('T10: food-safety-memory-indexer exports all functions', () => {
    const m = require('../src/agent-tools/memory/food-safety-memory-indexer');
    ['indexSubmission', 'indexBatch', 'reindexAll', 'searchSubmissions', 'getMemoryStatus', 'normalizeSubmission'].forEach(fn => {
      if (typeof m[fn] !== 'function') throw new Error(`${fn} missing`);
    });
  });
  test('T11: normalizeSubmission maps fields correctly', () => {
    const { normalizeSubmission } = require('../src/agent-tools/memory/food-safety-memory-indexer');
    const r = normalizeSubmission({ id: 99, store_id: 'stone_oak', employee: 'John', value: 38, status: 'PASS' });
    if (r.record_id !== '99') throw new Error(`record_id=${r.record_id}`);
    if (r.store !== 'stone_oak') throw new Error(`store=${r.store}`);
  });
  test('T12: vector-store getStatus returns activeBackend field', async () => {
    const vs = require('../src/agent-tools/memory/vector-store');
    const s = await vs.getStatus();
    if (!s.activeBackend) throw new Error('activeBackend missing');
  });

  await new Promise(r => setTimeout(r, 500));
  console.log(`\nAgent-OS: ${pass} passed, ${fail} failed\n`);
  if (fail > 0) process.exitCode = 1;
}
run().catch(err => { console.error(err); process.exit(1); });
