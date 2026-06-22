'use strict';
/**
 * food-safety-csv-exporter.js
 * Exports food safety submissions as CSV.
 * Uses actual food_safety_submissions schema columns.
 */

const { makeLogger } = require('../logger');
const log = makeLogger('exports');

const CSV_HEADERS = [
  'id', 'submission_id', 'store_id', 'store', 'sender_name', 'shift',
  'form_date', 'status', 'ocr_confidence', 'created_at', 'confirmed_at', 'sync_error',
];

function escapeCsvField(val) {
  const s = String(val ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

async function exportCsv({ dateFrom, dateTo, store } = {}) {
  const db = (() => { try { return require('../storage/sqlite'); } catch (_) { return null; } })();
  if (!db) throw new Error('Database unavailable');

  const conditions = [];
  const params = [];
  if (store)    { conditions.push('store_id = ?');         params.push(store); }
  if (dateFrom) { conditions.push('created_at >= ?');      params.push(dateFrom); }
  if (dateTo)   { conditions.push('created_at <= ?');      params.push(dateTo); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = await db.all(
    `SELECT ${CSV_HEADERS.join(', ')} FROM food_safety_submissions ${where} ORDER BY created_at DESC LIMIT 10000`,
    params
  );

  const lines = [CSV_HEADERS.join(',')];
  for (const row of rows) {
    lines.push(CSV_HEADERS.map(h => escapeCsvField(row[h])).join(','));
  }

  const csv = lines.join('\r\n');
  const date = new Date().toISOString().slice(0, 10);
  const filename = `food-safety-${store || 'all'}-${date}.csv`;
  log.info('CSV export', { rows: rows.length, filename });
  return { csv, filename, rowCount: rows.length };
}

module.exports = { exportCsv };
