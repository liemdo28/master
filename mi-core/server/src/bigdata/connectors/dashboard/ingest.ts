/**
 * Dashboard Connector — ingest task/approval/penalty events from dashboard.bakudanramen.com
 */

import { ingestJson } from '../../ingestion-service';
import fs from 'fs';
import path from 'path';
import http from 'http';

const DASHBOARD_ROOT = process.env.DASHBOARD_ROOT || 'E:/Project/Master/Bakudan/dashboard.bakudanramen.com';
const DASHBOARD_API  = process.env.DASHBOARD_API_URL || 'http://localhost:8080';
const SOURCE_NAME    = 'dashboard-bakudan';

async function fetchFromApi(): Promise<Record<string, unknown> | null> {
  return new Promise(resolve => {
    const url = new URL(`${DASHBOARD_API}/api/mi/snapshot`);
    const req = http.get({ hostname: url.hostname, port: parseInt(url.port || '80'), path: url.pathname, timeout: 5000 }, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

function readFromLocalFiles(): Record<string, unknown> {
  const tasks: unknown[] = [];
  const taskFiles = [
    path.join(DASHBOARD_ROOT, 'data', 'tasks.json'),
    path.join(DASHBOARD_ROOT, 'cache', 'tasks.json'),
  ];
  for (const f of taskFiles) {
    if (fs.existsSync(f)) {
      try { tasks.push(...JSON.parse(fs.readFileSync(f, 'utf-8'))); break; }
      catch { continue; }
    }
  }
  return { store: 'bakudan', tasks, approvals: [], penalties: [], notifications: [], source: 'local_files', captured_at: new Date().toISOString() };
}

export async function ingestDashboard(): Promise<void> {
  let payload = await fetchFromApi();
  if (!payload) {
    console.log('[Dashboard Connector] API unavailable, reading local files');
    payload = readFromLocalFiles();
  }
  await ingestJson({ source_name: SOURCE_NAME, payload, filename: `dashboard_${Date.now()}.json`, actor: 'dashboard-connector' });
  console.log('[Dashboard Connector] Ingest complete');
}

// Run directly: node ingest.js
if (require.main === module) {
  ingestDashboard().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
}
