/**
 * Phase 7A.9 — canonical runtime preflight validator.
 *
 * Read-only diagnostics only. Never starts/stops a process, never writes to
 * a database, never mutates configuration. Designed to be run before any
 * boot/recovery action (7A.7) so that a bad runtime root, a stale path, or a
 * missing dependency fails loudly and specifically instead of producing a
 * confusing runtime crash minutes later.
 */
import fs from 'fs';
import path from 'path';
import net from 'net';

export type CheckStatus = 'PASS' | 'FAIL' | 'WARN' | 'SKIP';

export interface PreflightCheck {
  id: string;
  status: CheckStatus;
  detail: string;
}

export interface PreflightReport {
  runtimeRoot: string;
  generatedAt: string;
  checks: PreflightCheck[];
  overall: CheckStatus;
}

function check(id: string, status: CheckStatus, detail: string): PreflightCheck {
  return { id, status, detail };
}

function fileExists(p: string): boolean {
  try { return fs.existsSync(p); } catch { return false; }
}

function readJsonSafe<T>(p: string): T | null {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')) as T; } catch { return null; }
}

function readEnvKeys(envPath: string): Set<string> {
  const keys = new Set<string>();
  if (!fileExists(envPath)) return keys;
  const text = fs.readFileSync(envPath, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq > 0) keys.add(trimmed.slice(0, eq).trim());
  }
  return keys;
}

async function portReachable(port: number, host = '127.0.0.1', timeoutMs = 300): Promise<boolean> {
  return new Promise(resolve => {
    const socket = new net.Socket();
    let done = false;
    const finish = (result: boolean) => { if (done) return; done = true; socket.destroy(); resolve(result); };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
    socket.connect(port, host);
  });
}

interface EcosystemApp {
  name: string;
  script: string;
  cwd: string;
  env?: Record<string, string>;
  env_production?: Record<string, string>;
}

const INTENTIONALLY_STOPPED = new Set(['mi-ceo-observer', 'mi-whatsapp-gateway', 'mi-n8n']);

