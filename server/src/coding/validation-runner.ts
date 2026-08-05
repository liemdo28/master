import * as fs from 'fs';
import * as path from 'path';
import { spawn, execFileSync } from 'child_process';
import type { ProjectRecord, ValidationProfile } from '../project-registry/types';
import type { ValidationArtifactReport, ValidationCommand, ValidationResult } from './types';

const MAX_OUTPUT = 128 * 1024;
const TIMEOUT_MS = 120_000;

export function buildValidationPlan(project: ProjectRecord, worktreePath: string, requested: string[] = []): ValidationCommand[] {
  const profile = project.validationProfile ?? legacyNpmProfile(project, worktreePath);
  const cwd = validationCwd(profile, worktreePath);
  const commands = [
    ...profile.installCommands.map(command => ({ command, category: 'install' as const })),
    ...profile.buildCommands.map(command => ({ command, category: 'build' as const })),
    ...profile.lintCommands.map(command => ({ command, category: 'lint' as const })),
    ...profile.testCommands.map(command => ({ command, category: 'test' as const })),
    { command: 'git diff --check', category: 'diff' as const },
    ...requested.map(command => ({ command, category: 'requested' as const })),
  ];
  const allowed = new Set([...commands.map(item => item.command), ...project.buildCommands, ...project.testCommands]);
  return commands
    .filter((item, index, all) => all.findIndex(other => other.command === item.command) === index)
    .map(item => {
      const configured = allowed.has(item.command);
      const parsed = parseAllowedCommand(item.command, cwd, worktreePath, configured);
      return { name: item.command, category: item.category, ...parsed };
    });
}

export function captureValidationArtifactBaseline(worktreePath: string): { status: string[]; diff: string } {
  return {
    status: gitStatus(worktreePath),
    diff: gitMaybe(worktreePath, ['diff', '--binary']),
  };
}

