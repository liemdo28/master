/**
 * Platform Health Checker
 * Reports REAL connector status — never fakes data.
 * For unconnected platforms: clear setup instructions.
 */

import fs from 'fs';
import path from 'path';
import http from 'http';

const GLOBAL_DIR = process.env.GLOBAL_DIR || 'D:/Project/Master/.local-agent-global';

export interface PlatformStatus {
  id: string;
  name: string;
  status: 'connected' | 'not_configured' | 'error' | 'partial';
  last_sync?: string;
  data_available: boolean;
  setup_instructions?: string;
  error?: string;
}

export interface PlatformHealthReport {
  generated_at: string;
  connected: PlatformStatus[];
  not_configured: PlatformStatus[];
  errors: PlatformStatus[];
  summary: string;
  setup_needed: string[];
}

// ── Check if a cache file exists and is fresh ─────────────────────────────
function cacheStatus(relPath: string, maxAgeMin = 60): { exists: boolean; age_min?: number; fresh: boolean } {
  const fullPath = path.join(GLOBAL_DIR, 'visibility', relPath);
  if (!fs.existsSync(fullPath)) return { exists: false, fresh: false };
  const stat = fs.statSync(fullPath);
  const age_min = Math.floor((Date.now() - stat.mtimeMs) / 60000);
  return { exists: true, age_min, fresh: age_min < maxAgeMin };
}

function readCache<T>(relPath: string): T | null {
  const fullPath = path.join(GLOBAL_DIR, 'visibility', relPath);
  try { return JSON.parse(fs.readFileSync(fullPath, 'utf-8')); }
  catch { return null; }
}

// ── Check URL reachable ────────────────────────────────────────────────────
function checkUrl(url: string): Promise<boolean> {
  return new Promise(resolve => {
    try {
      const req = http.get(url, res => { resolve(res.statusCode! < 500); req.destroy(); });
      req.setTimeout(2000, () => { req.destroy(); resolve(false); });
      req.on('error', () => resolve(false));
    } catch { resolve(false); }
  });
}

// ── Individual platform checks ────────────────────────────────────────────

function checkGmail(): PlatformStatus {
  const tokenPath = path.join(GLOBAL_DIR, 'visibility', 'google-tokens.json');
  const cacheFile = cacheStatus('gmail/inbox_cache.json', 30);

  if (!fs.existsSync(tokenPath)) {
    return {
      id: 'gmail', name: 'Gmail', status: 'not_configured', data_available: false,
      setup_instructions: 'Go to http://localhost:4001/api/auth/google/start → connect Google account → Gmail will sync automatically',
    };
  }
  if (cacheFile.exists) {
    return { id: 'gmail', name: 'Gmail', status: 'connected', data_available: true, last_sync: `${cacheFile.age_min}min ago` };
  }
  return { id: 'gmail', name: 'Gmail', status: 'partial', data_available: false, error: 'Token exists but no cache — run sync' };
}

function checkGoogleCalendar(): PlatformStatus {
  const tokenPath = path.join(GLOBAL_DIR, 'visibility', 'google-tokens.json');
  const cacheFile = cacheStatus('google-calendar/events_cache.json', 30);

  if (!fs.existsSync(tokenPath)) {
    return {
      id: 'google-calendar', name: 'Google Calendar', status: 'not_configured', data_available: false,
      setup_instructions: 'Same as Gmail — connect Google account at /api/auth/google/start',
    };
  }
  if (cacheFile.exists) {
    return { id: 'google-calendar', name: 'Google Calendar', status: 'connected', data_available: true, last_sync: `${cacheFile.age_min}min ago` };
  }
  return { id: 'google-calendar', name: 'Google Calendar', status: 'partial', data_available: false };
}

function checkGoogleDrive(): PlatformStatus {
  const tokenPath = path.join(GLOBAL_DIR, 'visibility', 'google-tokens.json');
  const cacheFile = cacheStatus('google-drive/files_cache.json', 120);

  if (!fs.existsSync(tokenPath)) {
    return {
      id: 'google-drive', name: 'Google Drive', status: 'not_configured', data_available: false,
      setup_instructions: 'Same as Gmail — connect Google account at /api/auth/google/start',
    };
  }
  if (cacheFile.exists) {
    return { id: 'google-drive', name: 'Google Drive', status: 'connected', data_available: true, last_sync: `${cacheFile.age_min}min ago` };
  }
  return { id: 'google-drive', name: 'Google Drive', status: 'partial', data_available: false };
}

