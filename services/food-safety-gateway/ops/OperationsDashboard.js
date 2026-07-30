// Operations Dashboard — combines sessions, records, alerts, queue, and pilot metrics.
//
// Provides API handlers and HTML rendering for the full CEO operations view:
//   - Active WhatsApp Sessions
//   - Record audit trail
//   - Manager review queue
//   - Alert feed
//   - Pilot metrics

import { createRequire } from 'node:module';

/**
 * Render active sessions data for the dashboard.
 *
 * @param {import('../session/SessionStore.js').SessionStore} sessions
 * @returns {{ headers: string[], rows: Array<Array<string>> }}
 */
export function buildSessionsTable(sessions) {
  const headers = ['Chat ID', 'Store', 'State', 'Employee', 'Last Activity', 'Expires', 'Step'];
  const rows = [];

  // SessionStore doesn't expose an iterator by default; we need all sessions.
  // Access internal _sessions for dashboard purposes.
  const map = sessions._sessions;
  for (const [chatId, session] of map) {
    const maskedId = maskChatId(chatId);
    const storeName = session.store?.name || '—';
    const state = session.state;
    const employee = session.record?.employee_name || '—';
    const lastActivity = formatTime(session.lastActivityAt);
    const expiresAt = computeExpiry(session);
    const step = stateToStep(session.state);

    rows.push([maskedId, storeName, state, employee, lastActivity, expiresAt, step]);
  }

  return { headers, rows };
}

/**
 * Build the full operations dashboard data object.
 */
export function buildOperationsData({ sessions, records, alerts, queue, pilotReport }) {
  const sessionsTable = buildSessionsTable(sessions);

  const recordList = records.list().slice(0, 50); // last 50 records
  const alertList = alerts ? alerts.list().slice(0, 20) : [];
  const queueSummary = queue ? queue.summary() : {};
  const pendingQueue = queue ? queue.pending().slice(0, 20) : [];
  const report = pilotReport ? pilotReport.generate() : null;

  return {
    sessions: sessionsTable,
    records: recordList,
    alerts: alertList,
    queue: { summary: queueSummary, pending: pendingQueue },
    pilot: report,
  };
}

/**
 * Render full operations dashboard as HTML.
 */
