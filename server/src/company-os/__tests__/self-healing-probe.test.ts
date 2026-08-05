import assert from 'assert';
import express from 'express';
import type { AddressInfo } from 'net';
import type { NextFunction, Request, Response } from 'express';
import {
  MONITORED_SERVICES, checkHttpService, checkPm2Service, type ServiceCheck,
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

  // --- the routes the monitor actually probes ------------------------------
  assert.strictEqual(await checkHttpService(probe(at('/api/health'), true)), true,
    'authenticated /api/health probe reports healthy');
  assert.strictEqual(await checkHttpService(probe(at('/api/company-os/health'), true)), true,
    'authenticated Evidence DB probe reports healthy');

  const knowledgeCheck = MONITORED_SERVICES.find(s => s.id === 'knowledge-db')!;
  assert.strictEqual(
    await checkHttpService(probe(at('/api/personal/integrity'), true, knowledgeCheck.validateBody)), true,
    'authenticated Knowledge DB probe reports healthy on a clean integrity report');

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
  const corrupt = await listen(miCoreStub({ integrityCheck: 'malformed database', foreignKeyViolations: [] }));
  assert.strictEqual(
    await checkHttpService(probe(`http://127.0.0.1:${corrupt.port}/api/personal/integrity`, true, knowledgeCheck.validateBody)),
    false,
    'a 200 response reporting corruption is not healthy');
  const fkBroken = await listen(miCoreStub({ integrityCheck: 'ok', foreignKeyViolations: [{ table: 'goals' }] }));
  assert.strictEqual(
    await checkHttpService(probe(`http://127.0.0.1:${fkBroken.port}/api/personal/integrity`, true, knowledgeCheck.validateBody)),
    false,
    'foreign-key violations are not healthy');
  await corrupt.close();
  await fkBroken.close();

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

  assert.strictEqual(byId.get('evidence-db')!.authenticated, true, 'Evidence DB probe is authenticated');

  assert.ok(!knowledgeCheck.health_url?.includes('/api/knowledge/'),
    'Knowledge DB no longer probes a route that /api/knowledge/:id can shadow');
  assert.strictEqual(knowledgeCheck.authenticated, true, 'Knowledge DB probe is authenticated');
  assert.ok(typeof knowledgeCheck.validateBody === 'function',
    'Knowledge DB validates the integrity body, not just the status code');

  assert.strictEqual(byId.get('whatsapp-gateway')!.pm2_name, 'mi-whatsapp-gateway',
    'WhatsApp Gateway is monitored under its real PM2 process name');

  // Food Safety Gateway stays monitored: if the process is absent that is a real
  // outage, and hiding it would defeat the NO_SILENT_FAILURE goal.
  assert.strictEqual(byId.get('food-safety-gw')!.pm2_name, 'food-safety-gateway',
    'Food Safety Gateway remains monitored under its own process name');

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
