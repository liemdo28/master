'use strict';
/**
 * pilot-report-builder.js
 * Builds a pilot summary report from pilot-metrics data.
 */

const { makeLogger } = require('../logger');
const log = makeLogger('pilot');

async function buildReport(opts = {}) {
  const pilotMetrics = require('./pilot-metrics');
  const summary = await pilotMetrics.getPilotSummary().catch(() => null);
  if (!summary) return { ok: false, error: 'No pilot metrics available' };

  const lines = [
    `# Food Safety Pilot Report`,
    `Generated: ${new Date().toISOString()}`,
    '',
    `## Overall`,
    `- Stores: ${summary.stores?.length || 0}`,
    `- Duration: ${summary.durationDays || 7} days`,
    `- Completion Rate: ${(summary.completionRate > 1 ? summary.completionRate : (summary.completionRate || 0) * 100).toFixed(1)}%`,
    `- Target: ${(summary.completionTarget > 1 ? summary.completionTarget : (summary.completionTarget || 95)).toFixed(0)}%`,
    `- Status: ${(summary.overallCompletionRate || 0) >= (summary.completionTarget > 1 ? summary.completionTarget : 95) ? '✅ PASS' : '❌ BELOW TARGET (pilot not yet started)'}`,
    '',
    `## By Store`,
  ];

  for (const store of (summary.stores || [])) {
    lines.push(`### ${store.store_id}`);
    lines.push(`- Entries started: ${store.started || 0}`);
    lines.push(`- Entries completed: ${store.completed || 0}`);
    lines.push(`- Warnings: ${store.warnings || 0}`);
    lines.push(`- Missing: ${store.missing || 0}`);
    lines.push('');
  }

  const text = lines.join('\n');
  log.info('Pilot report built');
  return { ok: true, text, summary };
}

module.exports = { buildReport };