export function renderOperationsHtml(data) {
  const { sessions, records, alerts, queue, pilot } = data;

  const sessionsHtml = renderTable('Active WhatsApp Sessions', sessions.headers, sessions.rows);

  const alertRows = alerts.map((a) => [
    a.type, a.severity, a.store || '—', a.message, a.resolved ? '✅' : '⚠️', formatTime(new Date(a.created_at).getTime()),
  ]);
  const alertsHtml = renderTable('Manager Alerts', ['Type', 'Severity', 'Store', 'Message', 'Resolved', 'Time'], alertRows);

  const queueRows = queue.pending.map((q) => [
    q.store, q.employee || '—', q.status, q.reason, formatTime(new Date(q.created_at).getTime()),
  ]);
  const queueHtml = renderTable('Pending Review Queue', ['Store', 'Employee', 'Status', 'Reason', 'Created'], queueRows);

  let pilotHtml = '';
  if (pilot) {
    const pilotRows = Object.entries(pilot.stores).map(([store, m]) => [
      store,
      String(m.submission_count),
      `${m.completion_rate}%`,
      `${m.ocr_accuracy}%`,
      `${m.sync_success}%`,
      String(m.alerts),
      String(m.pending_review),
      String(m.failed_submissions),
    ]);
    pilotHtml = renderTable('Pilot Metrics', ['Store', 'Submissions', 'Completion', 'OCR Accuracy', 'Sync', 'Alerts', 'Pending', 'Failed'], pilotRows);
  }

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Food Safety Operations Dashboard</title>
  <style>
    :root { color-scheme: light dark; }
    body { font-family: system-ui, -apple-system, sans-serif; margin: 0; padding: 1.5rem; background: #fafafa; }
    h1 { font-size: 1.4rem; margin: 0 0 1rem; }
    h2 { font-size: 1.1rem; margin: 2rem 0 0.5rem; color: #333; border-bottom: 2px solid #ddd; padding-bottom: 4px; }
    .meta { color: #666; font-size: .85rem; margin-bottom: 1rem; }
    table { width: 100%; border-collapse: collapse; font-size: .85rem; margin-bottom: 1rem; }
    th, td { text-align: left; padding: .5rem .6rem; border-bottom: 1px solid #ddd; }
    th { background: rgba(127,127,127,.1); position: sticky; top: 0; font-weight: 600; }
    .empty { text-align: center; color: #888; padding: 1.5rem; }
    .badge { display: inline-block; padding: 2px 6px; border-radius: 3px; font-size: .75rem; font-weight: 600; }
    .badge-critical { background: #fee; color: #c00; }
    .badge-warning { background: #fff3e0; color: #e65100; }
    @media (max-width: 640px) { th, td { padding: .4rem; font-size: .78rem; } }
  </style>
</head>
<body>
  <h1>🍜 Bakudan Food Safety — Operations Dashboard</h1>
  <div class="meta">Generated: ${new Date().toISOString()}</div>
  ${sessionsHtml}
  ${pilotHtml}
  ${alertsHtml}
  ${queueHtml}
</body>
</html>`;
}

function renderTable(title, headers, rows) {
  const thead = headers.map((h) => `<th>${esc(h)}</th>`).join('');
  const tbody = rows.length > 0
    ? rows.map((cells) => `<tr>${cells.map((c) => `<td>${esc(String(c ?? '—'))}</td>`).join('')}</tr>`).join('')
    : `<tr><td colspan="${headers.length}" class="empty">No data.</td></tr>`;
  return `<h2>${esc(title)}</h2><table><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table>`;
}

function esc(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function maskChatId(chatId) {
  if (!chatId || chatId.length < 8) return '***';
  return chatId.slice(0, 4) + '****' + chatId.slice(-4);
}

function formatTime(ts) {
  if (!ts) return '—';
  try {
    return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
}

function computeExpiry(session) {
  const TIMEOUTS = {
    WAITING_FOR_STORE_SELECTION: 15 * 60 * 1000,
    WAITING_FOR_FORM_PHOTO: 30 * 60 * 1000,
  };
  const timeout = TIMEOUTS[session.state];
  if (!timeout) return '—';
  const expiresAt = session.lastActivityAt + timeout;
  return formatTime(expiresAt);
}

function stateToStep(state) {
  const map = {
    IDLE: '—',
    WAITING_FOR_STORE_SELECTION: 'Select store',
    WAITING_FOR_FORM_PHOTO: 'Upload photo',
    OCR_PROCESSING: 'Processing OCR',
    OCR_REVIEW: 'Review OCR',
    COMPLETED: 'Done',
    FAILED: 'Failed',
  };
  return map[state] || state;
}

/**
 * Create an Express app for the operations dashboard.
 */
export function createOperationsApp(deps) {
  const require = createRequire(import.meta.url);
  const express = require('express');
  const app = express();

  const { sessions, records, alerts, queue, pilotReport } = deps;

  // Active sessions API
  app.get('/api/sessions', (_req, res) => {
    const table = buildSessionsTable(sessions);
    res.json(table);
  });

  // Alerts API
  app.get('/api/alerts', (_req, res) => {
    res.json({ alerts: alerts ? alerts.list() : [] });
  });

  // Queue API
  app.get('/api/queue', (_req, res) => {
    res.json({
      summary: queue ? queue.summary() : {},
      pending: queue ? queue.pending() : [],
    });
  });

  // Pilot report API
  app.get('/api/pilot-report', (_req, res) => {
    const report = pilotReport ? pilotReport.generate() : null;
    res.json(report);
  });

  // Full operations dashboard
  app.get('/', (_req, res) => {
    const data = buildOperationsData(deps);
    res.type('html').send(renderOperationsHtml(data));
  });

  return app;
}
