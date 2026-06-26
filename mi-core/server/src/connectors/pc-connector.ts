/**
 * PC Connector — read-only scan of local filesystem, processes, ports.
 * All reads are Level 1 (auto-allowed). No writes here.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const MASTER_ROOT = process.env.MASTER_ROOT || 'D:/Project/Master';
const SCAN_DEPTH = 2;

export interface ProjectSummary {
  name: string;
  path: string;
  type: string;
  has_package_json: boolean;
  has_git: boolean;
  last_modified: string;
}

function detectProjectType(dir: string): string {
  const files = fs.readdirSync(dir).map(f => f.toLowerCase());
  if (files.includes('package.json')) return 'node';
  if (files.includes('requirements.txt') || files.includes('pyproject.toml')) return 'python';
  if (files.includes('composer.json')) return 'php';
  if (files.some(f => f.endsWith('.go'))) return 'go';
  if (files.includes('cargo.toml')) return 'rust';
  return 'unknown';
}

export function scanProjects(rootDir = MASTER_ROOT): ProjectSummary[] {
  const results: ProjectSummary[] = [];
  try {
    const entries = fs.readdirSync(rootDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith('.') || entry.name.startsWith('_')) continue;
      const fullPath = path.join(rootDir, entry.name);
      try {
        const stat = fs.statSync(fullPath);
        results.push({
          name: entry.name,
          path: fullPath,
          type: detectProjectType(fullPath),
          has_package_json: fs.existsSync(path.join(fullPath, 'package.json')),
          has_git: fs.existsSync(path.join(fullPath, '.git')),
          last_modified: stat.mtime.toISOString(),
        });
      } catch { /* skip inaccessible */ }
    }
  } catch (e) {
    console.error('[PC Connector] scanProjects error:', e);
  }
  return results.sort((a, b) =>
    new Date(b.last_modified).getTime() - new Date(a.last_modified).getTime()
  );
}

export function searchFiles(query: string, rootDir = MASTER_ROOT): string[] {
  const results: string[] = [];
  const q = query.toLowerCase();
  function walk(dir: string, depth: number) {
    if (depth > SCAN_DEPTH) return;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const e of entries) {
        if (e.name.startsWith('.') || e.name === 'node_modules') continue;
        const full = path.join(dir, e.name);
        if (e.name.toLowerCase().includes(q)) results.push(full);
        if (e.isDirectory()) walk(full, depth + 1);
        if (results.length >= 50) return;
      }
    } catch { /* skip */ }
  }
  walk(rootDir, 0);
  return results;
}

export function getRunningProcesses(): Array<{ pid: string; name: string; cpu?: string; mem?: string }> {
  try {
    const out = execSync(
      'wmic process get ProcessId,Name,WorkingSetSize /format:csv 2>nul',
      { encoding: 'utf-8', timeout: 5000 }
    );
    return out.split('\n')
      .slice(2)
      .filter(l => l.trim())
      .map(line => {
        const parts = line.split(',');
        return { name: parts[1]?.trim() || '', pid: parts[2]?.trim() || '', mem: parts[3]?.trim() };
      })
      .filter(p => p.name && p.pid)
      .slice(0, 30);
  } catch {
    return [];
  }
}

export function getListeningPorts(): Array<{ port: string; pid: string }> {
  try {
    const out = execSync('netstat -ano | findstr LISTENING', { encoding: 'utf-8', timeout: 5000 });
    const seen = new Set<string>();
    return out.split('\n')
      .filter(l => l.includes('LISTENING'))
      .map(line => {
        const parts = line.trim().split(/\s+/);
        const addr = parts[1] || '';
        const port = addr.split(':').pop() || '';
        const pid = parts[4] || '';
        return { port, pid };
      })
      .filter(p => p.port && !seen.has(p.port) && seen.add(p.port))
      .sort((a, b) => parseInt(a.port) - parseInt(b.port));
  } catch {
    return [];
  }
}