function checkAsana(): PlatformStatus {
  const hasToken = !!process.env.ASANA_TOKEN;
  const cacheFile = cacheStatus('asana/tasks_cache.json', 30);

  if (!hasToken) {
    return {
      id: 'asana', name: 'Asana', status: 'not_configured', data_available: false,
      setup_instructions: 'Add ASANA_TOKEN to server/.env → get token from asana.com/0/my-apps → restart Mi',
    };
  }
  if (cacheFile.exists) {
    return { id: 'asana', name: 'Asana', status: 'connected', data_available: true, last_sync: `${cacheFile.age_min}min ago` };
  }
  return { id: 'asana', name: 'Asana', status: 'partial', data_available: false, error: 'Token set but no cache — will sync shortly' };
}

async function checkDashboard(): Promise<PlatformStatus> {
  const cacheFile = cacheStatus('dashboard/snapshot.json', 30);
  const liveReachable = await checkUrl('http://dashboard.bakudanramen.com');

  if (liveReachable) {
    return { id: 'dashboard', name: 'Dashboard (bakudanramen.com)', status: 'connected', data_available: true, last_sync: 'live' };
  }
  if (cacheFile.exists) {
    return { id: 'dashboard', name: 'Dashboard (bakudanramen.com)', status: 'partial', data_available: true, last_sync: `${cacheFile.age_min}min ago (cached)` };
  }
  return {
    id: 'dashboard', name: 'Dashboard (bakudanramen.com)', status: 'not_configured', data_available: false,
    setup_instructions: 'Dashboard is a PHP app — connector reads via HTTP API. Make sure dashboard.bakudanramen.com is live.',
  };
}

function checkMasterWorkspace(): PlatformStatus {
  const cacheFile = cacheStatus('../mi-core/master-projects.json', 60);
  const masterRoot = process.env.MASTER_ROOT || 'D:/Project/Master';
  const exists = fs.existsSync(masterRoot);

  if (exists) {
    return { id: 'master-workspace', name: 'Master Workspace', status: 'connected', data_available: true, last_sync: cacheFile.exists ? `${cacheFile.age_min}min ago` : 'scanning...' };
  }
  return { id: 'master-workspace', name: 'Master Workspace', status: 'error', data_available: false, error: `MASTER_ROOT not found: ${masterRoot}` };
}

function checkHuaweiHealth(): PlatformStatus {
  const exportDir = path.join(GLOBAL_DIR, 'visibility', 'health', 'export');
  const hasExport = fs.existsSync(exportDir) && fs.readdirSync(exportDir).length > 0;

  if (hasExport) {
    return { id: 'huawei-health', name: 'Huawei Health', status: 'connected', data_available: true };
  }
  return {
    id: 'huawei-health', name: 'Huawei Health', status: 'not_configured', data_available: false,
    setup_instructions: 'Export health data from Huawei Health app → place in .local-agent-global/visibility/health/export/',
  };
}

// ── Main health check ─────────────────────────────────────────────────────
export async function checkAllPlatforms(): Promise<PlatformHealthReport> {
  const platforms: PlatformStatus[] = [
    checkGmail(),
    checkGoogleCalendar(),
    checkGoogleDrive(),
    checkAsana(),
    await checkDashboard(),
    checkMasterWorkspace(),
    checkHuaweiHealth(),
  ];

  const connected     = platforms.filter(p => p.status === 'connected');
  const notConfigured = platforms.filter(p => p.status === 'not_configured' || p.status === 'partial');
  const errors        = platforms.filter(p => p.status === 'error');
  const setupNeeded   = notConfigured.map(p => p.name);

  const summary = [
    `${connected.length}/${platforms.length} platforms connected`,
    connected.length > 0 ? `✓ ${connected.map(p => p.name).join(', ')}` : '',
    setupNeeded.length > 0 ? `○ Not configured: ${setupNeeded.join(', ')}` : '',
    errors.length > 0 ? `✗ Errors: ${errors.map(p => p.name).join(', ')}` : '',
  ].filter(Boolean).join('\n');

  return {
    generated_at: new Date().toISOString(),
    connected, not_configured: notConfigured, errors, summary, setup_needed: setupNeeded,
  };
}

// ── Format for AI context ─────────────────────────────────────────────────
export async function getPlatformHealthText(): Promise<string> {
  const report = await checkAllPlatforms();
  const lines = ['[Platform Health]', report.summary];

  if (report.not_configured.length > 0) {
    lines.push('\nSetup needed:');
    report.not_configured.forEach(p => {
      lines.push(`  • ${p.name}: ${p.setup_instructions || 'not configured'}`);
    });
  }

  return lines.join('\n');
}

// ── Cache it for fast access ──────────────────────────────────────────────
export async function cacheHealthReport(): Promise<void> {
  const report = await checkAllPlatforms();
  const outPath = path.join(GLOBAL_DIR, 'visibility', 'platform_health.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
}
