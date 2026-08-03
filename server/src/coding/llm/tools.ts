/**
 * Phase 4 controlled tool layer.
 *
 * The engine never receives a shell. Every capability it has is a function in
 * this file, each of which re-validates the worktree boundary itself rather than
 * trusting an earlier check — a model that emits `../../../etc/passwd`, a Windows
 * device name, an NTFS junction, or an absolute path must be stopped here even if
 * the caller forgot to filter it.
 */

import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import { CodingEngineError } from './types';

const MAX_READ_BYTES = 256 * 1024;
const MAX_SEARCH_RESULTS = 60;
const MAX_TOOL_OUTPUT = 128 * 1024;
const TOOL_TIMEOUT_MS = 120_000;

/** Paths the engine may never read or write, regardless of context pack contents. */
const DENIED_PATTERNS: RegExp[] = [
  /(^|\/)\.git(\/|$)/i,
  /(^|\/)node_modules(\/|$)/i,
  /(^|\/)dist(\/|$)/i,
  /(^|\/)build(\/|$)/i,
  /(^|\/)coverage(\/|$)/i,
  /(^|\/)\.env($|\.)/i,
  /(^|\/)\.npmrc$/i,
  /(^|\/)id_rsa($|\.)/i,
  /(^|\/)\.ssh(\/|$)/i,
  /(^|\/)secrets?(\/|$)/i,
  /\.(pem|key|pfx|p12|keystore|jks)$/i,
];

/** Binary/opaque extensions that would waste the context budget. */
const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.bmp', '.tiff',
  '.pdf', '.zip', '.gz', '.tar', '.7z', '.rar', '.exe', '.dll', '.so',
  '.dylib', '.node', '.wasm', '.mp4', '.mp3', '.wav', '.mov', '.db',
  '.sqlite', '.sqlite3', '.pyc', '.class', '.jar', '.bin', '.woff', '.woff2',
]);

/** Windows reserved device names — opening these can hang or hit hardware. */
const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i;

export interface ToolContext {
  worktreePath: string;
  /** Repo-relative paths the engine may touch without an expansion request. */
  allowedPaths: Set<string>;
  /** Validation commands the engine is permitted to trigger. */
  registeredCommands: Map<string, { command: string; args: string[]; cwd: string }>;
  signal?: AbortSignal;
}

export interface PathResolution {
  ok: boolean;
  absolute?: string;
  relative?: string;
  reason?: string;
}

/**
 * Resolves a model-supplied path against the worktree, rejecting anything that
 * escapes it. Symlinks are resolved before the containment check so a junction
 * pointing outside the worktree cannot smuggle access.
 */
export function resolveWithinWorktree(worktreePath: string, candidate: string): PathResolution {
  if (typeof candidate !== 'string' || !candidate.trim()) {
    return { ok: false, reason: 'empty path' };
  }
  if (candidate.includes('\0')) return { ok: false, reason: 'null byte in path' };

  const normalizedInput = candidate.replace(/\\/g, '/').trim();
  if (path.isAbsolute(normalizedInput) || /^[a-z]:/i.test(normalizedInput)) {
    return { ok: false, reason: 'absolute paths are not permitted' };
  }
  if (normalizedInput.startsWith('//') || normalizedInput.startsWith('\\\\')) {
    return { ok: false, reason: 'UNC paths are not permitted' };
  }
  if (normalizedInput.split('/').some(segment => WINDOWS_RESERVED.test(segment))) {
    return { ok: false, reason: 'reserved device name' };
  }
  if (DENIED_PATTERNS.some(pattern => pattern.test(normalizedInput))) {
    return { ok: false, reason: 'path is in a denied location' };
  }

  let root: string;
  try {
    root = fs.realpathSync.native(worktreePath);
  } catch {
    return { ok: false, reason: 'worktree root is unavailable' };
  }

  const absolute = path.resolve(root, normalizedInput);
  if (!isInside(absolute, root)) return { ok: false, reason: 'path escapes the worktree' };

  // Resolve the deepest existing ancestor so a not-yet-created file still gets a
  // symlink check on the directory that would contain it.
  const realTarget = realpathOfNearestExisting(absolute);
  if (realTarget && !isInside(realTarget, root)) {
    return { ok: false, reason: 'path escapes the worktree via a link' };
  }

  const relative = path.relative(root, absolute).replace(/\\/g, '/');
  if (DENIED_PATTERNS.some(pattern => pattern.test(relative))) {
    return { ok: false, reason: 'path is in a denied location' };
  }
  return { ok: true, absolute, relative };
}

