// ============================================================
// Agent OS - Master Snapshot Service
// ============================================================

import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import { writeJournalEvent } from './journal';

const MASTER_ROOT = path.resolve(process.env.MASTER_ROOT || path.join(process.cwd(), '..', '..'));
const SNAPSHOT_DIR = path.join(MASTER_ROOT, '_snapshots');
const LATEST = path.join(SNAPSHOT_DIR, 'MASTER-LATEST.zip');
const PREVIOUS = path.join(SNAPSHOT_DIR, 'MASTER-PREVIOUS.zip');
const LOCK_FILE = path.join(SNAPSHOT_DIR, 'SNAPSHOT-RUNNING.lock');

const EXCLUDE_PATTERN = '\\(node_modules|vendor|\\.git|cache|dist|build|logs|coverage|_snapshots|\\.venv|venv|\\.next)\\';

export function createMasterSnapshot(reason: string, taskId?: string): { latest: string; previous: string | null; status: 'started' | 'skipped' } {
  if (!fs.existsSync(SNAPSHOT_DIR)) {
    fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
  }

  if (fs.existsSync(LOCK_FILE)) {
    writeJournalEvent({
      type: 'snapshot_skipped',
      taskId,
      actor: 'agent-os',
      data: { reason, lockFile: LOCK_FILE, message: 'snapshot already running' },
    });
    return { latest: LATEST, previous: fs.existsSync(PREVIOUS) ? PREVIOUS : null, status: 'skipped' };
  }

  const script = [
    '$ErrorActionPreference = "Stop"',
    `$root = ${JSON.stringify(MASTER_ROOT)}`,
    `$dest = ${JSON.stringify(LATEST)}`,
    `$staging = Join-Path ${JSON.stringify(SNAPSHOT_DIR)} ".snapshot-staging"`,
    `$lock = ${JSON.stringify(LOCK_FILE)}`,
    `$exclude = ${JSON.stringify(EXCLUDE_PATTERN)}`,
    `$previous = ${JSON.stringify(PREVIOUS)}`,
    'Set-Content -LiteralPath $lock -Value (Get-Date).ToString("o")',
    'try {',
    'if (Test-Path -LiteralPath $previous) { Remove-Item -LiteralPath $previous -Force }',
    'if (Test-Path -LiteralPath $dest) { Rename-Item -LiteralPath $dest -NewName "MASTER-PREVIOUS.zip" -Force }',
    'if (Test-Path -LiteralPath $staging) { Remove-Item -LiteralPath $staging -Recurse -Force }',
    'New-Item -ItemType Directory -Force -Path $staging | Out-Null',
    '$files = Get-ChildItem -LiteralPath $root -Recurse -File -Force | Where-Object { $_.FullName -notmatch $exclude }',
    'foreach ($file in $files) {',
    '  $rel = $file.FullName.Substring($root.Length).TrimStart("\\")',
    '  $target = Join-Path $staging $rel',
    '  $targetDir = Split-Path -Parent $target',
    '  if (!(Test-Path -LiteralPath $targetDir)) { New-Item -ItemType Directory -Force -Path $targetDir | Out-Null }',
    '  Copy-Item -LiteralPath $file.FullName -Destination $target -Force',
    '}',
    '$items = Get-ChildItem -LiteralPath $staging -Force',
    'Compress-Archive -Path $items.FullName -DestinationPath $dest -Force',
    'Remove-Item -LiteralPath $staging -Recurse -Force',
    '} finally {',
    'if (Test-Path -LiteralPath $lock) { Remove-Item -LiteralPath $lock -Force }',
    'if (Test-Path -LiteralPath $staging) { Remove-Item -LiteralPath $staging -Recurse -Force }',
    '}',
  ].join('; ');

  const jobFile = path.join(SNAPSHOT_DIR, `SNAPSHOT-JOB-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(jobFile, JSON.stringify({ reason, taskId, latest: LATEST, previous: PREVIOUS, startedAt: new Date().toISOString() }, null, 2), 'utf-8');

  const child = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], {
    cwd: MASTER_ROOT,
    detached: true,
    stdio: 'ignore',
  });
  child.unref();

  writeJournalEvent({
    type: 'snapshot_started',
    taskId,
    actor: 'agent-os',
    data: { reason, latest: LATEST, previous: PREVIOUS, jobFile },
  });

  return { latest: LATEST, previous: fs.existsSync(PREVIOUS) ? PREVIOUS : null, status: 'started' };
}
