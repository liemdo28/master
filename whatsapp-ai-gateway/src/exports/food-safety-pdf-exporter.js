'use strict';
/**
 * food-safety-pdf-exporter.js
 * Exports food safety submissions as a PDF report using basic HTML-to-text or plain text.
 * Full PDF generation requires pdfkit/puppeteer — falls back to styled HTML if unavailable.
 */

const { makeLogger } = require('../logger');
const log = makeLogger('exports');

async function exportPdf({ dateFrom, dateTo, store } = {}) {
  const db = (() => { try { return require('../storage/sqlite'); } catch (_) { return null; } })();
  if (!db) throw new Error('Database unavailable');

  const conditions = [];
  const params = [];
  if (store)    { conditions.push('store_id = ?');       params.push(store); }
  if (dateFrom) { conditions.push('submitted_at >= ?');  params.push(dateFrom); }
  if (dateTo)   { conditions.push('submitted_at <= ?');  params.push(dateTo); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = await db.all(`SELECT * FROM food_safety_submissions ${where} ORDER BY submitted_at DESC LIMIT 5000`, params);

  const date = new Date().toISOString().slice(0, 10);
  const title = `Food Safety Report — ${store || 'All Stores'} — ${date}`;
  const filename = `food-safety-${store || 'all'}-${date}.html`;

  const tableRows = rows.map(r => `
    <tr>
      <td>${r.id || ''}</td><td>${r.store_id || ''}</td><td>${r.employee || ''}</td>
      <td>${r.shift || ''}</td><td>${r.submitted_at || ''}</td><td>${r.status || ''}</td>
      <td>${r.item_name || r.field_id || ''}</td><td>${r.value || ''}</td><td>${r.notes || ''}</td>
    </tr>`).join('\n');

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${title}</title>
<style>body{font-family:Arial,sans-serif;font-size:12px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:4px 6px}th{background:#222;color:#fff}tr:nth-child(even){background:#f5f5f5}</style>
</head><body>
<h2>${title}</h2><p>Generated: ${new Date().toISOString()} | Total: ${rows.length} records</p>
<table><thead><tr><th>ID</th><th>Store</th><th>Employee</th><th>Shift</th><th>Date</th><th>Status</th><th>Item</th><th>Value</th><th>Notes</th></tr></thead>
<tbody>${tableRows}</tbody></table>
</body></html>`;

  log.info('PDF (HTML) export', { rows: rows.length, filename });
  return { html, filename, rowCount: rows.length, format: 'html' };
}

module.exports = { exportPdf };
