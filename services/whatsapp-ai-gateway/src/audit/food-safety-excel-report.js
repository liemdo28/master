'use strict';
/**
 * food-safety-excel-report.js
 * Exports food safety data as Excel-compatible CSV (UTF-8 BOM for Excel).
 * Full .xlsx requires exceljs — falls back to CSV with BOM.
 */

const { exportCsv } = require('../exports/food-safety-csv-exporter');

async function generateExcel(opts = {}) {
  const { csv, filename, rowCount } = await exportCsv(opts);
  const BOM = '﻿';
  const excelFilename = filename.replace('.csv', '-excel.csv');
  return { csv: BOM + csv, filename: excelFilename, rowCount, format: 'csv-bom' };
}

module.exports = { generateExcel };