function realpathOfNearestExisting(target: string): string | null {
  let current = target;
  for (let depth = 0; depth < 64; depth += 1) {
    if (fs.existsSync(current)) {
      try {
        const real = fs.realpathSync.native(current);
        // Re-append the portion that does not exist yet.
        const suffix = path.relative(current, target);
        return suffix ? path.resolve(real, suffix) : real;
      } catch {
        return null;
      }
    }
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
  return null;
}

function isInside(target: string, root: string): boolean {
  const rel = path.relative(root, target);
  return rel === '' || (!!rel && !rel.startsWith('..') && !path.isAbsolute(rel));
}

export function isBinaryPath(relative: string): boolean {
  return BINARY_EXTENSIONS.has(path.posix.extname(relative).toLowerCase());
}

/** Reads an approved file. Paths outside `allowedPaths` require prior expansion. */
export function readApprovedFile(ctx: ToolContext, candidate: string): { path: string; content: string; bytes: number } {
  throwIfCancelled(ctx);
  const resolved = resolveWithinWorktree(ctx.worktreePath, candidate);
  if (!resolved.ok) throw new CodingEngineError('POLICY_DENIED', `read denied for ${candidate}: ${resolved.reason}`);
  if (!ctx.allowedPaths.has(resolved.relative!)) {
    throw new CodingEngineError('POLICY_DENIED', `read denied for ${resolved.relative}: not in approved context`);
  }
  if (isBinaryPath(resolved.relative!)) {
    throw new CodingEngineError('POLICY_DENIED', `read denied for ${resolved.relative}: binary file`);
  }
  const stat = fs.statSync(resolved.absolute!);
  if (!stat.isFile()) throw new CodingEngineError('POLICY_DENIED', `read denied for ${resolved.relative}: not a regular file`);
  if (stat.size > MAX_READ_BYTES) {
    throw new CodingEngineError('POLICY_DENIED', `read denied for ${resolved.relative}: exceeds ${MAX_READ_BYTES} bytes`);
  }
  return { path: resolved.relative!, content: fs.readFileSync(resolved.absolute!, 'utf8'), bytes: stat.size };
}

/** Lists a directory that sits inside the worktree, filtered by the deny list. */
export function listApprovedDirectory(ctx: ToolContext, candidate: string): string[] {
  throwIfCancelled(ctx);
  const target = candidate === '' || candidate === '.' ? '.' : candidate;
  const resolved = target === '.'
    ? { ok: true as const, absolute: fs.realpathSync.native(ctx.worktreePath), relative: '' }
    : resolveWithinWorktree(ctx.worktreePath, target);
  if (!resolved.ok) throw new CodingEngineError('POLICY_DENIED', `list denied for ${candidate}: ${resolved.reason}`);
  if (!fs.existsSync(resolved.absolute!)) return [];
  return fs.readdirSync(resolved.absolute!, { withFileTypes: true })
    .map(entry => (entry.isDirectory() ? `${entry.name}/` : entry.name))
    .filter(name => !DENIED_PATTERNS.some(pattern => pattern.test(name)))
    .slice(0, 200);
}

/** Literal substring search restricted to approved paths. */
export function searchApprovedPaths(ctx: ToolContext, needle: string): Array<{ path: string; line: number; text: string }> {
  throwIfCancelled(ctx);
  if (!needle || needle.length < 2) return [];
  const hits: Array<{ path: string; line: number; text: string }> = [];
  for (const relative of ctx.allowedPaths) {
    if (hits.length >= MAX_SEARCH_RESULTS) break;
    if (isBinaryPath(relative)) continue;
    const resolved = resolveWithinWorktree(ctx.worktreePath, relative);
    if (!resolved.ok || !fs.existsSync(resolved.absolute!)) continue;
    const stat = fs.statSync(resolved.absolute!);
    if (!stat.isFile() || stat.size > MAX_READ_BYTES) continue;
    const lines = fs.readFileSync(resolved.absolute!, 'utf8').split(/\r?\n/);
    for (let i = 0; i < lines.length && hits.length < MAX_SEARCH_RESULTS; i += 1) {
      if (lines[i].includes(needle)) hits.push({ path: relative, line: i + 1, text: lines[i].slice(0, 300) });
    }
  }
  return hits;
}

export interface CommandOutcome {
  name: string;
  exitCode: number | null;
  timedOut: boolean;
  cancelled: boolean;
  stdout: string;
  stderr: string;
  durationMs: number;
}

/**
 * Runs one command from the registered allow-list. argv only — `shell: false`
 * means `&&`, `;`, `|` and friends in a model-supplied string are inert.
 */
export function runRegisteredCommand(ctx: ToolContext, name: string): Promise<CommandOutcome> {
  const spec = ctx.registeredCommands.get(name);
  if (!spec) {
    return Promise.reject(new CodingEngineError('POLICY_DENIED', `command not registered: ${name}`));
  }
  const startedAt = Date.now();
  return new Promise<CommandOutcome>(resolve => {
    const child = spawn(spec.command, spec.args, {
      cwd: spec.cwd,
      shell: false,
      windowsHide: true,
      env: minimalEnv(),
    });
    let stdout = '';
    let stderr = '';
    let bytes = 0;
    let timedOut = false;
    let cancelled = false;

    const append = (target: 'out' | 'err', chunk: Buffer) => {
      const remaining = Math.max(0, MAX_TOOL_OUTPUT - bytes);
      const accepted = chunk.subarray(0, remaining).toString('utf8');
      if (target === 'out') stdout += accepted;
      else stderr += accepted;
      bytes += chunk.length;
      if (bytes > MAX_TOOL_OUTPUT && !child.killed) child.kill();
    };

    const timer = setTimeout(() => {
      timedOut = true;
      if (!child.killed) child.kill();
    }, TOOL_TIMEOUT_MS);

    const onAbort = () => {
      cancelled = true;
      if (!child.killed) child.kill();
    };
    ctx.signal?.addEventListener('abort', onAbort, { once: true });

    child.stdout.on('data', chunk => append('out', Buffer.from(chunk)));
    child.stderr.on('data', chunk => append('err', Buffer.from(chunk)));
    const finish = (exitCode: number | null, extraErr = '') => {
      clearTimeout(timer);
      ctx.signal?.removeEventListener('abort', onAbort);
      resolve({
        name,
        exitCode: cancelled ? 1 : exitCode,
        timedOut,
        cancelled,
        stdout,
        stderr: (stderr + extraErr).trim(),
        durationMs: Date.now() - startedAt,
      });
    };
    child.on('error', err => finish(1, `\n${String((err as Error).message ?? err)}`));
    child.on('close', code => finish(typeof code === 'number' ? code : 1, cancelled ? '\nCANCELLED' : ''));
  });
}

export function minimalEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const key of ['PATH', 'Path', 'SystemRoot', 'WINDIR', 'COMSPEC', 'PATHEXT', 'HOME', 'USERPROFILE', 'TMP', 'TEMP']) {
    if (process.env[key]) env[key] = process.env[key];
  }
  // Suppress third-party telemetry for anything spawned under the engine.
  env.DO_NOT_TRACK = '1';
  env.NPM_CONFIG_FUND = 'false';
  env.NPM_CONFIG_AUDIT = 'false';
  env.NEXT_TELEMETRY_DISABLED = '1';
  return env;
}

function throwIfCancelled(ctx: ToolContext): void {
  if (ctx.signal?.aborted) throw new CodingEngineError('ENGINE_CRASHED', 'coding task cancelled');
}

export const TOOL_LIMITS = { MAX_READ_BYTES, MAX_SEARCH_RESULTS, MAX_TOOL_OUTPUT, TOOL_TIMEOUT_MS };
export const DENIED_PATH_PATTERNS = DENIED_PATTERNS;
