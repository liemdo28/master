import assert from 'assert';
import express from 'express';
import type { AddressInfo } from 'net';
import type { NextFunction, Request, Response } from 'express';
import {
  MONITORED_SERVICES, checkHttpService, checkPm2Service, personalOsIntegrityIsHealthy, type ServiceCheck,
} from '../self-healing-monitor';

const API_KEY = 'selfheal-probe-test-key';

function requireApiKey(req: Request, res: Response, next: NextFunction) {
  if (String(req.headers['x-api-key'] || '') !== API_KEY) return res.status(401).json({ error: 'Unauthorized' });
  return next();
}

interface Stub { port: number; close: () => Promise<void> }

function listen(app: express.Express): Promise<Stub> {
  return new Promise(resolve => {
    const server = app.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve({ port, close: () => new Promise<void>((ok, no) => server.close(e => e ? no(e) : ok())) });
    });
  });
}

/**
 * Stands in for Mi Core: every /api route is behind the API-key guard, and the
 * generic /api/knowledge/:id route exists so the shadowing case is reproducible.
 */
function miCoreStub(integrity: unknown, redirectTo?: string) {
  const app = express();
  app.use('/api', requireApiKey);
  app.get('/api/health', (_req, res) => {
    if (redirectTo) return res.redirect(302, redirectTo);
    return res.json({ server: 'ok' });
  });
  app.get('/api/company-os/health', (_req, res) => res.json({ status: 'ok' }));
  app.get('/api/personal/integrity', (_req, res) => res.json(integrity));
  app.get('/api/knowledge/conflicts', (_req, res) => res.json({ conflicts: [] }));
  app.get('/api/knowledge/:id', (req, res) => {
    const valid = /^knowledge-[0-9a-f-]{36}$/i.test(req.params.id);
    return valid ? res.json({ id: req.params.id }) : res.status(400).json({ error: 'invalid knowledge id' });
  });
  return app;
}

function probe(url: string, authenticated: boolean, validateBody?: (b: unknown) => boolean): ServiceCheck {
  return { id: 'probe', name: 'Probe', type: 'http', critical: false, health_url: url, authenticated, validateBody };
}

const healthyIntegrity = { integrityCheck: 'ok', foreignKeyViolations: [] };

