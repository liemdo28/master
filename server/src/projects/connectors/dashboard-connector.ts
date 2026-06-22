/**
 * Dashboard Connector (dashboard.bakudanramen.com)
 * PHP site — reads local files + optional local dev API
 */

import fs from 'fs';
import path from 'path';
import http from 'http';
import { execSync } from 'child_process';

const DASHBOARD_ROOT = process.env.DASHBOARD_ROOT || 'E:/Project/Master/Bakudan/dashboard.bakudanramen.com';
const CACHE_DIR      = path.join(process.env.GLOBAL_DIR || 'E:/Project/Master/.local-agent-global', 'mi-core', 'connectors', 'dashboard');
const DASHBOARD_API  = process.env.DASHBOARD_API_URL || 'http://dashboard.bakudanramen.com';

export interface DashboardTask { id: string; title: string; assignee?: string; status: string; due_date?: string; }
export interface DashboardUser { id: string; name: string; email?: string; role?: string; }
export interface DashboardModule { name: string; file: string; has_api: boolean; }

export interface DashboardSnapshot {
  synced_at:     string;
  status:        'ok' | 'error' | 'not_found' | 'api_down';
  root:          string;
  php_files:     number;
  modules:       DashboardModule[];
  tasks_cached:  DashboardTask[];
  users_cached:  DashboardUser[];
  git_branch:    string;
  git_dirty:     boolean;
  last_commit:   string;
  api_live:      boolean;
  api_url:       string;
  reports_count: number;
  summary_text:  string;
}

function git(cmd: string): string {
  try { return execSync(`git -C "${DASHBOARD_ROOT}" ${cmd}`, { encoding: 'utf-8', timeout: 5000 }).trim(); }
  catch { return ''; }
}

