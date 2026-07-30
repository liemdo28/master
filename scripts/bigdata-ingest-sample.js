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

let failures = 0;

async function ingestSample(connectorDir, sourceName) {
  const samplePath = path.join(CONN, connectorDir, 'sample-data.json');
  if (!fs.existsSync(samplePath)) { console.log(`  skip — no sample-data.json: ${connectorDir}`); return; }
  const payload = JSON.parse(fs.readFileSync(samplePath, 'utf-8'));
  enrichRuntimeSample(payload, connectorDir);
  if (payload.note) { console.log(`  skip — info-only sample: ${connectorDir}`); return; }
  const runId = new Date().toISOString().replace(/[^0-9T]/g, '').slice(0, 15);
  const result = await post(`${BASE}/ingest/json`, { source_name: sourceName, payload, filename: `sample_${connectorDir}_${runId}.json` });
  if (result.ok) {
    console.log(`  ✅ ${sourceName}: raw_object_id=${result.raw_object_id}, events=${result.events_created}, chunks=${result.chunks_indexed}`);
  } else {
    failures += 1;
    console.log(`  ❌ ${sourceName}: ${result.error}`);
  }
}

function isoDaysAgo(daysAgo, hour = 12) {
  const d = new Date();
  d.setUTCHours(hour, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString();
}

function enrichRuntimeSample(payload, connectorDir) {
  if (connectorDir === 'quickbooks') {
    payload.transactions = [];
    for (let i = 6; i >= 0; i--) {
      const day = isoDaysAgo(i, 12);
      payload.transactions.push({
        id: `qb-runtime-${day.slice(0, 10)}`,
        type: 'sale',
        date: day,
        amount: 125 + i,
        description: `Daily QB activity log ${day.slice(0, 10)}`,
        customer: 'Daily Close',
        status: 'completed',
      });
    }
  }

  if (connectorDir === 'dashboard') {
    payload.store = 'Stone Oak';
    payload.tasks = Array.isArray(payload.tasks) ? payload.tasks : [];
    payload.tasks.push({
      id: `stone-oak-issue-${Date.now()}`,
      title: 'Stone Oak issue - prep checklist overdue',
      assignee: 'Maria',
      status: 'overdue',
      due_date: isoDaysAgo(1, 17),
      updated_at: isoDaysAgo(0, 9),
    });
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
  if (failures > 0) {
    console.error(`Failed sample ingests: ${failures}`);
    process.exitCode = 1;
  }
}

main().catch(e => { console.error(e); process.exitCode = 1; });
