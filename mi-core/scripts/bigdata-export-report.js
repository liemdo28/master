#!/usr/bin/env node
/**
 * bigdata-export-report.js — export events to a markdown/JSON report.
 * Usage: node scripts/bigdata-export-report.js --store bakudan --days 7
 */

const BASE = process.env.BIGDATA_API || 'http://localhost:4001/api/bigdata';
const fs   = require('fs');
const path = require('path');
const args = process.argv.slice(2);
const opts = { store: 'bakudan', days: '7', format: 'md' };
for (let i = 0; i < args.length; i += 2) opts[args[i].replace('--','')] = args[i+1];

async function main() {
  const dateFrom = new Date(Date.now() - parseInt(opts.days) * 86400000).toISOString();
  const url = `${BASE}/events?store_id=${opts.store}&date_from=${dateFrom}&limit=200`;
  const res = await fetch(url);
  const { events } = await res.json();

  const outPath = path.join(__dirname, `../reports/bigdata_export_${opts.store}_${new Date().toISOString().slice(0,10)}.md`);
  const lines = [
    `# Big Data Export — ${opts.store} (last ${opts.days} days)`,
    `**Generated:** ${new Date().toISOString()}`,
    `**Events:** ${events.length}`,
    '',
    '| Time | Type | Title | Status | Amount |',
    '|---|---|---|---|---|',
  ];
  for (const e of events) {
    lines.push(`| ${e.event_time?.slice(0,16) || ''} | ${e.event_type} | ${e.title || ''} | ${e.status || ''} | ${e.amount != null ? `$${e.amount}` : ''} |`);
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, lines.join('\n'), 'utf-8');
  console.log(`✅ Exported ${events.length} events to: ${outPath}`);
}

main().catch(e => { console.error(e); process.exit(1); });
