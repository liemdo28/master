import * as fs from 'fs';
import * as path from 'path';
import { git } from './git';
import type { ReviewResult, ValidationResult } from './types';

const SECRET_PATTERN = /(api[_-]?key|token|secret|password)\s*[:=]\s*['"]?[A-Za-z0-9_\-.]{16,}/i;

export async function reviewWorktree(worktreePath: string, validation: ValidationResult[]): Promise<ReviewResult> {
  const findings: string[] = [];
  for (const result of validation) {
    if (result.configured && result.exitCode !== 0) findings.push(`validation failed: ${result.name}`);
    if (result.timedOut) findings.push(`validation timed out: ${result.name}`);
  }
  const changedFiles = (await git(worktreePath, ['diff', '--name-only'])).split(/\r?\n/).filter(Boolean);
  if (!changedFiles.length) findings.push('no source changes detected');
  for (const file of changedFiles) {
    const absolute = path.join(worktreePath, file);
    if (!fs.existsSync(absolute) || fs.statSync(absolute).isDirectory()) continue;
    const text = fs.readFileSync(absolute, 'utf8');
    if (text.includes('<<<<<<<') || text.includes('=======') || text.includes('>>>>>>>')) {
      findings.push(`conflict marker found in ${file}`);
    }
    if (SECRET_PATTERN.test(text)) findings.push(`possible secret literal found in ${file}`);
  }
  return { status: findings.length ? 'FAIL' : 'PASS', findings };
}
