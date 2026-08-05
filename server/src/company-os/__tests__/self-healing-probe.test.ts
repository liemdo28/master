import assert from 'assert';
import express from 'express';
import type { AddressInfo } from 'net';
import type { NextFunction, Request, Response } from 'express';
import { MONITORED_SERVICES, checkHttpService, type ServiceCheck } from '../self-healing-monitor';

const API_KEY = 'selfheal-probe-test-key';

function requireApiKey(req: Request, res: Response, next: NextFunction) {
  if (String(req.headers['x-api-key'] || '') !== API_KEY) return res.status(401).json({ error: 'Unauthorized' });
  return next();
}

/**
 * Stands in for Mi Core: every /api route is behind the API-key guard, and the
 * generic /api/knowledge/:id route exists so the shadowing case is reproducible.
 */
async function startMiCoreStub(): Promise<{ port: number; close: () => Promise<void> }> {
  const app = express();
  app.use('/api', requireApiKey);
  app.get('/api/health', (_req, res) => res.json({ server: 'ok' }));
  app.get('/api/company-os/health', (_req, res) => res.json({ status: 'ok' }));
  app.get('/api/personal/integrity', (_req, res) => res.json({ integrityCheck: 'ok', foreignKeyViolations: [] }));
  app.get('/api/knowledge/conflicts', (_req, res) => res.json({ conflicts: [] }));
  app.get('/api/knowledge/:id', (req, res) => {
    const valid = /^knowledge-[0-9a-f-]{36}$/i.test(req.params.id);
    return valid ? res.json({ id: req.params.id }) : res.status(400).json({ error: 'invalid knowledge id' });
  });
  return new Promise(resolve => {
    const server = app.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve({ port, close: () => new Promise<void>((ok, no) => server.close(e => e ? no(e) : ok())) });
    });
  });
}

function probe(port: number, route: string, authenticated: boolean): ServiceCheck {
  return {
    id: 'probe', name: 'Probe', type: 'http', critical: false,
    health_url: `http://127.0.0.1:${port}${route}`,
    authenticated,
  };
}

async function run() {
  const stub = await startMiCoreStub();
  const previousKey = process.env.MI_CORE_API_KEY;
  process.env.MI_CORE_API_KEY = API_KEY;

  // --- the three routes the monitor actually probes -------------------------
  assert.strictEqual(await checkHttpService(probe(stub.port, '/api/health', true)), true,
    'authenticated /api/health probe reports healthy');
  assert.strictEqual(await checkHttpService(probe(stub.port, '/api/company-os/health', true)), true,
    'authenticated Evidence DB probe reports healthy');
  assert.strictEqual(await checkHttpService(probe(stub.port, '/api/personal/integrity', true)), true,
    'authenticated Knowledge DB probe reports healthy');

  // --- the defects this change fixes ---------------------------------------
  assert.strictEqual(await checkHttpService(probe(stub.port, '/health', true)), false,
    'the old unprefixed /health route is a 404 and must not be used');
  assert.strictEqual(await checkHttpService(probe(stub.port, '/api/health', false)), false,
    'an unauthenticated probe of a guarded route is a false alarm, so auth is required');
  assert.strictEqual(await checkHttpService(probe(stub.port, '/api/knowledge/health', true)), false,
    'the generic /api/knowledge/:id route shadows /api/knowledge/health and returns 400');

  // --- auth is never weakened ----------------------------------------------
  delete process.env.MI_CORE_API_KEY;
  assert.strictEqual(await checkHttpService(probe(stub.port, '/api/health', true)), false,
    'with no credential configured the probe reports unhealthy instead of dropping the guard');
  process.env.MI_CORE_API_KEY = API_KEY;

  // --- a genuinely unreachable target is still detected ---------------------
  await stub.close();
  assert.strictEqual(await checkHttpService(probe(stub.port, '/api/health', true)), false,
    'a stopped service is still detected as down');

  const unreachable: ServiceCheck = {
    id: 'unreachable', name: 'Unreachable', type: 'http', critical: false,
    health_url: 'http://127.0.0.1:1/api/health', authenticated: false,
  };
  assert.strictEqual(await checkHttpService(unreachable), false, 'an unreachable port is detected as down');

  // --- registered configuration matches the fixed contract -----------------
  const byId = new Map(MONITORED_SERVICES.map(s => [s.id, s]));

  const miCoreHttp = byId.get('mi-core-http')!;
  assert.ok(miCoreHttp.health_url?.endsWith('/api/health'), 'Mi Core HTTP probes /api/health');
  assert.strictEqual(miCoreHttp.authenticated, true, 'Mi Core HTTP probe is authenticated');

  const evidence = byId.get('evidence-db')!;
  assert.strictEqual(evidence.authenticated, true, 'Evidence DB probe is authenticated');

  const knowledge = byId.get('knowledge-db')!;
  assert.ok(!knowledge.health_url?.includes('/api/knowledge/'),
    'Knowledge DB no longer probes a route that /api/knowledge/:id can shadow');
  assert.strictEqual(knowledge.authenticated, true, 'Knowledge DB probe is authenticated');

  assert.strictEqual(byId.get('whatsapp-gateway')!.pm2_name, 'mi-whatsapp-gateway',
    'WhatsApp Gateway is monitored under its real PM2 process name');

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
