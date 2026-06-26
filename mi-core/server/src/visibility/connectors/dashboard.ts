/**
 * Dashboard Connector — reads bakudanramen.com dashboard local files.
 * Scans PHP source for task structure, reports, user data patterns.
 */

import fs from 'fs';
import path from 'path';

const DASHBOARD_PATH_CANDIDATES = [
  process.env.DASHBOARD_PATH,
  process.env.DASHBOARD_ROOT,
  'D:/Project/Master/Bakudan/dashboard.bakudanramen.com',
  'D:/Project/Master/dashboard.bakudanramen.com',
].filter(Boolean) as string[];
const DASHBOARD_PATH = DASHBOARD_PATH_CANDIDATES.find(p => fs.existsSync(p)) || DASHBOARD_PATH_CANDIDATES[0];
const GLOBAL_DIR = process.env.GLOBAL_DIR || 'D:/Project/Master/.local-agent-global';
const CACHE_DIR = path.join(GLOBAL_DIR, 'visibility', 'dashboard');

export interface DashboardSnapshot {
  path: string;
  modules: string[];
  reports: string[];
  total_php_files: number;
  total_js_files: number;
  has_auth: boolean;
  has_api: boolean;
  has_tasks: boolean;
  readme_summary?: string;
  scanned_at: string;
}

function scanModules(root: string): string[] {
  const modules: string[] = [];
  try {
    for (const e of fs.readdirSync(root, { withFileTypes: true })) {
      if (e.isDirectory() && !e.name.startsWith('.')) modules.push(e.name);
    }
  } catch { /* skip */ }
  return modules;
}

function countFiles(root: string, ext: string): number {
  let count = 0;
  const walk = (dir: string, depth: number) => {
    if (depth > 4) return;
    try {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (e.name === 'node_modules' || e.name === 'vendor') continue;
        const full = path.join(dir, e.name);
        if (e.isFile() && e.name.endsWith(ext)) count++;
        if (e.isDirectory()) walk(full, depth + 1);
      }
    } catch { /* skip */ }
  };
  walk(root, 0);
  return count;
}

function findReports(root: string): string[] {
  const results: string[] = [];
  const walk = (dir: string, depth: number) => {
    if (depth > 3) return;
    try {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (e.name === 'node_modules') continue;
        if (e.isFile() && /report|audit|summary/i.test(e.name)) results.push(path.join(dir, e.name).replace(root, ''));
        if (e.isDirectory()) walk(path.join(dir, e.name), depth + 1);
      }
    } catch { /* skip */ }
  };
  walk(root, 0);
  return results.slice(0, 20);
}

export async function syncDashboard(): Promise<DashboardSnapshot | null> {
  if (!fs.existsSync(DASHBOARD_PATH)) {
    const err = { error: 'Dashboard path not found', path: DASHBOARD_PATH, candidates: DASHBOARD_PATH_CANDIDATES, checked_at: new Date().toISOString() };
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(path.join(CACHE_DIR, 'errors.json'), JSON.stringify([err], null, 2));
    return null;
  }

  const modules = scanModules(DASHBOARD_PATH);
  const reports = findReports(DASHBOARD_PATH);
  const phpCount = countFiles(DASHBOARD_PATH, '.php');
  const jsCount = countFiles(DASHBOARD_PATH, '.js');

  // Detect capabilities
  const allDirs = modules.map(m => m.toLowerCase());
  const hasAuth = allDirs.some(m => /auth|login|session|user/.test(m));
  const hasApi = allDirs.some(m => /api/.test(m)) || fs.existsSync(path.join(DASHBOARD_PATH, 'api'));
  const hasTasks = allDirs.some(m => /task|todo|work/.test(m));

  // Read README if exists
  let readme: string | undefined;
  for (const name of ['README.md', 'readme.md', 'README.txt']) {
    const p = path.join(DASHBOARD_PATH, name);
    if (fs.existsSync(p)) { readme = fs.readFileSync(p, 'utf-8').slice(0, 500); break; }
  }

  const snapshot: DashboardSnapshot = {
    path: DASHBOARD_PATH,
    modules,
    reports,
    total_php_files: phpCount,
    total_js_files: jsCount,
    has_auth: hasAuth,
    has_api: hasApi,
    has_tasks: hasTasks,
    readme_summary: readme,
    scanned_at: new Date().toISOString(),
  };

  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(path.join(CACHE_DIR, 'data.json'), JSON.stringify(snapshot, null, 2));
  fs.writeFileSync(path.join(CACHE_DIR, 'summary.json'), JSON.stringify({
    modules_count: modules.length, reports_count: reports.length, php_files: phpCount,
  }, null, 2));
  fs.writeFileSync(path.join(CACHE_DIR, 'last_sync.json'), JSON.stringify({ synced_at: new Date().toISOString() }));
  fs.writeFileSync(path.join(CACHE_DIR, 'errors.json'), JSON.stringify([]));

  return snapshot;
}

export function getCachedDashboard(): DashboardSnapshot | null {
  try { return JSON.parse(fs.readFileSync(path.join(CACHE_DIR, 'data.json'), 'utf-8')); }
  catch { return null; }
}
