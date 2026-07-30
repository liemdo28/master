/**
 * Master Project Scanner
 * Scans E:/Project/Master, detects all projects with metadata.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const MASTER_ROOT = process.env.MASTER_ROOT || 'E:/Project/Master';
const GLOBAL_DIR  = process.env.GLOBAL_DIR  || 'E:/Project/Master/.local-agent-global';
const CACHE_FILE  = path.join(GLOBAL_DIR, 'mi-core', 'master-projects.json');

const EXCLUDE_DIRS = new Set([
  'node_modules','.git','.backups','dist','build','vendor','cache','tmp','logs',
  '.claude','worktrees','.wrangler','__pycache__','venv','.venv',
]);

export interface ProjectInfo {
  project_id:      string;
  name:            string;
  path:            string;
  relative_path:   string;
  type:            string;
  framework:       string;
  package_manager: string;
  language:        string;
  git_remote:      string;
  git_branch:      string;
  git_dirty:       boolean;
  ports:           number[];
  start_cmd:       string;
  test_cmd:        string;
  build_cmd:       string;
  health_url:      string;
  location:        'local' | 'remote';
  machine:         string;
  file_count:      number;
  has_dockerfile:  boolean;
  has_env:         boolean;
  last_scanned:    string;
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function readJson(file: string): Record<string, unknown> {
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')); }
  catch { return {}; }
}

function gitInfo(dir: string): { remote: string; branch: string; dirty: boolean } {
  try {
    const remote = execSync(`git -C "${dir}" remote get-url origin 2>/dev/null`, { encoding: 'utf-8', timeout: 3000 }).trim();
    const branch = execSync(`git -C "${dir}" rev-parse --abbrev-ref HEAD 2>/dev/null`, { encoding: 'utf-8', timeout: 3000 }).trim();
    const status = execSync(`git -C "${dir}" status --porcelain 2>/dev/null`, { encoding: 'utf-8', timeout: 3000 }).trim();
    return { remote, branch, dirty: status.length > 0 };
  } catch { return { remote: '', branch: '', dirty: false }; }
}

function detectPorts(pkg: Record<string, unknown>, dir: string): number[] {
  const ports: Set<number> = new Set();
  const scripts = (pkg.scripts as Record<string, string>) || {};
  const allText = [
    ...Object.values(scripts),
    tryReadFile(path.join(dir, '.env')),
    tryReadFile(path.join(dir, '.env.example')),
  ].join(' ');
  const matches = allText.matchAll(/(?:PORT|port)[=:\s]+(\d{4,5})/g);
  for (const m of matches) ports.add(parseInt(m[1]));
  const explicitPorts = [3000, 3001, 4000, 4001, 4002, 4003, 8000, 8080, 8844];
  for (const p of explicitPorts) {
    if (allText.includes(`:${p}`) || allText.includes(`PORT=${p}`)) ports.add(p);
  }
  return [...ports].sort();
}

function tryReadFile(f: string): string {
  try { return fs.readFileSync(f, 'utf-8'); } catch { return ''; }
}

function detectFramework(pkg: Record<string, unknown>, dir: string): { framework: string; type: string; language: string; pm: string } {
  const deps = { ...((pkg.dependencies as object) || {}), ...((pkg.devDependencies as object) || {}) };
  const scripts = (pkg.scripts as Record<string, string>) || {};

  // Language
  const hasPy = fs.existsSync(path.join(dir, 'requirements.txt')) || fs.existsSync(path.join(dir, 'app.py')) || fs.existsSync(path.join(dir, 'main.py'));
  const hasPhp = fs.existsSync(path.join(dir, 'index.php')) || (fs.readdirSync(dir).some(f => f.endsWith('.php')));
  const hasTs = fs.existsSync(path.join(dir, 'tsconfig.json'));
  const language = hasPy ? 'python' : hasPhp ? 'php' : hasTs ? 'typescript' : 'javascript';

  // Framework
  let framework = 'unknown';
  if ('astro' in deps) framework = 'astro';
  else if ('next' in deps) framework = 'next.js';
  else if ('nuxt' in deps) framework = 'nuxt';
  else if ('react' in deps && ('vite' in deps || 'react-scripts' in deps)) framework = 'react';
  else if ('vue' in deps) framework = 'vue';
  else if ('fastapi' in deps || hasPy) framework = 'fastapi/python';
  else if (hasPhp) framework = 'php';
  else if ('express' in deps) framework = 'express';
  else if ('fastify' in deps) framework = 'fastify';
  else if ('electron' in deps) framework = 'electron';
  else if (Object.keys(deps).length > 0) framework = 'node';

  // Type
  let type = 'app';
  if (framework === 'astro' || framework === 'next.js' || framework === 'nuxt') type = 'website';
  else if (framework === 'php') type = 'php-website';
  else if (framework === 'electron') type = 'desktop';
  else if (framework === 'express' || framework === 'fastify') type = 'api-server';
  else if (hasPy) type = 'python-service';

  // Package manager
  const pm = fs.existsSync(path.join(dir, 'pnpm-lock.yaml')) ? 'pnpm'
    : fs.existsSync(path.join(dir, 'yarn.lock')) ? 'yarn'
    : fs.existsSync(path.join(dir, 'package-lock.json')) ? 'npm'
    : fs.existsSync(path.join(dir, 'requirements.txt')) ? 'pip'
    : fs.existsSync(path.join(dir, 'composer.json')) ? 'composer'
    : 'none';

  return { framework, type, language, pm };
}

function countFiles(dir: string): number {
  try {
    let count = 0;
    function walk(d: string, depth = 0) {
      if (depth > 4) return;
      const entries = fs.readdirSync(d, { withFileTypes: true });
      for (const e of entries) {
        if (EXCLUDE_DIRS.has(e.name)) continue;
        if (e.isDirectory()) walk(path.join(d, e.name), depth + 1);
        else count++;
      }
    }
    walk(dir);
    return count;
  } catch { return 0; }
}

function isProjectDir(dir: string): boolean {
  const entries = fs.readdirSync(dir);
  return entries.some(e => [
    'package.json', 'composer.json', 'requirements.txt', 'index.php',
    'app.py', 'main.py', 'tsconfig.json', 'go.mod', 'Cargo.toml',
    'Gemfile', 'pom.xml', '.git', 'Dockerfile',
  ].includes(e));
}

function scanDirectory(baseDir: string, depth = 0): ProjectInfo[] {
  const results: ProjectInfo[] = [];
  if (depth > 2) return results;

  let entries: fs.Dirent[];
  try { entries = fs.readdirSync(baseDir, { withFileTypes: true }); }
  catch { return results; }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (EXCLUDE_DIRS.has(entry.name)) continue;
    if (entry.name.startsWith('.')) continue;

    const fullPath = path.join(baseDir, entry.name);

    if (isProjectDir(fullPath)) {
      results.push(buildProjectInfo(fullPath));
    } else {
      results.push(...scanDirectory(fullPath, depth + 1));
    }
  }

  return results;
}

function buildProjectInfo(dir: string): ProjectInfo {
  const pkg = fs.existsSync(path.join(dir, 'package.json'))
    ? readJson(path.join(dir, 'package.json'))
    : {};
  const scripts = (pkg.scripts as Record<string, string>) || {};
  const { framework, type, language, pm } = detectFramework(pkg, dir);
  const git = gitInfo(dir);
  const ports = detectPorts(pkg, dir);
  const relPath = path.relative(MASTER_ROOT, dir).replace(/\\/g, '/');
  const name = (pkg.name as string) || path.basename(dir);

  // Determine remote projects
  const isRemote = ['integration-system', 'whatsapp-ai-gateway', 'whatsapp-api'].some(n =>
    dir.toLowerCase().includes(n.toLowerCase())
  );

  return {
    project_id:      slug(name),
    name,
    path:            dir.replace(/\\/g, '/'),
    relative_path:   relPath,
    type,
    framework,
    package_manager: pm,
    language,
    git_remote:      git.remote,
    git_branch:      git.branch,
    git_dirty:       git.dirty,
    ports,
    start_cmd:       scripts.start || scripts.dev || '',
    test_cmd:        scripts.test || scripts['test:unit'] || '',
    build_cmd:       scripts.build || '',
    health_url:      ports.length > 0 ? `http://localhost:${ports[0]}/health` : '',
    location:        isRemote ? 'remote' : 'local',
    machine:         isRemote ? 'laptop-remote' : 'main-pc',
    file_count:      countFiles(dir),
    has_dockerfile:  fs.existsSync(path.join(dir, 'Dockerfile')),
    has_env:         fs.existsSync(path.join(dir, '.env')) || fs.existsSync(path.join(dir, '.env.example')),
    last_scanned:    new Date().toISOString(),
  };
}

export function scanAllProjects(force = false): ProjectInfo[] {
  // Cache for 30 min unless forced
  if (!force && fs.existsSync(CACHE_FILE)) {
    try {
      const cached = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8')) as { scanned_at: string; projects: ProjectInfo[] };
      const age = Date.now() - new Date(cached.scanned_at).getTime();
      if (age < 30 * 60 * 1000) return cached.projects;
    } catch { /* ignore */ }
  }

  const projects = scanDirectory(MASTER_ROOT);

  // Deduplicate by path
  const seen = new Set<string>();
  const unique = projects.filter(p => {
    if (seen.has(p.path)) return false;
    seen.add(p.path);
    return true;
  });

  fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
  fs.writeFileSync(CACHE_FILE, JSON.stringify({
    scanned_at: new Date().toISOString(),
    total: unique.length,
    projects: unique,
  }, null, 2));

  return unique;
}

export function getProjectById(id: string): ProjectInfo | null {
  const all = scanAllProjects();
  return all.find(p => p.project_id === id || p.name === id || p.path.includes(id)) || null;
}

export function getProjectSummary(): string {
  const projects = scanAllProjects();
  const local  = projects.filter(p => p.location === 'local');
  const remote = projects.filter(p => p.location === 'remote');
  const dirty  = projects.filter(p => p.git_dirty);
  const lines = [
    `📦 Master Workspace: ${projects.length} projects`,
    `  Local: ${local.length} | Remote: ${remote.length}`,
    `  Uncommitted changes: ${dirty.length}`,
    `  Frameworks: ${[...new Set(projects.map(p => p.framework))].filter(f => f !== 'unknown').join(', ')}`,
  ];
  if (dirty.length) lines.push(`  Dirty: ${dirty.map(p => p.name).join(', ')}`);
  return lines.join('\n');
}
