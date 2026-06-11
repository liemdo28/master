#!/usr/bin/env node
/**
 * bigdata-run-quality-checks.js
 * Usage: node scripts/bigdata-run-quality-checks.js
 */

const BASE    = process.env.BIGDATA_API || 'http://localhost:4001/api/bigdata';
const fs      = require('fs');
const path    = require('path');
const OUTPUT  = path.join(__dirname, '../reports/BIG_DATA_QUALITY_REPORT.md');

async function main() {
  console.log('Mi Big Data — Quality Checks\n' + '='.repeat(40));
  const res = await fetch(`${BASE}/quality/run`, { method: 'POST' });
  const data = await res.json();

  if (!data.ok) { console.error('Failed:', data.error); process.exit(1); }

  const { summary, results } = data;
  console.log(`\nSummary: ✅ ${summary.pass} pass | ⚠️ ${summary.warn} warn | ❌ ${summary.fail} fail | 💥 ${summary.error} error\n`);

  const lines = [
    '# Mi Big Data Quality Report',
    `**Generated:** ${new Date().toISOString()}`,
    '',
    `## Summary`,
    `| Status | Count |`,
    `|---|---|`,
    `| ✅ Pass   | ${summary.pass} |`,
    `| ⚠️ Warn   | ${summary.warn} |`,
    `| ❌ Fail   | ${summary.fail} |`,
    `| 💥 Error  | ${summary.error} |`,
    '',
    '## Results',
    '',
  ];

  for (const r of results) {
    const icon = { pass:'✅', warn:'⚠️', fail:'❌', error:'💥' }[r.status] || '?';
    lines.push(`### ${icon} ${r.check_name} (${r.severity})`);
    lines.push(`**Status:** ${r.status}`);
    lines.push('```json');
    lines.push(JSON.stringify(r.result, null, 2));
    lines.push('```');
    lines.push('');

    const icon2 = r.status === 'pass' ? '✅' : r.status === 'warn' ? '⚠️' : '❌';
    console.log(`${icon2} ${r.check_name}: ${r.status}`);
  }

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, lines.join('\n'), 'utf-8');
  console.log(`\nReport saved: ${OUTPUT}`);
  if ((summary.fail || 0) > 0 || (summary.error || 0) > 0) {
    process.exitCode = 1;
  }
}

main().catch(e => { console.error(e); process.exitCode = 1; });
