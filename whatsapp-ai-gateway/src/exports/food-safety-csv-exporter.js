'use strict';
/**
 * food-safety-csv-exporter.js
 * Exports food safety submissions as CSV.
 */

const { makeLogger } = require('../logger');
const log = makeLogger('exports');

const CSV_HEADERS = ['id', 'store_id', 'employee', 'shift', 'submitted_at', 'status', 'field_id', 'item_name', 'value', 'notes'];

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
  if (store)    { conditions.push('store_id = ?');       params.push(store); }
  if (dateFrom) { conditions.push('submitted_at >= ?');  params.push(dateFrom); }
  if (dateTo)   { conditions.push('submitted_at <= ?');  params.push(dateTo); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = await db.all(`SELECT * FROM food_safety_submissions ${where} ORDER BY submitted_at DESC LIMIT 10000`, params);

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
