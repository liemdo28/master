/**
 * Dashboard Connector — ingest task/approval/penalty events from dashboard.bakudanramen.com
 */

import { ingestJson } from '../../ingestion-service';
import fs from 'fs';
import path from 'path';

const DASHBOARD_ROOT = process.env.DASHBOARD_ROOT || 'D:/Project/Master/Bakudan/dashboard.bakudanramen.com';
const DASHBOARD_API  = process.env.DASHBOARD_API_URL || 'https://dashboard.bakudanramen.com';
const MI_SNAPSHOT_SECRET = process.env.MI_SNAPSHOT_SECRET || '';
const SOURCE_NAME    = 'dashboard-bakudan';

async function fetchFromApi(): Promise<Record<string, unknown> | null> {
  try {
    const url = `${DASHBOARD_API}/api/mi/snapshot`;
    const headers: Record<string, string> = { 'Accept': 'application/json' };
    if (MI_SNAPSHOT_SECRET) headers['X-Mi-Token'] = MI_SNAPSHOT_SECRET;
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    return await res.json() as Record<string, unknown>;
  } catch {
    return null;
  }
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
