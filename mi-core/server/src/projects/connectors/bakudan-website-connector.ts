/**
 * Bakudan Website Connector (bakudanramen.com)
 * Node.js Express site at E:/Project/Master/Bakudan/bakudanramen.com-current
 */

import fs from 'fs';
import path from 'path';
import http from 'http';
import { execSync } from 'child_process';

const BAKUDAN_ROOT = process.env.BAKUDAN_WEBSITE_ROOT || 'E:/Project/Master/Bakudan/bakudanramen.com-current';
const CACHE_DIR    = path.join(process.env.GLOBAL_DIR || 'E:/Project/Master/.local-agent-global', 'mi-core', 'connectors', 'bakudan-website');

export interface BakudanSnapshot {
  synced_at:    string;
  status:       'ok' | 'error' | 'not_found';
  root:         string;
  git_remote:   string;
  git_branch:   string;
  git_dirty:    boolean;
  last_commit:  string;
  server_live:  boolean;
  server_port:  number;
  menu_items:   number;
  pages:        string[];
  content_dirs: string[];
  has_env:      boolean;
  seo_issues:   string[];
  summary_text: string;
}

function git(cmd: string): string {
  try { return execSync(`git -C "${BAKUDAN_ROOT}" ${cmd}`, { encoding: 'utf-8', timeout: 5000 }).trim(); }
  catch { return ''; }
}

