/**
 * Project Connector — reads project health from Master Workspace.
 * Checks git status, package.json, QA reports, recent changes.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const MASTER_ROOT = process.env.MASTER_ROOT || 'E:/Project/Master';

export interface ProjectHealth {
  name: string;
  path: string;
  git_branch?: string;
  git_dirty?: boolean;
  git_ahead?: number;
  last_commit?: string;
  has_errors?: boolean;
  qa_status?: string;
  issues: string[];
}

function runGit(cmd: string, cwd: string): string {
  try {
    return execSync(cmd, { cwd, encoding: 'utf-8', timeout: 5000 }).trim();
  } catch {
    return '';
  }
}

export function getProjectHealth(projectPath: string): ProjectHealth {
  const name = path.basename(projectPath);
  const issues: string[] = [];
  const hasGit = fs.existsSync(path.join(projectPath, '.git'));

  let git_branch: string | undefined;
  let git_dirty: boolean | undefined;
  let git_ahead: number | undefined;
  let last_commit: string | undefined;

  if (hasGit) {
    git_branch = runGit('git rev-parse --abbrev-ref HEAD', projectPath);
    const status = runGit('git status --porcelain', projectPath);
    git_dirty = status.length > 0;
    if (git_dirty) issues.push(`${status.split('\n').length} uncommitted changes`);

    const ahead = runGit('git rev-list @{u}..HEAD --count 2>/dev/null || echo 0', projectPath);
    git_ahead = parseInt(ahead) || 0;
    if (git_ahead > 0) issues.push(`${git_ahead} commits ahead of remote`);

    last_commit = runGit('git log -1 --format="%h %s (%ar)" 2>/dev/null', projectPath);
  }

  // Check for error indicators
  const hasErrors = ['error.log', 'crash.log'].some(f =>
    fs.existsSync(path.join(projectPath, f))
  );
  if (hasErrors) issues.push('Error log found');

  // Check QA reports
  let qa_status: string | undefined;
  const qaDir = path.join(projectPath, 'qa-reports');
  if (fs.existsSync(qaDir)) {
    const reports = fs.readdirSync(qaDir).filter(f => f.endsWith('.json'));
    if (reports.length > 0) {
      try {
        const latest = reports.sort().pop()!;
        const report = JSON.parse(fs.readFileSync(path.join(qaDir, latest), 'utf-8'));
        qa_status = report.status || report.result || 'unknown';
        if (qa_status === 'fail' || qa_status === 'error') issues.push('QA failed');
      } catch { /* skip */ }
    }
  }

  return { name, path: projectPath, git_branch, git_dirty, git_ahead, last_commit, qa_status, issues };
}

export function getAllProjectHealth(): ProjectHealth[] {
  const results: ProjectHealth[] = [];
  try {
    const entries = fs.readdirSync(MASTER_ROOT, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.') || entry.name.startsWith('_')) continue;
      const fullPath = path.join(MASTER_ROOT, entry.name);
      results.push(getProjectHealth(fullPath));
    }
  } catch (e) {
    console.error('[Project Connector]', e);
  }
  return results;
}

export function getProjectsWithIssues(): ProjectHealth[] {
  return getAllProjectHealth().filter(p => p.issues.length > 0);
}
