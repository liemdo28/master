// Dashboard for submitted Food Safety records.
//
// Provides a render function (pure, testable) plus a tiny Express factory so
// the pilot can view submissions in a browser. Columns:
//   store | date | employee | status | OCR confidence | sync status

import { createRequire } from 'node:module';

/**
 * Render the dashboard rows as a plain data table (testable, no DOM).
 * @param {Array<object>} records
 * @returns {{ headers: string[], rows: Array<Array<string>> }}
 */
export function buildTable(records) {
  const headers = ['Store', 'Date', 'Employee', 'Status', 'OCR Confidence', 'Sync Status'];
  const rows = records.map((r) => [
    r.store,
    r.date,
    r.employee_name,
    r.status,
    formatConfidence(r.ocr_confidence),
    r.sync_status,
  ]);
  return { headers, rows };
}

function formatConfidence(value) {
  if (typeof value !== 'number') return '—';
  return `${Math.round(value * 100)}%`;
}

/**
 * Render an HTML page for the dashboard.
 * @param {Array<object>} records
 */
export function renderHtml(records) {
  const { headers, rows } = buildTable(records);
  const thead = headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('');
  const tbody = rows.length
    ? rows
        .map(
          (cells) =>
            `<tr>${cells.map((c) => `<td>${escapeHtml(String(c))}</td>`).join('')}</tr>`,
        )
        .join('')
    : `<tr><td colspan="${headers.length}" class="empty">No records yet.</td></tr>`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Food Safety Submissions</title>
  <style>
    :root { color-scheme: light dark; }
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; margin: 0; padding: 1.5rem; }
    h1 { font-size: 1.25rem; margin: 0 0 1rem; }
    .meta { color: #666; font-size: .85rem; margin-bottom: 1rem; }
    table { width: 100%; border-collapse: collapse; font-size: .9rem; }
    th, td { text-align: left; padding: .6rem .75rem; border-bottom: 1px solid #ddd; }
    th { background: rgba(127,127,127,.12); position: sticky; top: 0; }
    td.empty { text-align: center; color: #888; padding: 2rem; }
    @media (max-width: 640px) {
      th, td { padding: .5rem; font-size: .8rem; }
    }
  </style>
</head>
<body>
  <h1>Bakudan Food Safety Submissions</h1>
  <div class="meta">${records.length} record(s)</div>
  <table>
    <thead><tr>${thead}</tr></thead>
    <tbody>${tbody}</tbody>
  </table>
</body>
</html>`;
}

/**
 * Render records as JSON response data.
 * @param {Array<object>} records
 * @returns {{ headers: string[], rows: Array<Array<string>>, count: number, generatedAt: string }}
 */
export function renderJson(records) {
  const { headers, rows } = buildTable(records);
  return { headers, rows, count: records.length, generatedAt: new Date().toISOString() };
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Create an Express app that serves the dashboard.
 * @param {object} deps
 * @param {import('../db/RecordStore.js').RecordStore} deps.records
 * @returns {import('express').Express}
 */
export function createDashboardApp({ records }) {
  // Lazy require (via createRequire) keeps this ESM module testable without
  // pulling in express during unit tests that only use the render helpers.
  const require = createRequire(import.meta.url);
  const express = require('express');
  const app = express();

  app.get('/api/records', (_req, res) => {
    res.json({ records: records.list() });
  });

  app.get('/', (_req, res) => {
    res.type('html').send(renderHtml(records.list()));
  });

  return app;
}