async function checkApiLive(): Promise<boolean> {
  return new Promise(resolve => {
    const url = new URL(DASHBOARD_API);
    const req = http.get({ hostname: url.hostname, port: parseInt(url.port || '80'), path: '/', timeout: 3000 }, () => resolve(true));
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

function scanModules(dir: string): DashboardModule[] {
  const modules: DashboardModule[] = [];
  if (!fs.existsSync(dir)) return modules;

  // Look for PHP controllers/modules
  const controllerDirs = [
    path.join(dir, 'controllers'),
    path.join(dir, 'modules'),
    path.join(dir, 'api'),
    dir,
  ].filter(d => fs.existsSync(d));

  for (const d of controllerDirs) {
    try {
      const files = fs.readdirSync(d).filter(f => f.endsWith('.php'));
      for (const f of files.slice(0, 30)) {
        const content = fs.readFileSync(path.join(d, f), 'utf-8').slice(0, 500);
        modules.push({
          name: f.replace('.php', ''),
          file: path.relative(dir, path.join(d, f)).replace(/\\/g, '/'),
          has_api: /\$_GET|\$_POST|json_encode|header.*json/i.test(content),
        });
      }
    } catch { /* ignore */ }
  }
  return modules.slice(0, 50);
}

function countReports(dir: string): number {
  const reportDirs = [path.join(dir, 'reports'), path.join(dir, 'artifacts')];
  let count = 0;
  for (const d of reportDirs) {
    if (fs.existsSync(d)) {
      try { count += fs.readdirSync(d).filter(f => /\.(md|json|html|pdf)$/.test(f)).length; }
      catch { /* ignore */ }
    }
  }
  return count;
}

export async function syncDashboardProject(): Promise<DashboardSnapshot> {
  const now = new Date().toISOString();

  if (!fs.existsSync(DASHBOARD_ROOT)) {
    const snap: DashboardSnapshot = {
      synced_at: now, status: 'not_found', root: DASHBOARD_ROOT,
      php_files: 0, modules: [], tasks_cached: [], users_cached: [],
      git_branch: '', git_dirty: false, last_commit: '', api_live: false,
      api_url: DASHBOARD_API, reports_count: 0,
      summary_text: `❌ Dashboard not found at ${DASHBOARD_ROOT}`,
    };
    return snap;
  }

  const branch     = git('rev-parse --abbrev-ref HEAD 2>/dev/null');
  const dirty      = git('status --porcelain 2>/dev/null').length > 0;
  const lastCommit = git('log -1 --pretty=format:"%s (%ar)" 2>/dev/null');

  const phpFiles = (() => {
    try { return parseInt(execSync(`find "${DASHBOARD_ROOT}" -name "*.php" -not -path "*/vendor/*" 2>/dev/null | wc -l`, { encoding: 'utf-8', timeout: 5000 }).trim()); }
    catch { return 0; }
  })();

  const modules       = scanModules(DASHBOARD_ROOT);
  const reportsCount  = countReports(DASHBOARD_ROOT);
  const [apiLive] = await Promise.all([checkApiLive()]);

  // Parse cached tasks from any local JSON files
  const taskCandidates = [
    path.join(DASHBOARD_ROOT, 'data', 'tasks.json'),
    path.join(CACHE_DIR, 'tasks.json'),
  ];
  let tasksCached: DashboardTask[] = [];
  for (const tc of taskCandidates) {
    if (fs.existsSync(tc)) {
      try { tasksCached = JSON.parse(fs.readFileSync(tc, 'utf-8')); break; }
      catch { /* ignore */ }
    }
  }

  const snap: DashboardSnapshot = {
    synced_at: now,
    status: 'ok',
    root: DASHBOARD_ROOT,
    php_files: phpFiles,
    modules: modules.slice(0, 20),
    tasks_cached: tasksCached.slice(0, 50),
    users_cached: [],
    git_branch: branch,
    git_dirty: dirty,
    last_commit: lastCommit,
    api_live: apiLive,
    api_url: DASHBOARD_API,
    reports_count: reportsCount,
    summary_text: [
      `📊 Dashboard (${branch || 'no git'})`,
      `  PHP files: ${phpFiles} | Modules: ${modules.length} | Reports: ${reportsCount}`,
      `  API (${DASHBOARD_API}): ${apiLive ? '✓ live' : '✗ not reachable'}`,
      `  Git: ${dirty ? '⚠ uncommitted' : '✓ clean'} — ${lastCommit.slice(0, 60)}`,
      tasksCached.length ? `  Cached tasks: ${tasksCached.length}` : '  No cached task data',
    ].join('\n'),
  };

  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(path.join(CACHE_DIR, 'data.json'),     JSON.stringify(snap, null, 2));
  fs.writeFileSync(path.join(CACHE_DIR, 'summary.json'),  JSON.stringify({ php_files: phpFiles, modules: modules.length, api_live: apiLive }, null, 2));
  fs.writeFileSync(path.join(CACHE_DIR, 'health.json'),   JSON.stringify({ status: snap.status, api_live: apiLive, synced_at: now }));
  fs.writeFileSync(path.join(CACHE_DIR, 'last_sync.json'),JSON.stringify({ synced_at: now }));
  fs.writeFileSync(path.join(CACHE_DIR, 'errors.json'),   JSON.stringify(apiLive ? [] : [`API not reachable: ${DASHBOARD_API}`]));

  return snap;
}

export function getCachedDashboardProject(): DashboardSnapshot | null {
  try { return JSON.parse(fs.readFileSync(path.join(CACHE_DIR, 'data.json'), 'utf-8')); }
  catch { return null; }
}

export function getDashboardStatus(): string {
  const c = getCachedDashboardProject();
  if (!c) return '📊 Dashboard: chưa sync.';
  return c.summary_text;
}

export function runDashboardQA(): { score: number; issues: string[]; passed: string[] } {
  const snap = getCachedDashboardProject();
  if (!snap) return { score: 0, issues: ['Not synced'], passed: [] };
  const issues: string[] = [];
  const passed: string[] = [];
  if (snap.api_live)    passed.push('API reachable');
  else                  issues.push(`API not reachable: ${snap.api_url}`);
  if (snap.php_files > 0)  passed.push(`${snap.php_files} PHP files`);
  if (!snap.git_dirty)     passed.push('No uncommitted changes');
  else                     issues.push('Has uncommitted changes');
  if (snap.modules.length) passed.push(`${snap.modules.length} modules mapped`);
  const score = Math.round((passed.length / Math.max(passed.length + issues.length, 1)) * 100);
  return { score, issues, passed };
}

// Action: Create task (writes to local cache, queued for push with approval)
export function createTaskDraft(task: Partial<DashboardTask>): DashboardTask {
  const draft: DashboardTask = {
    id: `draft-${Date.now()}`,
    title: task.title || 'Untitled task',
    assignee: task.assignee,
    status: 'pending',
    due_date: task.due_date,
  };
  const draftsFile = path.join(CACHE_DIR, 'task-drafts.json');
  let drafts: DashboardTask[] = [];
  if (fs.existsSync(draftsFile)) {
    try { drafts = JSON.parse(fs.readFileSync(draftsFile, 'utf-8')); } catch { /* ignore */ }
  }
  drafts.push(draft);
  fs.writeFileSync(draftsFile, JSON.stringify(drafts, null, 2));
  return draft;
}