export function classifyValidationArtifacts(input: {
  project: ProjectRecord;
  worktreePath: string;
  before: { status: string[]; diff: string };
}): ValidationArtifactReport {
  const profile = input.project.validationProfile ?? legacyNpmProfile(input.project, input.worktreePath);
  const before = new Set(input.before.status);
  const after = gitStatus(input.worktreePath);
  const generated = [...profile.generatedOutputPaths, ...profile.artifactPaths].map(normalizePrefix);
  const expectedGeneratedArtifacts: string[] = [];
  const unexpectedChanges: string[] = [];
  for (const entry of after) {
    if (before.has(entry)) continue;
    const file = entry.slice(3).replace(/\\/g, '/');
    if (generated.some(prefix => file === prefix || file.startsWith(`${prefix}/`))) expectedGeneratedArtifacts.push(entry);
    else unexpectedChanges.push(entry);
  }
  return {
    baseCheckoutUnchanged: unexpectedChanges.length === 0,
    expectedGeneratedArtifacts,
    unexpectedChanges,
    beforeStatus: input.before.status,
    afterStatus: after,
    cleanupPolicy: profile.cleanupPolicy,
  };
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

function parseAllowedCommand(command: string, cwd: string, worktreePath: string, configured: boolean): Omit<ValidationCommand, 'name' | 'category'> {
  if (hasShellSyntax(command)) return { command: '', args: [], cwd, configured: false };
  if (command.startsWith('npm run ')) {
    const script = command.slice('npm run '.length).trim();
    const npm = resolveNpmInvocation();
    return { command: npm.command, args: [...npm.args, 'run', script], cwd, configured: configured && npm.configured && npmScriptExists(cwd, script) };
  }
  if (command === 'npm ci') {
    const npm = resolveNpmInvocation();
    return { command: npm.command, args: [...npm.args, 'ci'], cwd, configured: configured && npm.configured };
  }
  if (command === 'git diff --check') {
    return { command: 'git', args: ['diff', '--check'], cwd: worktreePath, configured };
  }
  if (command === 'npm test') {
    const npm = resolveNpmInvocation();
    return { command: npm.command, args: [...npm.args, 'test'], cwd, configured: configured && npm.configured && npmScriptExists(cwd, 'test') };
  }
  if (command === 'flutter pub get') {
    const flutter = resolveFlutterInvocation();
    return { command: flutter.command, args: [...flutter.args, 'pub', 'get'], cwd, configured: configured && flutter.configured };
  }
  if (command === 'flutter analyze') {
    const flutter = resolveFlutterInvocation();
    return { command: flutter.command, args: [...flutter.args, 'analyze'], cwd, configured: configured && flutter.configured };
  }
  if (command === 'flutter test' || command.startsWith('flutter test ')) {
    const flutter = resolveFlutterInvocation();
    const testArgs = command.slice('flutter test'.length).trim();
    const extraArgs = testArgs ? testArgs.split(/\s+/).filter(Boolean) : [];
    const safeArgs = extraArgs.every(isSafeRelativeArg);
    return { command: flutter.command, args: [...flutter.args, 'test', ...extraArgs], cwd, configured: configured && flutter.configured && safeArgs };
  }
  if (command === 'pytest') return { command: 'pytest', args: [], cwd, configured };
  if (command === 'ruff check .') return { command: 'ruff', args: ['check', '.'], cwd, configured };
  if (command === 'mypy .') return { command: 'mypy', args: ['.'], cwd, configured };
  return { command: '', args: [], cwd, configured: false };
}

function legacyNpmProfile(project: ProjectRecord, worktreePath: string): ValidationProfile {
  const serverDir = path.join(worktreePath, 'server');
  const cwd = fs.existsSync(path.join(serverDir, 'package.json')) ? serverDir : worktreePath;
  const needsInstall = fs.existsSync(path.join(cwd, 'package-lock.json')) && !fs.existsSync(path.join(cwd, 'node_modules'));
  return {
    language: 'javascript',
    framework: 'node',
    installCommands: needsInstall ? ['npm ci'] : [],
    buildCommands: project.buildCommands,
    testCommands: project.testCommands,
    lintCommands: [],
    artifactPaths: [],
    generatedOutputPaths: ['dist', 'build', 'coverage'],
    cleanupPolicy: 'none',
    successCriteria: ['legacy configured commands exit 0'],
  };
}

function validationCwd(profile: ValidationProfile, worktreePath: string): string {
  if (profile.framework === 'flutter') {
    for (const candidate of [worktreePath, path.join(worktreePath, 'apps', 'mobile'), path.join(worktreePath, 'apps', 'admin')]) {
      if (fs.existsSync(path.join(candidate, 'pubspec.yaml'))) return candidate;
    }
  }
  const serverDir = path.join(worktreePath, 'server');
  if (fs.existsSync(path.join(serverDir, 'package.json'))) return serverDir;
  return worktreePath;
}

function gitStatus(worktreePath: string): string[] {
  return gitMaybe(worktreePath, ['status', '--porcelain'])
    .split(/\r?\n/)
    .map(line => line.trimEnd())
    .filter(Boolean);
}

function gitMaybe(worktreePath: string, args: string[]): string {
  try {
    return execFileSync('git', args, { cwd: worktreePath, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  } catch {
    return '';
  }
}

function normalizePrefix(value: string): string {
  return value.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
}

function hasShellSyntax(command: string): boolean {
  return /[;&|`<>]/.test(command);
}

function isSafeRelativeArg(value: string): boolean {
  return !value.startsWith('-') && !path.isAbsolute(value) && !value.includes('..') && /^[A-Za-z0-9_./-]+$/.test(value);
}

function npmScriptExists(cwd: string, script: string): boolean {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8')) as { scripts?: Record<string, string> };
    return Boolean(pkg.scripts?.[script]);
  } catch {
    return false;
  }
}

/**
 * Resolves npm as `node <npm-cli.js>` rather than `npm.cmd`. Node refuses to
 * spawn .cmd shims without `shell: true` (CVE-2024-27980), and enabling a shell
 * here would reintroduce the command-injection surface this layer exists to
 * remove. Exported so fixtures and benchmarks execute commands identically.
 */
export function resolveNpmInvocation(): { command: string; args: string[]; configured: boolean } {
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

export function resolveFlutterInvocation(): { command: string; args: string[]; configured: boolean } {
  const roots = new Set<string>();
  if (process.env.FLUTTER_ROOT) roots.add(process.env.FLUTTER_ROOT);
  if (process.env.FLUTTER_BIN) roots.add(path.resolve(process.env.FLUTTER_BIN, '..', '..'));
  for (const entry of pathEntries()) {
    const flutterScript = path.join(entry, process.platform === 'win32' ? 'flutter.bat' : 'flutter');
    if (fs.existsSync(flutterScript)) roots.add(path.resolve(entry, '..'));
  }

  for (const rootValue of roots) {
    const snapshot = path.join(rootValue, 'bin', 'cache', 'flutter_tools.snapshot');
    const root = path.resolve(snapshot, '..', '..');
    const dart = path.join(root, 'cache', 'dart-sdk', 'bin', process.platform === 'win32' ? 'dart.exe' : 'dart');
    if (fs.existsSync(snapshot) && fs.existsSync(dart)) return { command: dart, args: [snapshot], configured: true };
  }
  const executableCandidates = [process.env.FLUTTER_BIN, findOnPath('flutter')].filter(Boolean) as string[];
  for (const candidate of executableCandidates) {
    if (fs.existsSync(candidate)) return { command: candidate, args: [], configured: true };
  }
  return { command: 'flutter', args: [], configured: true };
}

function pathEntries(): string[] {
  return (process.env.PATH ?? process.env.Path ?? '').split(path.delimiter).filter(Boolean);
}

function findOnPath(name: string): string | null {
  const names = process.platform === 'win32' ? [name, `${name}.exe`, `${name}.cmd`, `${name}.bat`] : [name];
  for (const entry of pathEntries()) {
    for (const candidateName of names) {
      const candidate = path.join(entry, candidateName);
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  return null;
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
  for (const key of [
    'PATH', 'Path', 'SystemRoot', 'WINDIR', 'COMSPEC', 'PATHEXT', 'HOME', 'USERPROFILE', 'TMP', 'TEMP',
    'LOCALAPPDATA', 'APPDATA', 'PUB_CACHE', 'FLUTTER_ROOT', 'PROGRAMFILES', 'PROGRAMFILES(X86)', 'ProgramW6432',
  ]) {
    if (process.env[key]) env[key] = process.env[key];
  }
  return env;
}
