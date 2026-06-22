'use strict';
/**
 * food-safety-pdf-report.js
 * Thin wrapper — delegates to food-safety-pdf-exporter.
 */
const { exportPdf } = require('../exports/food-safety-pdf-exporter');

async function generateReport(opts = {}) {
  return exportPdf(opts);
}

module.exports = { generateReport };