export async function runPreflight(runtimeRoot: string): Promise<PreflightReport> {
  const checks: PreflightCheck[] = [];
  const now = new Date().toISOString();

  // ── 1. Runtime root ─────────────────────────────────────────────────────
  if (!fileExists(runtimeRoot)) {
    checks.push(check('runtime-root', 'FAIL', `runtime root does not exist: ${runtimeRoot}`));
    return { runtimeRoot, generatedAt: now, checks, overall: 'FAIL' };
  }
  checks.push(check('runtime-root', 'PASS', runtimeRoot));

  // ── 2. .env presence + required key names (never values) ───────────────
  const envPath = path.join(runtimeRoot, '.env');
  if (!fileExists(envPath)) {
    checks.push(check('env-presence', 'FAIL', `.env not found at ${envPath}`));
  } else {
    const keys = readEnvKeys(envPath);
    const required = ['MI_DEPLOYED_SOURCE_SHA', 'MI_DEPLOYED_SOURCE_ROOT', 'GLOBAL_DIR', 'MI_CORE_API_KEY'];
    const missing = required.filter(k => !keys.has(k));
    if (missing.length > 0) {
      checks.push(check('env-presence', 'FAIL', `.env missing required key(s): ${missing.join(', ')}`));
    } else {
      checks.push(check('env-presence', 'PASS', `.env present, ${keys.size} keys, all required keys present`));
    }
  }

  // Re-read for downstream checks (names/paths only, never printed as secret values).
  const envKeys = readEnvKeys(envPath);
  const envText = fileExists(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
  function envValue(key: string): string | null {
    const match = envText.match(new RegExp(`^${key}=(.*)$`, 'm'));
    return match ? match[1].trim() : null;
  }

  // ── 3. GLOBAL_DIR / DB paths ─────────────────────────────────────────────
  const globalDir = envValue('GLOBAL_DIR');
  let globalDirOk = false;
  if (!globalDir) {
    checks.push(check('global-dir', 'FAIL', 'GLOBAL_DIR is not set in .env'));
  } else if (!fileExists(globalDir)) {
    checks.push(check('global-dir', 'FAIL', `GLOBAL_DIR does not exist: ${globalDir}`));
  } else {
    globalDirOk = true;
    checks.push(check('global-dir', 'PASS', globalDir));
  }

  const dbTargets: Array<{ id: string; rel: string }> = [
    { id: 'db-personal-os', rel: 'personal-os/personal-os.db' },
    { id: 'db-tasks', rel: 'task-runtime/tasks.db' },
    { id: 'db-projects', rel: 'project-registry/projects.db' },
  ];
  for (const target of dbTargets) {
    if (!globalDirOk || !globalDir) {
      checks.push(check(target.id, 'SKIP', 'GLOBAL_DIR unavailable'));
      continue;
    }
    const dbPath = path.join(globalDir, target.rel);
    if (!fileExists(dbPath)) {
      checks.push(check(target.id, 'FAIL', `database not found: ${dbPath}`));
      continue;
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const Database = require('better-sqlite3');
      const db = new Database(dbPath, { readonly: true });
      const integrity = db.pragma('integrity_check') as Array<{ integrity_check: string }>;
      const fk = db.pragma('foreign_key_check') as unknown[];
      db.close();
      const ok = integrity.length === 1 && integrity[0].integrity_check === 'ok' && fk.length === 0;
      checks.push(check(target.id, ok ? 'PASS' : 'FAIL', ok ? `integrity_check=ok, 0 FK violations` : `integrity_check=${JSON.stringify(integrity)}, FK violations=${fk.length}`));
    } catch (err) {
      checks.push(check(target.id, 'FAIL', `could not open database: ${err instanceof Error ? err.message : String(err)}`));
    }
  }

  // ── 4. Schema version ────────────────────────────────────────────────────
  if (globalDirOk && globalDir) {
    const personalOsPath = path.join(globalDir, 'personal-os/personal-os.db');
    if (fileExists(personalOsPath)) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const Database = require('better-sqlite3');
        const db = new Database(personalOsPath, { readonly: true });
        const row = db.prepare('SELECT MAX(version) v FROM schema_migrations').get() as { v: number | null };
        db.close();
        checks.push(check('schema-version', row.v === 10 ? 'PASS' : 'WARN', `personal-os.db schema v${row.v ?? 'unknown'} (expected v10)`));
      } catch (err) {
        checks.push(check('schema-version', 'FAIL', `could not read schema_migrations: ${err instanceof Error ? err.message : String(err)}`));
      }
    }
  } else {
    checks.push(check('schema-version', 'SKIP', 'GLOBAL_DIR unavailable'));
  }

  // ── 5. dist entrypoint ────────────────────────────────────────────────────
  const distEntry = path.join(runtimeRoot, 'server', 'dist', 'index.js');
  checks.push(check('dist-entrypoint', fileExists(distEntry) ? 'PASS' : 'FAIL', distEntry));

  // server/src must also be present — validateAuthorityStartup() reads it at
  // runtime, not just dist/ (a previously-discovered deploy requirement).
  const srcForAuthority = path.join(runtimeRoot, 'server', 'src', 'index.ts');
  checks.push(check('server-src-present', fileExists(srcForAuthority) ? 'PASS' : 'FAIL', srcForAuthority));

  // ── 6. Deploy-owned source snapshot + provenance alignment ──────────────
  const deployedSha = envValue('MI_DEPLOYED_SOURCE_SHA');
  const deployedRoot = envValue('MI_DEPLOYED_SOURCE_ROOT');
  if (!deployedSha || !deployedRoot) {
    checks.push(check('deploy-snapshot', 'FAIL', 'MI_DEPLOYED_SOURCE_SHA/_ROOT not set'));
  } else if (!fileExists(deployedRoot)) {
    checks.push(check('deploy-snapshot', 'FAIL', `snapshot root does not exist: ${deployedRoot}`));
  } else {
    const snapshotManifestPath = path.join(runtimeRoot, 'server', 'snapshot-manifest.json');
    const snapshotManifest = readJsonSafe<{ deployedSha?: string }>(snapshotManifestPath);
    const aligned = snapshotManifest?.deployedSha === deployedSha;
    checks.push(check('deploy-snapshot', aligned ? 'PASS' : 'FAIL', aligned
      ? `snapshot-manifest.json deployedSha matches .env MI_DEPLOYED_SOURCE_SHA (${deployedSha})`
      : `provenance mismatch: .env says ${deployedSha}, snapshot-manifest.json says ${snapshotManifest?.deployedSha ?? 'missing'}`));
  }

  // ── 7. Authority manifest ────────────────────────────────────────────────
  const manifestPath = path.join(runtimeRoot, 'server', 'authority-manifest.json');
  const manifest = readJsonSafe<{ counts?: { unknownMutations?: number; unresolvedLegacyMutations?: number } }>(manifestPath);
  if (!manifest) {
    checks.push(check('authority-manifest', 'FAIL', `authority-manifest.json not found or unreadable: ${manifestPath}`));
  } else {
    const unknown = manifest.counts?.unknownMutations ?? -1;
    const unresolved = manifest.counts?.unresolvedLegacyMutations ?? -1;
    const ok = unknown === 0 && unresolved === 0;
    checks.push(check('authority-manifest', ok ? 'PASS' : 'FAIL', `unknownMutations=${unknown}, unresolvedLegacyMutations=${unresolved}`));
  }

  // ── 8. PM2 ecosystem definitions ─────────────────────────────────────────
  const ecosystemPath = path.join(runtimeRoot, 'ecosystem.config.js');
  if (!fileExists(ecosystemPath)) {
    checks.push(check('pm2-ecosystem', 'FAIL', `ecosystem.config.js not found: ${ecosystemPath}`));
  } else {
    const raw = fs.readFileSync(ecosystemPath, 'utf8');
    const staleRefs = raw.match(/[DE]:[\\/]/g) ?? [];
    if (staleRefs.length > 0) {
      checks.push(check('pm2-stale-paths', 'FAIL', `${staleRefs.length} stale D:\\/E:\\ reference(s) found in ecosystem.config.js`));
    } else {
      checks.push(check('pm2-stale-paths', 'PASS', '0 stale D:\\/E:\\ references'));
    }

    let apps: EcosystemApp[] = [];
    try {
      delete require.cache[require.resolve(ecosystemPath)];
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const cfg = require(ecosystemPath) as { apps: EcosystemApp[] };
      apps = cfg.apps || [];
    } catch (err) {
      checks.push(check('pm2-ecosystem', 'FAIL', `could not load ecosystem.config.js: ${err instanceof Error ? err.message : String(err)}`));
    }

    if (apps.length > 0) {
      const names = apps.map(a => a.name);
      const duplicates = names.filter((n, i) => names.indexOf(n) !== i);
      checks.push(check('pm2-unique-names', duplicates.length === 0 ? 'PASS' : 'FAIL', duplicates.length === 0 ? `${names.length} apps, all unique` : `duplicate name(s): ${[...new Set(duplicates)].join(', ')}`));

      for (const app of apps) {
        const cwdOk = fileExists(app.cwd);
        const isInterpreterOnly = !app.script.includes('/') && !app.script.includes('\\') && !/\.(js|mjs|ts)$/.test(app.script);
        const scriptPath = isInterpreterOnly ? null : (path.isAbsolute(app.script) ? app.script : path.join(app.cwd, app.script));
        const scriptOk = isInterpreterOnly || (scriptPath !== null && fileExists(scriptPath));
        const ok = cwdOk && scriptOk;
        // A core service missing its cwd/script is a hard FAIL — recovery
        // would crash-loop. An intentionally-stopped service missing its
        // code is expected/acceptable (nothing tries to start it) and only
        // needs a WARN, so it doesn't mask a real regression in the fleet
        // that's actually supposed to be running.
        const status: CheckStatus = ok ? 'PASS' : (INTENTIONALLY_STOPPED.has(app.name) ? 'WARN' : 'FAIL');
        checks.push(check(`pm2-app:${app.name}`, status, ok
          ? `cwd and script exist${INTENTIONALLY_STOPPED.has(app.name) ? ' (intentionally stopped — must not auto-start)' : ''}`
          : `cwd_exists=${cwdOk} script_exists=${scriptOk} (cwd=${app.cwd}, script=${scriptPath ?? app.script})${INTENTIONALLY_STOPPED.has(app.name) ? ' — intentionally stopped, not auto-started, not blocking' : ''}`));
      }
    }
  }

  // ── 9. Ports — report reachability only, never bind/kill anything ───────
  const portTargets: Array<{ id: string; port: number; expectOnline: boolean }> = [
    { id: 'port-mi-core-4001', port: 4001, expectOnline: true },
    { id: 'port-mi-ai-service-4002', port: 4002, expectOnline: true },
  ];
  for (const target of portTargets) {
    const reachable = await portReachable(target.port);
    checks.push(check(target.id, 'PASS', `port ${target.port} ${reachable ? 'is in use (expected if the service is meant to be running)' : 'is free'}`));
  }

  // ── 10. Required dependencies present ────────────────────────────────────
  checks.push(check('server-node-modules', fileExists(path.join(runtimeRoot, 'server', 'node_modules')) ? 'PASS' : 'FAIL', path.join(runtimeRoot, 'server', 'node_modules')));
  checks.push(check('command-center-dist', fileExists(path.join(runtimeRoot, 'command-center', 'dist')) ? 'PASS' : 'FAIL', path.join(runtimeRoot, 'command-center', 'dist')));

  const hasFail = checks.some(c => c.status === 'FAIL');
  const hasWarn = checks.some(c => c.status === 'WARN');
  const overall: CheckStatus = hasFail ? 'FAIL' : hasWarn ? 'WARN' : 'PASS';

  return { runtimeRoot, generatedAt: now, checks, overall };
}

export function intentionallyStoppedServices(): string[] {
  return [...INTENTIONALLY_STOPPED];
}
