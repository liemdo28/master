import { spawnSync } from 'node:child_process';

function runGit(workspaceRoot, args) {
  const result = spawnSync('git', args, { cwd: workspaceRoot, encoding: 'utf8', shell: false });
  return {
    ok: result.status === 0,
    command: `git ${args.join(' ')}`,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    exitCode: result.status,
  };
}

export class GitChangeTracker {
  constructor({ workspaceRoot } = {}) {
    this.workspaceRoot = workspaceRoot || process.cwd();
  }

  capture() {
    const status = runGit(this.workspaceRoot, ['status', '--short']);
    const diff = runGit(this.workspaceRoot, ['diff', '--', '.']);
    const changedFiles = status.stdout.split(/\r?\n/).filter(Boolean).map((line) => ({
      status: line.slice(0, 2).trim(),
      filePath: line.slice(3).trim(),
    }));
    return {
      status,
      diff,
      changedFiles,
      commitCandidate: changedFiles.length > 0,
      note: 'Do not commit or push without explicit CEO approval.',
    };
  }
}
