/**
 * Local Projects Connector — reads Master Workspace.
 * Returns project registry, health, reports, source maps.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const MASTER_ROOT = process.env.MASTER_ROOT || 'D:/Project/Master';
const GLOBAL_DIR  = process.env.GLOBAL_DIR  || 'D:/Project/Master/.local-agent-global';
const CACHE_DIR   = path.join(GLOBAL_DIR, 'visibility', 'projects');

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'vendor', 'cache',
  '.claude', '_archive', '_zip_agent.ps1',
]);

export interface ProjectEntry {
  name: string;
  path: string;
  type: string;
  git_branch?: string;
  git_dirty?: boolean;
  last_commit?: string;
  issues: string[];
  reports: string[];
  has_qa: boolean;
  last_modified: string;
}

function detectType(dir: string): string {
  try {
    const files = fs.readdirSync(dir).map(f => f.toLowerCase());
    if (files.includes('package.json')) return 'node';
    if (files.some(f => f === 'requirements.txt' || f === 'pyproject.toml')) return 'python';
    if (files.includes('composer.json')) return 'php';
    if (files.some(f => f.endsWith('.go'))) return 'go';
    return 'project';
  } catch { return 'unknown'; }
}

function gitInfo(dir: string) {
  const run = (cmd: string) => { try { return execSync(cmd, { cwd: dir, encoding: 'utf-8', timeout: 4000 }).trim(); } catch { return ''; } };
  if (!fs.existsSync(path.join(dir, '.git'))) return {};
  return {
    git_branch: run('git rev-parse --abbrev-ref HEAD'),
    git_dirty: run('git status --porcelain').length > 0,
    last_commit: run('git log -1 --format="%h %s (%ar)" 2>/dev/null'),
  };
}

function findReports(dir: string): string[] {
  const reports: string[] = [];
  const scan = (d: string, depth: number) => {
    if (depth > 2) return;
    try {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        if (SKIP_DIRS.has(e.name)) continue;
        const full = path.join(d, e.name);
        if (e.isFile() && /\.(md|txt)$/i.test(e.name) &&
            /report|audit|qa|validation|summary/i.test(e.name)) {
          reports.push(full.replace(MASTER_ROOT, ''));
        }
        if (e.isDirectory()) scan(full, depth + 1);
      }
    } catch { /* skip */ }
  };
  scan(dir, 0);
  return reports.slice(0, 10);
}

export async function syncLocalProjects(): Promise<ProjectEntry[]> {
  const projects: ProjectEntry[] = [];
  try {
    for (const entry of fs.readdirSync(MASTER_ROOT, { withFileTypes: true })) {
      if (!entry.isDirectory() || SKIP_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
      const fullPath = path.join(MASTER_ROOT, entry.name);
      const stat = fs.statSync(fullPath);
      const issues: string[] = [];
      const git = gitInfo(fullPath);
      if (git.git_dirty) issues.push('uncommitted changes');
      const reports = findReports(fullPath);
      projects.push({
        name: entry.name,
        path: fullPath,
        type: detectType(fullPath),
        ...git,
        issues,
        reports,
        has_qa: fs.existsSync(path.join(fullPath, 'qa-reports')) || reports.some(r => /qa/i.test(r)),
        last_modified: stat.mtime.toISOString(),
      });
    }
  } catch (e) { console.error('[local-projects]', e); }

  // Write cache
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    const now = new Date().toISOString();
    fs.writeFileSync(path.join(CACHE_DIR, 'data.json'), JSON.stringify(projects, null, 2));
    fs.writeFileSync(path.join(CACHE_DIR, 'summary.json'), JSON.stringify({
      total: projects.length,
      with_issues: projects.filter(p => p.issues.length > 0).length,
      has_reports: projects.filter(p => p.reports.length > 0).length,
      types: [...new Set(projects.map(p => p.type))],
    }, null, 2));
    fs.writeFileSync(path.join(CACHE_DIR, 'last_sync.json'), JSON.stringify({ synced_at: now }));
    fs.writeFileSync(path.join(CACHE_DIR, 'errors.json'), JSON.stringify([]));
  } catch { /* skip cache write */ }

  return projects;
}

export function getCachedProjects(): ProjectEntry[] {
  try {
    return JSON.parse(fs.readFileSync(path.join(CACHE_DIR, 'data.json'), 'utf-8'));
  } catch { return []; }
}

export function searchProjects(query: string): ProjectEntry[] {
  const q = query.toLowerCase();
  return getCachedProjects().filter(p =>
    p.name.toLowerCase().includes(q) ||
    p.type.toLowerCase().includes(q) ||
    p.reports.some(r => r.toLowerCase().includes(q))
  );
}
