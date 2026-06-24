'use strict';
/**
 * stone-oak-pilot-tests.js
 * Verifies the Stone Oak pilot infrastructure before deployment.
 */

require('dotenv').config();
let pass = 0, fail = 0;
async function test(name, fn) {
  try {
    await fn();
    console.log(`  PASS: ${name}`); pass++;
  } catch (err) { console.error(`  FAIL: ${name}: ${err.message}`); fail++; }
}

async function run() {
  console.log('\n=== Stone Oak Pilot Infrastructure Tests ===\n');

  await test('v3 OCR template loads', () => {
    const t = require('../data/templates/FoodSafety-StoneOak-v3.json');
    if (t.version !== '3.0') throw new Error(`version=${t.version}`);
    if (!t.pilot) throw new Error('pilot flag missing');
    const fields = Object.keys(t.field_map);
    if (fields.length !== 19) throw new Error(`expected 19 fields, got ${fields.length}`);
  });

  await test('v3 template has 19 ocr_zones pairs (38 zones)', () => {
    const t = require('../data/templates/FoodSafety-StoneOak-v3.json');
    if (t.ocr_zones.length !== 38) throw new Error(`expected 38 zones, got ${t.ocr_zones.length}`);
  });

  await test('v3 required fields are correct (10 fields)', () => {
    const t = require('../data/templates/FoodSafety-StoneOak-v3.json');
    if (t.required_fields.length !== 10) throw new Error(`expected 10 required, got ${t.required_fields.length}`);
    const required = Object.entries(t.field_map).filter(([,v]) => v.required).map(([k]) => k);
    if (required.length !== 10) throw new Error(`field_map required mismatch: ${required.length}`);
  });

  await test('Pork/Chicken Chashu are cold hold (<=40F)', () => {
    const t = require('../data/templates/FoodSafety-StoneOak-v3.json');
    const pork    = t.field_map['SO-09'];
    const chicken = t.field_map['SO-10'];
    if (pork.operator !== '<=' || pork.target !== 40)    throw new Error(`Pork Chashu: ${JSON.stringify(pork)}`);
    if (chicken.operator !== '<=' || chicken.target !== 40) throw new Error(`Chicken Chashu: ${JSON.stringify(chicken)}`);
  });

  await test('Bowl Warmers is hot hold (>=100F)', () => {
    const t = require('../data/templates/FoodSafety-StoneOak-v3.json');
    const bw = t.field_map['SO-16'];
    if (bw.operator !== '>=' || bw.target !== 100) throw new Error(`Bowl Warmers: ${JSON.stringify(bw)}`);
  });

  await test('pilot-tracker exports all required functions', () => {
    const pt = require('../src/pilot/stone-oak-pilot-tracker');
    ['start','stop','getReport','ingestNew','markEdit','markRetake','markManagerReview','markSynced','markDashboard','setAccuracy'].forEach(fn => {
      if (typeof pt[fn] !== 'function') throw new Error(`${fn} missing`);
    });
  });

  await test('pilot-api is an express Router', () => {
    const api = require('../src/pilot/stone-oak-pilot-api');
    if (typeof api !== 'function') throw new Error('not a router');
  });

  await test('ensurePilotTable creates pilot_stone_oak table', async () => {
    const pt = require('../src/pilot/stone-oak-pilot-tracker');
    await pt.ensurePilotTable();
  });

  await test('getReport returns correct structure', async () => {
    const pt = require('../src/pilot/stone-oak-pilot-tracker');
    const r = await pt.getReport();
    if (!r.ok) throw new Error(`ok=false: ${r.error}`);
    if (r.store !== 'stone_oak') throw new Error(`store=${r.store}`);
    if (r.target !== 10) throw new Error(`target=${r.target}`);
    if (typeof r.collected !== 'number') throw new Error('collected missing');
    if (!r.progress) throw new Error('progress missing');
  });

  await test('ingestNew runs without error', async () => {
    const pt = require('../src/pilot/stone-oak-pilot-tracker');
    const n = await pt.ingestNew();
    if (typeof n !== 'number') throw new Error('expected number');
  });

  await test('v3 PDF file exists', () => {
    const fs = require('fs');
    const p  = require('path').join(__dirname, '../docs/forms/FoodSafety-StoneOak-LineCheck-v3.pdf');
    if (!fs.existsSync(p)) throw new Error(`PDF not found: ${p}`);
    const size = fs.statSync(p).size;
    if (size < 3500) throw new Error(`PDF too small: ${size} bytes (expected >3500 for reportlab vector PDF)`);
  });

  await test('success criteria keys are all present in report', async () => {
    const pt = require('../src/pilot/stone-oak-pilot-tracker');
    const r  = await pt.getReport();
    if (!r.success_criteria) throw new Error('success_criteria missing');
    const keys = ['field_accuracy_95pct','edit_rate_under_5pct','no_data_loss','no_wrong_store','no_missing_from_dash'];
    keys.forEach(k => {
      if (!(k in r.success_criteria)) throw new Error(`criteria key missing: ${k}`);
    });
  });

  console.log(`\nStone Oak Pilot: ${pass} passed, ${fail} failed\n`);
  if (fail > 0) process.exitCode = 1;
}
run().catch(err => { console.error(err); process.exit(1); });
