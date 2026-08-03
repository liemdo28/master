import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import type { ProjectRecord } from '../project-registry/types';
import type { ValidationCommand, ValidationResult } from './types';

const MAX_OUTPUT = 128 * 1024;
const TIMEOUT_MS = 120_000;

export function buildValidationPlan(project: ProjectRecord, worktreePath: string, requested: string[] = []): ValidationCommand[] {
  const serverDir = path.join(worktreePath, 'server');
  const cwd = fs.existsSync(path.join(serverDir, 'package.json')) ? serverDir : worktreePath;
  const needsInstall = fs.existsSync(path.join(cwd, 'package-lock.json')) && !fs.existsSync(path.join(cwd, 'node_modules'));
  const allowed = new Set([...project.buildCommands, ...project.testCommands, 'npm ci', 'npm run test:coding', 'git diff --check']);
  return [...(needsInstall ? ['npm ci'] : []), 'npm run build', 'npm run test:coding', 'git diff --check', ...requested]
    .filter((command, index, all) => all.indexOf(command) === index)
    .map(command => {
      const configured = allowed.has(command) || command === 'npm run test:coding';
      const parsed = parseAllowedCommand(command, cwd, worktreePath, configured);
      return { name: command, ...parsed };
    });
}

export async function runValidationPlan(plan: ValidationCommand[], options: { isCancelled?: () => boolean } = {}): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];
  for (const command of plan) {
    if (options.isCancelled?.()) {
      results.push({ name: command.name, configured: command.configured, exitCode: 1, timedOut: false, stdout: '', stderr: 'CANCELLED' });
      break;
    }
    if (!command.configured) {
      results.push({ name: command.name, configured: false, exitCode: null, timedOut: false, stdout: '', stderr: 'NOT_CONFIGURED' });
      continue;
    }
    results.push(await runCommand(command, options));
  }
  return results;
}

function parseAllowedCommand(command: string, cwd: string, worktreePath: string, configured: boolean): Omit<ValidationCommand, 'name'> {
  if (command.startsWith('npm run ')) {
    const script = command.slice('npm run '.length).trim();
    const npm = resolveNpmInvocation();
    return { command: npm.command, args: [...npm.args, 'run', script], cwd, configured: configured && npm.configured };
  }
  if (command === 'npm ci') {
    const npm = resolveNpmInvocation();
    return { command: npm.command, args: [...npm.args, 'ci'], cwd, configured: configured && npm.configured };
  }
  if (command === 'git diff --check') {
    return { command: 'git', args: ['diff', '--check'], cwd: worktreePath, configured };
  }
  return { command: '', args: [], cwd, configured: false };
}

function resolveNpmInvocation(): { command: string; args: string[]; configured: boolean } {
  const npmExecPath = process.env.npm_execpath;
  if (npmExecPath && fs.existsSync(npmExecPath)) {
    return { command: process.execPath, args: [npmExecPath], configured: true };
  }
  const localNpmCli = path.resolve(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
  if (fs.existsSync(localNpmCli)) {
    return { command: process.execPath, args: [localNpmCli], configured: true };
  }
  return { command: '', args: [], configured: false };
}

function runCommand(spec: ValidationCommand, options: { isCancelled?: () => boolean }): Promise<ValidationResult> {
  return new Promise(resolve => {
    const child = spawn(spec.command, spec.args, {
      cwd: spec.cwd,
      shell: false,
      windowsHide: true,
      env: minimalEnv(),
    });
    let stdout = '';
    let stderr = '';
    let outputBytes = 0;
    let timedOut = false;
    let cancelled = false;
    const append = (target: 'stdout' | 'stderr', chunk: Buffer) => {
      const remaining = Math.max(0, MAX_OUTPUT - outputBytes);
      const accepted = chunk.subarray(0, remaining).toString('utf8');
      if (target === 'stdout') stdout += accepted;
      else stderr += accepted;
      outputBytes += chunk.length;
      if (outputBytes > MAX_OUTPUT && !child.killed) child.kill();
    };
    const timer = setTimeout(() => {
      timedOut = true;
      if (!child.killed) child.kill();
    }, TIMEOUT_MS);
    const cancelTimer = setInterval(() => {
      if (options.isCancelled?.()) {
        cancelled = true;
        if (!child.killed) child.kill();
      }
    }, 250);
    child.stdout.on('data', chunk => append('stdout', Buffer.from(chunk)));
    child.stderr.on('data', chunk => append('stderr', Buffer.from(chunk)));
    child.on('error', err => {
      clearTimeout(timer);
      clearInterval(cancelTimer);
      resolve({ name: spec.name, configured: true, exitCode: 1, timedOut, stdout, stderr: stderr + String(err.message ?? err) });
    });
    child.on('close', code => {
      clearTimeout(timer);
      clearInterval(cancelTimer);
      resolve({ name: spec.name, configured: true, exitCode: cancelled ? 1 : typeof code === 'number' ? code : 1, timedOut, stdout, stderr: cancelled ? `${stderr}\nCANCELLED`.trim() : stderr });
    });
  });
}

function minimalEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const key of ['PATH', 'Path', 'SystemRoot', 'WINDIR', 'COMSPEC', 'PATHEXT', 'HOME', 'USERPROFILE', 'TMP', 'TEMP']) {
    if (process.env[key]) env[key] = process.env[key];
  }
  return env;
}