async function checkServerLive(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const req = http.get({ hostname: 'localhost', port, path: '/', timeout: 2000 }, () => resolve(true));
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

function scanMenuData(): number {
  // Look for menu JSON / data files
  const candidates = [
    path.join(BAKUDAN_ROOT, 'data', 'menu.json'),
    path.join(BAKUDAN_ROOT, 'server', 'data', 'menu.json'),
    path.join(BAKUDAN_ROOT, 'public', 'data', 'menu.json'),
    path.join(BAKUDAN_ROOT, 'src', 'data', 'menu.json'),
    path.join(BAKUDAN_ROOT, 'content', 'menu.json'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      try {
        const data = JSON.parse(fs.readFileSync(c, 'utf-8'));
        if (Array.isArray(data)) return data.length;
        if (data.items && Array.isArray(data.items)) return data.items.length;
      } catch { /* ignore */ }
    }
  }
  // Count from content directory
  const contentDir = path.join(BAKUDAN_ROOT, 'content');
  if (fs.existsSync(contentDir)) {
    return fs.readdirSync(contentDir).filter(f => f.includes('menu')).length;
  }
  return 0;
}

function scanPages(dir: string): string[] {
  const pages: string[] = [];
  const checkDirs = ['src/pages', 'pages', 'src/content', 'content', 'public'];
  for (const d of checkDirs) {
    const full = path.join(dir, d);
    if (!fs.existsSync(full)) continue;
    try {
      const files = fs.readdirSync(full);
      pages.push(...files.filter(f => /\.(html|astro|md|jsx|tsx)$/.test(f)).map(f => `${d}/${f}`));
    } catch { /* ignore */ }
  }
  return pages;
}

export async function syncBakudanWebsite(): Promise<BakudanSnapshot> {
  const now = new Date().toISOString();

  if (!fs.existsSync(BAKUDAN_ROOT)) {
    const snap: BakudanSnapshot = {
      synced_at: now, status: 'not_found', root: BAKUDAN_ROOT,
      git_remote: '', git_branch: '', git_dirty: false, last_commit: '',
      server_live: false, server_port: 0, menu_items: 0, pages: [],
      content_dirs: [], has_env: false, seo_issues: [`Root not found: ${BAKUDAN_ROOT}`],
      summary_text: `❌ Bakudan website not found at ${BAKUDAN_ROOT}`,
    };
    return snap;
  }

  const remote     = git('remote get-url origin 2>/dev/null');
  const branch     = git('rev-parse --abbrev-ref HEAD 2>/dev/null');
  const dirty      = git('status --porcelain 2>/dev/null').length > 0;
  const lastCommit = git('log -1 --pretty=format:"%s (%ar)" 2>/dev/null');

  // Detect port from .env / package.json
  const envContent = ['.env', '.env.example', '.env.local'].map(f =>
    fs.existsSync(path.join(BAKUDAN_ROOT, f)) ? fs.readFileSync(path.join(BAKUDAN_ROOT, f), 'utf-8') : ''
  ).join('');
  const portMatch = envContent.match(/PORT[=\s]+(\d+)/);
  const serverPort = portMatch ? parseInt(portMatch[1]) : 3000;

  const [serverLive, menuItems] = await Promise.all([
    checkServerLive(serverPort),
    Promise.resolve(scanMenuData()),
  ]);

  const pages = scanPages(BAKUDAN_ROOT);
  const contentDirs = ['src/content', 'content', 'src/pages', 'public']
    .filter(d => fs.existsSync(path.join(BAKUDAN_ROOT, d)));

  const seoIssues: string[] = [];
  if (!fs.existsSync(path.join(BAKUDAN_ROOT, 'public', 'robots.txt'))) {
    seoIssues.push('Missing robots.txt');
  }
  if (!serverLive) seoIssues.push('Server not running locally');

  const snap: BakudanSnapshot = {
    synced_at: now,
    status: 'ok',
    root: BAKUDAN_ROOT,
    git_remote: remote,
    git_branch: branch,
    git_dirty: dirty,
    last_commit: lastCommit,
    server_live: serverLive,
    server_port: serverPort,
    menu_items: menuItems,
    pages,
    content_dirs: contentDirs,
    has_env: fs.existsSync(path.join(BAKUDAN_ROOT, '.env')),
    seo_issues: seoIssues,
    summary_text: [
      `🍜 Bakudan Website (${branch || 'no git'})`,
      `  Server: ${serverLive ? `✓ live on :${serverPort}` : `✗ not running (port ${serverPort})`}`,
      `  Menu items: ${menuItems} | Pages: ${pages.length}`,
      `  Git: ${dirty ? '⚠ changes' : '✓ clean'} — ${lastCommit.slice(0, 60)}`,
      seoIssues.length ? `  Issues: ${seoIssues.join('; ')}` : '  No issues',
    ].join('\n'),
  };

  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(path.join(CACHE_DIR, 'data.json'),     JSON.stringify(snap, null, 2));
  fs.writeFileSync(path.join(CACHE_DIR, 'summary.json'),  JSON.stringify({ menu_items: snap.menu_items, server_live: snap.server_live, git_dirty: snap.git_dirty }, null, 2));
  fs.writeFileSync(path.join(CACHE_DIR, 'health.json'),   JSON.stringify({ status: snap.status, server_live: snap.server_live, synced_at: now }));
  fs.writeFileSync(path.join(CACHE_DIR, 'last_sync.json'),JSON.stringify({ synced_at: now }));
  fs.writeFileSync(path.join(CACHE_DIR, 'errors.json'),   JSON.stringify(seoIssues));

  return snap;
}

export function getCachedBakudanWebsite(): BakudanSnapshot | null {
  try { return JSON.parse(fs.readFileSync(path.join(CACHE_DIR, 'data.json'), 'utf-8')); }
  catch { return null; }
}

export function getBakudanWebsiteStatus(): string {
  const c = getCachedBakudanWebsite();
  if (!c) return '🍜 Bakudan Website: chưa sync.';
  return c.summary_text;
}

export function runBakudanQA(): { score: number; issues: string[]; passed: string[] } {
  const snap = getCachedBakudanWebsite();
  if (!snap) return { score: 0, issues: ['Not synced yet'], passed: [] };
  const issues = [...snap.seo_issues];
  const passed: string[] = [];
  if (snap.git_branch) passed.push('Git initialized');
  if (!snap.git_dirty)  passed.push('No uncommitted changes');
  else issues.push('Has uncommitted changes');
  if (snap.server_live) passed.push(`Server live on :${snap.server_port}`);
  if (snap.menu_items > 0) passed.push(`Menu has ${snap.menu_items} items`);
  const score = Math.round((passed.length / Math.max(passed.length + issues.length, 1)) * 100);
  return { score, issues, passed };
}
