#!/usr/bin/env node
/**
 * bigdata-ingest-sample.js — ingest sample data for all connectors.
 * Usage: node scripts/bigdata-ingest-sample.js
 */

const BASE  = process.env.BIGDATA_API || 'http://localhost:4001/api/bigdata';
const fs    = require('fs');
const path  = require('path');
const CONN  = path.join(__dirname, '../server/src/bigdata/connectors');

async function post(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function ingestSample(connectorDir, sourceName) {
  const samplePath = path.join(CONN, connectorDir, 'sample-data.json');
  if (!fs.existsSync(samplePath)) { console.log(`  skip — no sample-data.json: ${connectorDir}`); return; }
  const payload = JSON.parse(fs.readFileSync(samplePath, 'utf-8'));
  if (payload.note) { console.log(`  skip — info-only sample: ${connectorDir}`); return; }
  const result = await post(`${BASE}/ingest/json`, { source_name: sourceName, payload, filename: `sample_${connectorDir}.json` });
  if (result.ok) {
    console.log(`  ✅ ${sourceName}: raw_object_id=${result.raw_object_id}, events=${result.events_created}, chunks=${result.chunks_indexed}`);
  } else {
    console.log(`  ❌ ${sourceName}: ${result.error}`);
  }
}

async function main() {
  console.log('Mi Big Data — Sample Ingest\n' + '='.repeat(40));
  const samples = [
    ['dashboard',         'dashboard-bakudan'],
    ['quickbooks',        'quickbooks-bakudan'],
    ['review-automation', 'review-automation'],
    ['browser-evidence',  'browser-evidence'],
  ];
  for (const [dir, name] of samples) {
    process.stdout.write(`Ingesting ${name}... `);
    await ingestSample(dir, name).catch(e => console.log(`  ERROR: ${e.message}`));
  }
  console.log('\nDone.');
}

main();