async function run() {
  const previousKey = process.env.MI_CORE_API_KEY;
  process.env.MI_CORE_API_KEY = API_KEY;

  const stub = await listen(miCoreStub(healthyIntegrity));
  const at = (route: string) => `http://127.0.0.1:${stub.port}${route}`;

  // --- the routes the monitor actually probes -------------------------------
  // evidence-db/knowledge-db moved to type:'internal' in Phase 7B (direct
  // in-process calls — no HTTP round-trip, so they can never be starved by
  // the global rate limiter; see self-healing-rate-limit-regression.test.ts).
  // These two checkHttpService() calls below now exercise generic HTTP-probe
  // behavior against arbitrary stub routes, not the evidence-db/knowledge-db
  // checks themselves — checkHttpService remains the real, still-used probe
  // for every genuinely HTTP-backed MONITORED_SERVICES entry (mi-core-http,
  // accounting-http, ollama).
  assert.strictEqual(await checkHttpService(probe(at('/api/health'), true)), true,
    'authenticated /api/health probe reports healthy');
  assert.strictEqual(await checkHttpService(probe(at('/api/company-os/health'), true)), true,
    'checkHttpService still reports healthy for a generic authenticated 200');

  // The Knowledge DB body-validation logic (integrity_check ok + zero FK
  // violations) is now exercised directly, in-process — see the corrupt/
  // fkBroken assertions below using personalOsIntegrityIsHealthy() rather
  // than round-tripping through HTTP.
  assert.strictEqual(personalOsIntegrityIsHealthy(healthyIntegrity), true,
    'a clean integrity report is healthy');

  // --- the defects this change fixes ---------------------------------------
  assert.strictEqual(await checkHttpService(probe(at('/health'), true)), false,
    'the old unprefixed /health route is a 404 and must not be used');
  assert.strictEqual(await checkHttpService(probe(at('/api/health'), false)), false,
    'an unauthenticated probe of a guarded route is a false alarm, so auth is required');
  assert.strictEqual(await checkHttpService(probe(at('/api/knowledge/health'), true)), false,
    'the generic /api/knowledge/:id route shadows /api/knowledge/health and returns 400');

  // --- credential handling --------------------------------------------------
  process.env.MI_CORE_API_KEY = 'wrong-key';
  assert.strictEqual(await checkHttpService(probe(at('/api/health'), true)), false,
    'an invalid credential reports unhealthy rather than being treated as success');

  delete process.env.MI_CORE_API_KEY;
  assert.strictEqual(await checkHttpService(probe(at('/api/health'), true)), false,
    'with no credential configured the probe reports unhealthy instead of dropping the guard');
  process.env.MI_CORE_API_KEY = API_KEY;

  // The key must never travel to a non-loopback host, even if a URL is misconfigured.
  assert.strictEqual(await checkHttpService(probe('http://example.com/api/health', true)), false,
    'authenticated probes are refused for non-loopback hosts');

  // --- body validation, not just HTTP 200 ----------------------------------
  // Tested directly against the same logic checkPersonalOsIntegrityInternal()
  // now calls in-process, rather than round-tripping through HTTP.
  assert.strictEqual(personalOsIntegrityIsHealthy({ integrityCheck: 'malformed database', foreignKeyViolations: [] }), false,
    'a report claiming corruption is not healthy');
  assert.strictEqual(personalOsIntegrityIsHealthy({ integrityCheck: 'ok', foreignKeyViolations: [{ table: 'goals' }] }), false,
    'foreign-key violations are not healthy');

  // --- credentials are not forwarded across a redirect ---------------------
  // fetch does not strip custom headers on cross-origin redirects, so following
  // one would hand x-api-key to the redirect target and judge health from it.
  let leakedKey: string | null = null;
  const collector = express();
  collector.get('/steal', (req, res) => {
    leakedKey = (req.headers['x-api-key'] as string) || null;
    res.json({ server: 'ok' });
  });
  const evil = await listen(collector);
  const redirector = await listen(miCoreStub(healthyIntegrity, `http://127.0.0.1:${evil.port}/steal`));

  const redirectResult = await checkHttpService(probe(`http://127.0.0.1:${redirector.port}/api/health`, true));
  assert.strictEqual(leakedKey, null, 'the API key must not reach a redirect target');
  assert.strictEqual(redirectResult, false, 'a redirecting health endpoint is not reported healthy');
  await evil.close();
  await redirector.close();

  // --- the key is never written to logs ------------------------------------
  const writes: string[] = [];
  const origLog = console.log;
  const origErr = console.error;
  console.log = (...a: unknown[]) => { writes.push(a.map(String).join(' ')); };
  console.error = (...a: unknown[]) => { writes.push(a.map(String).join(' ')); };
  try {
    await checkHttpService(probe(at('/api/health'), true));
    await checkHttpService(probe(at('/api/knowledge/health'), true));
    await checkHttpService(probe('http://127.0.0.1:1/api/health', true));
  } finally {
    console.log = origLog;
    console.error = origErr;
  }
  assert.ok(!writes.some(line => line.includes(API_KEY)), 'the API key is never logged');

  // --- real outages are still detected -------------------------------------
  await stub.close();
  assert.strictEqual(await checkHttpService(probe(at('/api/health'), true)), false,
    'a stopped service is still detected as down');
  assert.strictEqual(await checkHttpService(probe('http://127.0.0.1:1/api/health', false)), false,
    'an unreachable port is detected as down');

  // A PM2 process that genuinely does not exist must stay down.
  assert.strictEqual(
    await checkPm2Service({ id: 'ghost', name: 'Ghost', type: 'pm2', pm2_name: 'definitely-not-a-real-pm2-process', critical: false }),
    false,
    'a missing PM2 process is reported down');

  // --- registered configuration matches the fixed contract -----------------
  const byId = new Map(MONITORED_SERVICES.map(s => [s.id, s]));

  const miCoreHttp = byId.get('mi-core-http')!;
  assert.ok(miCoreHttp.health_url?.endsWith('/api/health'), 'Mi Core HTTP probes /api/health');
  assert.strictEqual(miCoreHttp.authenticated, true, 'Mi Core HTTP probe is authenticated');

  // Phase 7B: evidence-db/knowledge-db are type:'internal' — no health_url,
  // no authenticated flag, no HTTP validateBody. They can never be starved by
  // the rate limiter because they never make an HTTP request at all.
  const evidenceDb = byId.get('evidence-db')!;
  assert.strictEqual(evidenceDb.type, 'internal', 'Evidence DB probe is internal, not HTTP');
  assert.strictEqual(typeof evidenceDb.check, 'function', 'Evidence DB probe carries a direct check() function');
  assert.strictEqual(evidenceDb.health_url, undefined, 'Evidence DB probe has no health_url — no HTTP path exists to regress back to');

  const knowledgeCheck = byId.get('knowledge-db')!;
  assert.strictEqual(knowledgeCheck.type, 'internal', 'Knowledge DB probe is internal, not HTTP');
  assert.strictEqual(typeof knowledgeCheck.check, 'function', 'Knowledge DB probe carries a direct check() function');
  assert.strictEqual(knowledgeCheck.health_url, undefined, 'Knowledge DB probe has no health_url — no HTTP path exists to regress back to');

  // The standalone food-safety-gateway entry is retired — superseded, not missing.
  assert.ok(!byId.has('food-safety-gw'),
    'the retired standalone Food Safety Gateway entry is gone');
  assert.ok(!MONITORED_SERVICES.some(s => s.pm2_name === 'food-safety-gateway'),
    'nothing monitors the standalone food-safety-gateway process any more');

  // ...but the process that actually runs food-safety must stay monitored, and stay
  // critical. This is the guard that stops the retirement from silencing real coverage.
  const gateway = byId.get('whatsapp-gateway')!;
  assert.strictEqual(gateway.pm2_name, 'mi-whatsapp-gateway',
    'food-safety now runs inside mi-whatsapp-gateway, which remains monitored');
  assert.strictEqual(gateway.type, 'pm2',
    'the food-safety host is monitored as a PM2 process, so a stopped gateway is detected');
  assert.strictEqual(gateway.critical, true,
    'the process hosting food-safety is monitored as critical');

  // Third-party endpoints must stay unauthenticated — Mi Core's key is not theirs.
  assert.ok(!byId.get('ollama')!.authenticated, 'Ollama probe stays unauthenticated');
  assert.ok(!byId.get('accounting-http')!.authenticated, 'Accounting probe stays unauthenticated');

  if (previousKey === undefined) delete process.env.MI_CORE_API_KEY;
  else process.env.MI_CORE_API_KEY = previousKey;

  console.log('[self-healing-probe] PASS');
}

run().catch(err => {
  console.error('[self-healing-probe] FAIL:', err);
  process.exit(1);
});
