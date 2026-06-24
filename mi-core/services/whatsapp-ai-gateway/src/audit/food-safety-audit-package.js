'use strict';
/**
 * food-safety-audit-package.js
 * Assembles a full audit package for a date range and store.
 * Outputs a directory with CSV, HTML report, and JSON summary.
 */

const path = require('path');
const fs   = require('fs');
const { makeLogger } = require('../logger');
const log = makeLogger('audit');

async function buildAuditPackage({ store, dateFrom, dateTo } = {}) {
  const { exportCsv }  = require('../exports/food-safety-csv-exporter');
  const { exportPdf }  = require('../exports/food-safety-pdf-exporter');

  const date = new Date().toISOString().slice(0, 10);
  const slug = [store || 'all', dateFrom || date, dateTo || date].filter(Boolean).join('_');
  const outDir = path.join(process.cwd(), 'logs', 'audit-packages', slug);
  fs.mkdirSync(outDir, { recursive: true });

  const [csvResult, pdfResult] = await Promise.all([
    exportCsv({ dateFrom, dateTo, store }),
    exportPdf({ dateFrom, dateTo, store }),
  ]);

  const csvPath  = path.join(outDir, csvResult.filename);
  const htmlPath = path.join(outDir, pdfResult.filename);
  fs.writeFileSync(csvPath,  csvResult.csv,  'utf8');
  fs.writeFileSync(htmlPath, pdfResult.html, 'utf8');

  const summary = {
    generatedAt: new Date().toISOString(),
    store: store || 'all',
    dateFrom: dateFrom || null,
    dateTo: dateTo || null,
    csvRows: csvResult.rowCount,
    files: [csvResult.filename, pdfResult.filename],
  };
  const summaryPath = path.join(outDir, 'summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf8');

  log.info('Audit package built', { outDir, ...summary });
  return { ok: true, outDir, summary };
}

module.exports = { buildAuditPackage };
