'use strict';
/**
 * food-safety-pdf-exporter.js
 * Exports food safety submissions as HTML report (print-to-PDF ready).
 * Uses actual food_safety_submissions schema columns.
 */

const { makeLogger } = require('../logger');
const log = makeLogger('exports');

const DISPLAY_COLS = [
  'id', 'submission_id', 'store_id', 'sender_name', 'shift',
  'form_date', 'status', 'ocr_confidence', 'created_at',
];

async function exportPdf({ dateFrom, dateTo, store } = {}) {
  const db = (() => { try { return require('../storage/sqlite'); } catch (_) { return null; } })();
  if (!db) throw new Error('Database unavailable');

  const conditions = [];
  const params = [];
  if (store)    { conditions.push('store_id = ?');        params.push(store); }
  if (dateFrom) { conditions.push('created_at >= ?');     params.push(dateFrom); }
  if (dateTo)   { conditions.push('created_at <= ?');     params.push(dateTo); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = await db.all(
    `SELECT ${DISPLAY_COLS.join(', ')} FROM food_safety_submissions ${where} ORDER BY created_at DESC LIMIT 5000`,
    params
  );

  const date = new Date().toISOString().slice(0, 10);
  const title = `Food Safety Report — ${store || 'All Stores'} — ${date}`;
  const filename = `food-safety-${store || 'all'}-${date}.html`;

  const tableRows = rows.map(r => `
    <tr>
      ${DISPLAY_COLS.map(c => `<td>${r[c] ?? ''}</td>`).join('')}
    </tr>`).join('\n');

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${title}</title>
<style>body{font-family:Arial,sans-serif;font-size:11px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:3px 5px}th{background:#222;color:#fff}tr:nth-child(even){background:#f5f5f5}</style>
</head><body>
<h2>${title}</h2><p>Generated: ${new Date().toISOString()} | Total: ${rows.length} records</p>
<table><thead><tr>${DISPLAY_COLS.map(c => `<th>${c}</th>`).join('')}</tr></thead>
<tbody>${tableRows}</tbody></table>
</body></html>`;

  log.info('HTML/PDF export', { rows: rows.length, filename });
  return { html, filename, rowCount: rows.length, format: 'html' };
}

module.exports = { exportPdf };
