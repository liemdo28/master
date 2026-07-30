// api/server.js - Express API bound ONLY to 127.0.0.1:8844 (never 0.0.0.0)
import express         from 'express';
import cors            from 'cors';
import { execSync }    from 'child_process';
import { openDatabase } from '../core/DatabaseManager.js';
import { statsRouter }    from './routes/stats.js';
import { qaRouter }       from './routes/qa.js';
import { patchesRouter }  from './routes/patches.js';
import { sessionsRouter } from './routes/sessions.js';
import { modelsRouter }   from './routes/models.js';
import { costsRouter }    from './routes/costs.js';
import { risksRouter }    from './routes/risks.js';

const HOST = '127.0.0.1';   // POLICY: local-only, never 0.0.0.0
const PORT = parseInt(process.env.ACCOUNTING_API_PORT || '8844', 10);

async function isHealthy(port) {
  try {
    const res = await fetch(`http://${HOST}:${port}/health`, { signal: AbortSignal.timeout(1000) });
    if (!res.ok) return false;
    const data = await res.json();
    return data?.ok === true;
  } catch {
    return false;
  }
}

function getPortOwner(port) {
  try {
    const output = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' });
    const line = output.split(/\r?\n/).find(l => l.includes('LISTENING'));
    return line ? line.trim().split(/\s+/).pop() : null;
  } catch {
    return null;
  }
}

export function createApp(db) {
  const app = express();

  app.use(cors({ origin: (origin, cb) => cb(null, !origin || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) }));
  app.use(express.json());

  // Security: reject any request that isn't from localhost
  app.use((req, res, next) => {
    const remoteAddr = req.socket.remoteAddress;
    if (remoteAddr !== '127.0.0.1' && remoteAddr !== '::1' && remoteAddr !== '::ffff:127.0.0.1') {
      return res.status(403).json({ error: 'forbidden: local access only' });
    }
    next();
  });

  app.get('/health', (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

  app.use('/stats',    statsRouter(db));
  app.use('/qa',       qaRouter(db));
  app.use('/patches',  patchesRouter(db));
  app.use('/sessions', sessionsRouter(db));
  app.use('/models',   modelsRouter(db));
  app.use('/costs',    costsRouter(db));
  app.use('/risks',    risksRouter(db));

  // 404 handler
  app.use((_req, res) => res.status(404).json({ error: 'not found' }));

  // Error handler
  app.use((err, _req, res, _next) => {
    console.error('[API]', err.message);
    res.status(500).json({ error: err.message });
  });

  return app;
}

// Run directly OR via PM2 ProcessContainerFork (argv[1] will be ContainerFork path)
const _isMain = process.argv[1] && (
  process.argv[1].endsWith('server.js') ||
  process.argv[1].includes('ProcessContainerFork')
);
if (_isMain) {
  const db  = openDatabase();
  const app = createApp(db);
  const server = app.listen(PORT, HOST, () => {
    console.log(`[API] listening on http://127.0.0.1:${PORT}`);
  });

  server.on('error', async (err) => {
    if (err.code !== 'EADDRINUSE') throw err;

    if (await isHealthy(PORT)) {
      console.log(`[API] ACCOUNTING_API_ALREADY_RUNNING http://${HOST}:${PORT}/health`);
      console.log('[API] Existing accounting API is healthy. Treating as PASS.');
      db.close?.();
      process.exit(0);
    }

    const pid = getPortOwner(PORT);
    console.error(`[API] Port ${PORT} is occupied by an unknown/unhealthy process${pid ? ` (PID ${pid})` : ''}.`);
    console.error('[API] Refusing to kill automatically. Ask CEO approval before terminating the process.');
    console.error(`[API] To use fallback port: set ACCOUNTING_API_PORT=<port> and rerun accounting:api.`);
    db.close?.();
    process.exit(1);
  });
}
