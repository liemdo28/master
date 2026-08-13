/**
 * Phase 7B — health/dependency truth model security tests.
 *
 * Covers: secret/config-value leakage, unauthenticated access to detailed
 * health, local-path leakage, forged/overridden health state, authority
 * misrepresentation, intentionally-disabled misclassification, and
 * disconnected-connector misclassification. Group 1 is structural
 * (source-text, matching the established phase7a-security.test.ts /
 * automation-simulation-security.test.ts pattern); group 2 boots a real HTTP
 * server with the exact production auth logic and hits the real routers.
 */
import assert from 'assert';
import express from 'express';
import fs from 'fs';
import path from 'path';
import type { AddressInfo } from 'net';
import type { NextFunction, Request, Response } from 'express';
import { healthPublicRouter } from '../public-router';
import { healthDetailRouter } from '../detail-router';
import { computeOverall } from '../aggregate';
import { probeIntentionallyDisabled } from '../probes';

const API_KEY = 'phase7b-security-test-key';
const SRC_DIR = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..');

function readSrc(file: string): string {
  return fs.readFileSync(path.join(SRC_DIR, file), 'utf8');
}

function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

// ── Group 1: structural checks ───────────────────────────────────────────────
function runStructuralChecks(): number {
  let n = 0;

  // Neither router file reads req.query/req.body/req.params into the response —
  // a health route that lets the caller influence the reported state is a
  // forged-state vector by construction, regardless of what a live HTTP probe
  // happens to catch.
  for (const file of ['public-router.ts', 'detail-router.ts']) {
    n++;
    const code = stripComments(readSrc(file));
    assert.ok(!code.includes('req.query'), `${file} must never read req.query — a client must not be able to influence reported health`);
    assert.ok(!code.includes('req.body'), `${file} must never read req.body`);
    assert.ok(!code.includes('req.params'), `${file} must never read req.params`);
  }

  // Neither router imports a mutation-capable module (PM2 control, process
  // control, exec) — health reporting must stay strictly read-only.
  for (const file of ['public-router.ts', 'detail-router.ts', 'aggregate.ts', 'probes.ts']) {
    n++;
    const code = stripComments(readSrc(file));
    for (const forbidden of ['child_process', 'pm2 restart', 'pm2 stop', 'pm2 start', "require('pm2')"]) {
      assert.ok(!code.includes(forbidden), `${file} must not reference ${forbidden} — health-truth is observe-only, see PHASE7B_HEALTH_BOUNDARY.md`);
    }
  }

  // index.ts must mount healthDetailRouter behind the same two production auth
  // middlewares every other Command-Center/API-key-gated router uses — not a
  // bespoke, weaker check.
  n++;
  const indexSrc = readSrc(path.join('..', 'index.ts'));
  assert.ok(/app\.use\(\s*['"`]\/api\/command-center['"`][^;]*requireRemoteAuth[^;]*healthDetailRouter/.test(indexSrc.replace(/\s+/g, ' ')),
    'healthDetailRouter must be mounted at /api/command-center behind requireRemoteAuth');
  assert.ok(/app\.use\(\s*['"`]\/api['"`][^;]*requireTaskRuntimeAuth[^;]*healthDetailRouter/.test(indexSrc.replace(/\s+/g, ' ')),
    'healthDetailRouter must be mounted at /api behind requireTaskRuntimeAuth');
  assert.ok(/app\.use\(\s*['"`]\/api\/health['"`]\s*,\s*healthPublicRouter\s*\)/.test(indexSrc.replace(/\s+/g, ' ')),
    'healthPublicRouter must be mounted unauthenticated only at /api/health, with no extra auth middleware that could be silently dropped');

  return n;
}

// ── Group 2: live HTTP auth boundary (mirrors requireTaskRuntimeAuth's exact
//    x-api-key logic from index.ts — that function itself is not exported) ────
function taskRuntimeAuth(req: Request, res: Response, next: NextFunction) {
  const supplied = String(req.headers['x-api-key'] || '');
  if (supplied && supplied === API_KEY) return next();
  return res.status(401).json({ error: 'Unauthorized' });
}

async function startApi() {
  const app = express();
  app.use('/api/health', healthPublicRouter);
  app.use('/api', taskRuntimeAuth, healthDetailRouter);
  return new Promise<{ baseUrl: string; close: () => Promise<void> }>(resolve => {
    const server = app.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve({
        baseUrl: `http://127.0.0.1:${port}`,
        close: () => new Promise<void>((ok, no) => server.close(e => (e ? no(e) : ok()))),
      });
    });
  });
}

const SECRET_ENV_KEYS = ['MI_CORE_API_KEY', 'AGENT_CODING_API_KEY', 'GOOGLE_CLIENT_SECRET', 'JWT_SECRET', 'SESSION_SECRET'];

/** Recursively collects every string value in a JSON-shaped payload. */
function collectStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach(v => collectStrings(v, out));
  else if (value && typeof value === 'object') Object.values(value).forEach(v => collectStrings(v, out));
  return out;
}

async function runLiveChecks(): Promise<number> {
  let n = 0;
  const { baseUrl, close } = await startApi();
  try {
    // ── public liveness needs no auth, and its shape is exactly the legacy
    //    fields plus `overall` — nothing else ──────────────────────────────
    n++;
    {
      const res = await fetch(`${baseUrl}/api/health`);
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      const keys = Object.keys(body).sort();
      assert.deepStrictEqual(keys, ['ollama', 'overall', 'python_ai_service', 'server', 'timestamp']);
    }

    // ── detailed health requires auth ───────────────────────────────────────
    n++;
    {
      const res = await fetch(`${baseUrl}/api/health/detail`);
      assert.strictEqual(res.status, 401, 'unauthenticated GET /api/health/detail must be rejected');
    }
    n++;
    {
      const res = await fetch(`${baseUrl}/api/health/dependencies`);
      assert.strictEqual(res.status, 401, 'unauthenticated GET /api/health/dependencies must be rejected');
    }
    n++;
    {
      const res = await fetch(`${baseUrl}/api/health/detail`, { headers: { 'x-api-key': 'wrong-key' } });
      assert.strictEqual(res.status, 401, 'wrong API key must be rejected, not merely "no key"');
    }

    // ── forged/overridden health state: query-string attempts to inject a
    //    fake overall/state must have zero effect on the computed response ──
    n++;
    {
      const res = await fetch(`${baseUrl}/api/health/detail?overall=HEALTHY&dependencies=[]`, { headers: { 'x-api-key': API_KEY } });
      assert.strictEqual(res.status, 200);
      const body = await res.json() as { overall: string; dependencies: unknown[] };
      // The route computes its own overall via computeOverall(); it can never
      // literally be the string "[]" for dependencies (an injected empty array),
      // and overall must be one of the real enum values, not a client-supplied
      // arbitrary echo.
      assert.ok(Array.isArray(body.dependencies) && body.dependencies.length > 0, 'query-string injection must not truncate the real dependency list');
      assert.ok(['HEALTHY', 'DEGRADED', 'UNAVAILABLE', 'BLOCKED'].includes(body.overall));
    }

    // ── secret/config-value and local-path leakage ──────────────────────────
    n++;
    {
      const res = await fetch(`${baseUrl}/api/health/detail`, { headers: { 'x-api-key': API_KEY } });
      const raw = await res.text();
      for (const key of SECRET_ENV_KEYS) {
        const value = process.env[key];
        if (value && value.length >= 6) {
          assert.ok(!raw.includes(value), `response body leaked the real value of ${key}`);
        }
      }
      // No raw Windows absolute path under any of this project's known drive
      // roots may appear — only short, non-identifying detail strings.
      const driveRootPattern = /\b[A-Za-z]:\\(Projects|Project)\\/;
      assert.ok(!driveRootPattern.test(raw), 'response body leaked a local absolute filesystem path');
      assert.ok(!raw.toLowerCase().includes(REPO_ROOT.toLowerCase().split(path.sep).slice(-2).join(path.sep).toLowerCase()),
        'response body leaked a fragment of the real repo root path');
    }

    // ── every value in every string field must not look like a bearer token /
    //    API key shape (defense in depth beyond the specific-env-var check above) ─
    n++;
    {
      const res = await fetch(`${baseUrl}/api/health/dependencies`, { headers: { 'x-api-key': API_KEY } });
      const body = await res.json();
      const strings = collectStrings(body);
      const secretShapePattern = /\b(sk-[A-Za-z0-9]{16,}|ya29\.[A-Za-z0-9_-]{16,}|AIza[A-Za-z0-9_-]{16,}|xox[baprs]-[A-Za-z0-9-]{10,})\b/;
      for (const s of strings) {
        assert.ok(!secretShapePattern.test(s), `a dependency detail/capabilityImpact string matched a known secret shape: ${s}`);
      }
    }
  } finally {
    await close();
  }
  return n;
}

// ── Group 3: misclassification proofs (pure, synthetic dependency sets) ─────
function runMisclassificationChecks(): number {
  let n = 0;

  // Intentionally-disabled services must never be classified as unhealthy
  // regardless of whether their runtime code directory happens to exist.
  n++;
  {
    const withCode = probeIntentionallyDisabled('WHATSAPP', REPO_ROOT);
    const withoutCode = probeIntentionallyDisabled('N8N', path.join(REPO_ROOT, 'does-not-exist'));
    for (const result of [withCode, withoutCode]) {
      assert.strictEqual(result.state, 'INTENTIONALLY_DISABLED');
      assert.notStrictEqual(result.state, 'UNAVAILABLE');
      assert.notStrictEqual(result.state, 'DEGRADED');
    }
  }

  // A disconnected connector (FEATURE_SCOPED) must never escalate the overall
  // verdict past DEGRADED, and must never be silently reported HEALTHY either.
  n++;
  {
    const deps = [
      { id: 'CORE' as const, state: 'HEALTHY' as const, criticality: 'REQUIRED_FOR_CORE' as const, reasonCode: 'OK' as const, detail: '', capabilityImpact: [], lastCheckedAt: null, lastHealthyAt: null, lastFailureAt: null },
      { id: 'AUTHORITY' as const, state: 'HEALTHY' as const, criticality: 'REQUIRED_FOR_CORE' as const, reasonCode: 'OK' as const, detail: '', capabilityImpact: [], lastCheckedAt: null, lastHealthyAt: null, lastFailureAt: null },
      { id: 'GOOGLE_CONNECTORS' as const, state: 'DISCONNECTED' as const, criticality: 'FEATURE_SCOPED' as const, reasonCode: 'OAUTH_DISCONNECTED' as const, detail: '', capabilityImpact: ['Gmail draft creation and Calendar event creation are unavailable.'], lastCheckedAt: null, lastHealthyAt: null, lastFailureAt: null },
    ];
    const { overall } = computeOverall(deps);
    assert.strictEqual(overall, 'DEGRADED');
    assert.notStrictEqual(overall, 'HEALTHY', 'a disconnected connector must not be silently reported as fully healthy');
    assert.notStrictEqual(overall, 'UNAVAILABLE', 'a disconnected FEATURE_SCOPED connector must never escalate to UNAVAILABLE');
    assert.notStrictEqual(overall, 'BLOCKED', 'only AUTHORITY may produce BLOCKED');
  }

  return n;
}

async function run(): Promise<void> {
  let scenarios = 0;
  scenarios += runStructuralChecks();
  scenarios += await runLiveChecks();
  scenarios += runMisclassificationChecks();
  console.log(`[phase7b-health-truth-security] PASS — ${scenarios} scenarios verified`);
}

run().catch(err => { console.error(err); process.exit(1); });
