import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import dotenv from 'dotenv';
import { chatRouter } from './routes/chat';
import { profileRouter } from './routes/profile';
import { healthRouter } from './routes/health';
import { approvalRouter } from './routes/approval';
import { workspaceRouter } from './routes/workspace';
import { modelsRouter } from './routes/models';
import { remindersRouter } from './routes/reminders';
import { authRouter } from './routes/auth';
import { visibilityRouter } from './routes/visibility';
import { knowledgeRouter } from './routes/knowledge';
import { memoryRouter } from './routes/memory';
import { brainRouter } from './routes/brain';
import { agentEngineRouter } from './routes/agent-engine';
import { qbAgentRouter } from './routes/qb-agent';
import { integrationAgentReleasesRouter } from './routes/integrationAgentReleases';
import { projectsRouter } from './routes/projects';
import { remoteRouter } from './routes/remote';
import { dataAnalystRouter } from './routes/data-analyst';
import { whatsappRouter } from './routes/whatsapp';
import { doordashAgentRouter } from './routes/doordash-agent';
import { reminderEvents } from './reminders/reminder-store';
import { gateEvents } from './approval/gate';
import { rateLimiter } from './middleware/rate-limit';
import { ipGuard } from './remote/remote-auth';
import { getNetworkInfo } from './remote/network-info';
import { connectorRegistry } from './visibility/connector-registry';
import { executiveMemory } from './memory/executive-memory';
import { fullIngest } from './knowledge/knowledge-db';
import { installAllPacks } from './knowledge/pack-manager';
import { startScheduler } from './cron/sync-scheduler';

dotenv.config();

const app = express();
const PORT   = parseInt(process.env.MI_PORT   || '4001');
// Bind to 0.0.0.0 when MOBILE_ACCESS=1 or HOST env set; default localhost for safety
const HOST   = process.env.HOST || (process.env.MOBILE_ACCESS === '1' ? '0.0.0.0' : '127.0.0.1');

// ── Security headers ────────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));

// ── CORS — allow LAN + Tailscale origins ────────────────────────────────────
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:4001', 'http://127.0.0.1:4001'];

app.use(cors({
  origin: (origin, cb) => {
    // Allow no-origin (mobile apps, curl, same-origin)
    if (!origin) return cb(null, true);
    // Allow any LAN / Tailscale origin dynamically
    if (
      ALLOWED_ORIGINS.includes(origin) ||
      /^http:\/\/192\.168\.\d+\.\d+:\d+$/.test(origin) ||
      /^http:\/\/10\.\d+\.\d+\.\d+:\d+$/.test(origin) ||
      /^http:\/\/100\.\d+\.\d+\.\d+:\d+$/.test(origin)
    ) return cb(null, true);
    cb(new Error('CORS blocked'));
  },
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(rateLimiter);

// ── IP Guard — block non-LAN/Tailscale (skip for remote/health, applied globally) ─
// /api/remote/health is intentionally public (returns server info, no sensitive data)
app.use((req, res, next) => {
  if (req.path === '/api/remote/health' || req.path === '/api/remote/login') return next();
  ipGuard(req, res, next);
});

// ── Static UI ───────────────────────────────────────────────────────────────
app.use(express.static('../ui'));
app.get('/liveboard', (_req, res) => res.redirect('/liveboard.html'));
app.get('/mobile',    (_req, res) => res.redirect('/mobile.html'));

// ── API routes ──────────────────────────────────────────────────────────────
app.use('/api/remote',      remoteRouter);       // Remote access (login/health/devices)
app.use('/api/chat',        chatRouter);
app.use('/api/profile',     profileRouter);
app.use('/api/health',      healthRouter);
app.use('/api/approval',    approvalRouter);
app.use('/api/workspace',   workspaceRouter);
app.use('/api/auth',        authRouter);
app.use('/api/models',      modelsRouter);
app.use('/api/reminders',   remindersRouter);
app.use('/api/visibility',  visibilityRouter);
app.use('/api/knowledge',   knowledgeRouter);
app.use('/api/memory',      memoryRouter);
app.use('/api/brain',       brainRouter);
app.use('/api/agent-engine',agentEngineRouter);
app.use('/api/qb-agent',    qbAgentRouter);
app.use('/api/integration-agent', integrationAgentReleasesRouter);
app.use('/api/projects',    projectsRouter);
app.use('/api/data-analyst',    dataAnalystRouter);
app.use('/api/whatsapp',        whatsappRouter);
app.use('/api/doordash-agent',  doordashAgentRouter);

// ── HTTP + WS server ────────────────────────────────────────────────────────
const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

function broadcast(data: object) {
  const payload = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client.readyState === 1) client.send(payload);
  });
}

reminderEvents.on('reminder', (r) => {
  console.log(`[Mi] Reminder fired: ${r.message}`);
  broadcast({ type: 'reminder', reminder: r });
});

gateEvents.on('new_action',  (a) => broadcast({ type: 'approval_new',      action: a }));
gateEvents.on('approved',    (a) => broadcast({ type: 'approval_resolved',  action: a }));
gateEvents.on('rejected',    (a) => broadcast({ type: 'approval_resolved',  action: a }));

wss.on('connection', (ws, req) => {
  const ip = req.socket.remoteAddress || 'unknown';
  console.log(`[Mi] WebSocket client connected — ${ip}`);
  ws.on('message', async (data) => {
    try {
      const msg = JSON.parse(data.toString());
      const { handleWsChat } = await import('./routes/chat');
      await handleWsChat(ws, msg);
    } catch {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
    }
  });
  ws.on('close', () => console.log(`[Mi] WebSocket disconnected — ${ip}`));
});

// ── Boot ─────────────────────────────────────────────────────────────────────
server.listen(PORT, HOST, () => {
  const net = getNetworkInfo(PORT);
  console.log(`\n[Mi] ════════════════════════════════════════`);
  console.log(`[Mi] Mi-Core Central Command — ONLINE`);
  console.log(`[Mi] Local:      http://127.0.0.1:${PORT}`);
  if (net.lan_url)       console.log(`[Mi] LAN:        ${net.lan_url}`);
  if (net.tailscale_url) console.log(`[Mi] Tailscale:  ${net.tailscale_url}  ← use on iPhone/Mac`);
  console.log(`[Mi] LiveBoard:  http://127.0.0.1:${PORT}/liveboard.html`);
  console.log(`[Mi] Mobile:     http://127.0.0.1:${PORT}/mobile.html`);
  console.log(`[Mi] WebSocket:  ws://127.0.0.1:${PORT}/ws`);
  console.log(`[Mi] ════════════════════════════════════════\n`);

  connectorRegistry.init();
  executiveMemory.init();
  console.log('[Mi] ✓ Connector Registry initialized');
  console.log('[Mi] ✓ Executive Memory initialized');

  setImmediate(() => {
    try {
      const result = fullIngest();
      console.log(`[Mi] ✓ Knowledge DB: ${result.ingested} docs ingested`);
    } catch (e) { console.warn('[Mi] Knowledge DB ingest error:', e); }

    try {
      const packs = installAllPacks();
      console.log(`[Mi] ✓ Knowledge Packs: ${packs.total_installed} docs from all packs`);
    } catch (e) { console.warn('[Mi] Pack install error:', e); }

    startScheduler();
    console.log('[Mi] ✓ Scheduler started');
  });
});
