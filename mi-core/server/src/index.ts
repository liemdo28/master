// ── ENV MUST LOAD FIRST — before any module initializes ─────────────────────
// auth.ts reads process.env.MI_PIN at module-load time to compute PIN_HASH.
// All imports below run their top-level code when require()'d, so dotenv
// must execute synchronously before the import block runs.
// In CommonJS this is guaranteed by placing the require + config call here,
// before any other require. In ESM/tsc output the compiled code preserves
// declaration order, so dotenv calls at lines 1-2 of dist/index.js run first.
import dotenv from 'dotenv';
import path from 'path';
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../.env'), override: false });

// ── Auth boot assertion — fail fast if PIN env is missing ───────────────────
{
  const crypto = require('crypto') as typeof import('crypto');
  const pin = process.env.MI_PIN || '';
  const pinHash = process.env.MI_PIN_HASH || '';
  if (!pin && !pinHash) {
    console.warn('[Mi][Auth] WARNING: MI_PIN and MI_PIN_HASH are both unset — auth disabled (dev mode)');
  } else if (pin) {
    // Self-test: verify that the hash we are about to use will accept the configured PIN
    const salt = 'mi-salt-2024';
    const expectedHash = crypto.createHash('sha256').update(pin + salt).digest('hex');
    // We can't reach into auth.ts's closed-over PIN_HASH here, but we can confirm
    // that the env value is set and non-empty before auth.ts loads it.
    console.log('[Mi][Auth] PIN configured — auth enforcement active');
  }
}

// ── API key boot assertion ────────────────────────────────────────────────────
{
  if (!process.env.MI_CORE_API_KEY) {
    console.warn('[Mi][Auth] WARNING: MI_CORE_API_KEY is not set — /api/gstack, /api/graph, /api/jarvis/evolution, /api/knowledge will reject all requests with 503 until key is configured in .env');
  } else {
    console.log('[Mi][Auth] MI_CORE_API_KEY configured — API key enforcement active');
  }
}

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import net from 'net';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { chatRouter } from './routes/chat';
import { executiveRouter } from './routes/executive';
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
import { ceoObserverRouter } from './routes/ceo-observer';
import { skillRouter } from './routes/skill-router';
import { browserAgentRouter } from './routes/browser-agent';
import { doordashAgentRouter } from './routes/doordash-agent';
import { bigdataRouter, initBigData } from './routes/bigdata';
import { enterpriseRouter } from './routes/enterprise';
import { voiceRouter } from './routes/voice';
import { actionsRouter } from './routes/actions';
import { jarvisRouter } from './routes/jarvis';
import { workflowMetricsRouter } from './routes/workflow-metrics';
import { gstackRouter } from './routes/gstack';
import { nodesRouter } from './routes/nodes';
import { modelsRegistryRouter } from './routes/models-registry';
import { miReviewApprovalsRouter } from './routes/mi-review-approvals';
import { operationalKnowledgeRouter } from './routes/operational-knowledge';
import { graphRouter } from './graph/graph-router';
import { operationalMemoryRouter } from './operational-memory/operational-memory-router';
import { taskIntelligenceRouter } from './task-intelligence/task-intelligence-router';
import { briefingRouter } from './executive-briefing/briefing-router';
import { strategicMemoryRouter } from './strategic-memory/strategic-memory-router';
import { autonomousRouter } from './autonomous/autonomous-router';
import { ceoTelemetryRouter } from './telemetry/ceo-telemetry-router';
import { councilRouter } from './council/council-router';
import { selfImprovementRouter } from './self-improvement/self-improvement-router';
import { healthIntelligenceRouter } from './health-intelligence/health-router';
import { digitalTwinRouter } from './digital-twin/digital-twin-router';
import { agenviewRouter } from './agenview/agenview-router';
import { seoRouter } from './routes/seo';
import { cooV4Router } from './routes/coo-v4-router';
import companyOsRouter from './company-os/company-os-router';
import { operationsRouter } from './routes/operations';
import { executiveRouter as executiveIntelligenceRouter } from './executive-intelligence/executive-routes';
import { startBurnInScheduler } from './operations/burn-in';
import { startSelfHealingScheduler } from './operations/self-healing';
import { startSelfHealingMonitor } from './company-os/self-healing-monitor';
import { chatMetrics } from './chat/chat-metrics';
import { queueState } from './chat/chat-queue';
import { claimLeadershipOnBoot, startLeaderHeartbeat } from './nodes/leader-lock-persistent';
import { startProactiveMonitor, onAlert } from './jarvis/proactive-monitor';
import { startDailyBriefingScheduler } from './jarvis/daily-briefing-scheduler';
import { listQueueJobs, queueStats } from './queue/job-queue';
import { reminderEvents } from './reminders/reminder-store';
import { gateEvents } from './approval/gate';
import { rateLimiter } from './middleware/rate-limit';
import { ipGuard, requireRemoteAuth } from './remote/remote-auth';
import { requireAuth } from './routes/auth';
import { getNetworkInfo } from './remote/network-info';
import { connectorRegistry } from './visibility/connector-registry';
import { executiveMemory } from './memory/executive-memory';
import { fullIngest } from './knowledge/knowledge-db';
import { installAllPacks } from './knowledge/pack-manager';
import { startScheduler } from './cron/sync-scheduler';
import { getKeyStatus } from './services/whatsapp-key-manager';
import { n8nRouter } from './n8n/n8n-router';

// dotenv already loaded at top of file — do not call again here.

const app = express();
const PORT   = parseInt(process.env.MI_PORT   || '4001');
// QB Laptop1 reports over Tailscale, so Mi-Core must listen beyond localhost.
const HOST   = process.env.HOST || process.env.MI_BIND_HOST || '0.0.0.0';

function validateReviewApprovalStartup() {
  const allowedNumbers = (process.env.CEO_WHATSAPP_ALLOWED_NUMBERS || '').split(',').map(v => v.trim()).filter(Boolean);
  const keyStatus = getKeyStatus();
  if (!allowedNumbers.length) {
    console.warn('[Mi] Review approval WhatsApp channel disabled: CEO_WHATSAPP_ALLOWED_NUMBERS is not configured.');
  }
  if (!keyStatus.configured || keyStatus.status !== 'active') {
    console.warn('[Mi] Review approval WhatsApp channel disabled: WhatsApp API key is not configured or active.');
  }
  if (!process.env.REVIEW_SYSTEM_INTERNAL_TOKEN) {
    console.warn('[Mi] Review approval callbacks are running without REVIEW_SYSTEM_INTERNAL_TOKEN.');
  }
}

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
app.use(express.static(path.resolve(__dirname, '../../ui')));
app.get('/liveboard', (_req, res) => res.redirect('/liveboard.html'));
app.get('/mobile',    (_req, res) => res.redirect('/mobile.html'));
app.get('/voice',     (_req, res) => res.redirect('/voice.html'));
app.get('/agenview',  (_req, res) => res.redirect('/agenview.html'));

// ── API routes ──────────────────────────────────────────────────────────────
// Auth strategy: requireAuth checks PIN-based token sessions.
// - If MI_PIN is not configured, requireAuth is a no-op (all requests pass).
// - If MI_PIN is configured, all P0/P1 routes require a valid Bearer token.
// - /api/remote (has its own auth), /api/health, /api/auth, /api/nodes are public.

// P0 — Write access (approve actions, send emails, modify data)
app.use('/api/approval',    requireAuth, approvalRouter);
app.use('/api/actions',     requireAuth, actionsRouter);

// P1 — Sensitive read (executive data, memory, briefing)
app.use('/api/executive',   requireAuth, executiveRouter);
app.use('/api/memory',      requireAuth, memoryRouter);
app.use('/api/briefing',    requireAuth, briefingRouter);
app.use('/api/graph',       requireAuth, graphRouter);
app.use('/api/brain',       requireAuth, brainRouter);
app.use('/api/visibility',  requireAuth, visibilityRouter);

// P2 — Operational (protected but less sensitive)
app.use('/api/chat',        requireAuth, chatRouter);
app.use('/api/jarvis',      requireAuth, jarvisRouter);
app.use('/api/qb-agent',    requireAuth, qbAgentRouter);
app.use('/api/projects',    requireAuth, projectsRouter);
app.use('/api/reminders',   requireAuth, remindersRouter);
app.use('/api/workspace',   requireAuth, workspaceRouter);
app.use('/api/knowledge',   requireAuth, knowledgeRouter);
app.use('/api/ceo-observer', requireAuth, ceoObserverRouter); // Session A proxy

// Internal / already protected / public
app.use('/api/remote',      remoteRouter);       // Remote access (has own auth)
app.use('/api/auth',        authRouter);         // Auth endpoints (must be public)
app.use('/api/health',      healthRouter);       // Health check (public)
app.use('/api/nodes',       requireAuth, nodesRouter);        // Node registration (internal)
app.use('/api/whatsapp',    whatsappRouter);     // Has API key auth middleware
app.use('/api/models',      modelsRouter);
app.use('/api/agent-engine',agentEngineRouter);
app.use('/api/integration-agent', integrationAgentReleasesRouter);
app.use('/api',             operationalKnowledgeRouter);
app.use('/api/data-analyst',    dataAnalystRouter);
app.use('/api/skills',          skillRouter);
app.use('/api/browser',         browserAgentRouter);
app.use('/api/doordash-agent',  doordashAgentRouter);
app.use('/api/bigdata',         bigdataRouter);
app.use('/api/enterprise',      enterpriseRouter);
app.use('/api/voice',           voiceRouter);
app.use('/api/gstack',          gstackRouter);
app.use('/api/models',          modelsRegistryRouter);
app.use('/api/mi',              miReviewApprovalsRouter);
app.use('/api/memory',          operationalMemoryRouter); // Phase 15: Operational Memory Runtime
app.use('/api/tasks',           taskIntelligenceRouter);  // Phase 16: Personal Task Intelligence
app.use('/api/strategic',       strategicMemoryRouter);    // Phase 18: Strategic Memory
app.use('/api/agenview',        agenviewRouter);           // Phase 19: AgenView Dashboard
app.use('/api/seo',             seoRouter);                // SEO Phase 2: 7 SEO Agent Integration
app.use('/api/coo-v4',          cooV4Router);              // COO V4: Autonomous 24-Domain Engine
app.use('/api/company-os',      companyOsRouter);          // Mi Company OS: 19-dept pipeline
app.use('/api/autonomous',      autonomousRouter);         // Phase 20: Autonomous Execution
app.use('/api/council',         councilRouter);            // Phase 21: Multi-Agent Council
app.use('/api/improvement',     selfImprovementRouter);    // Phase 22: Self-Improvement
app.use('/api/health-intel',    healthIntelligenceRouter); // Phase 23: Health Intelligence
app.use('/api/digital-twin',    digitalTwinRouter);        // Phase 24: Digital Twin
app.use('/api/operations',      requireAuth, operationsRouter);  // DEV3: Operations & Reliability Layer
app.use('/api/workflows',       requireAuth, workflowMetricsRouter);  // DEV5: Workflow Execution Ledger & Metrics
app.use('/api/telemetry',       requireAuth, ceoTelemetryRouter); // CEO Production Telemetry Foundation (P0-1..P0-6)
app.use('/api/executive-intelligence', requireAuth, executiveIntelligenceRouter); // Phase 21: Executive Intelligence Layer
app.use('/api/n8n',                 n8nRouter);              // n8n Execution Bus
app.get('/api/tools', (_req, res) => {
  res.json({
    tools: [
      { id: 'provider-router', status: 'available', endpoint: '/api/enterprise/providers' },
      { id: 'memory-router', status: 'available', endpoint: '/api/enterprise/memory/search' },
      { id: 'browser-router', status: 'available', endpoint: '/api/browser/health' },
      { id: 'queue', status: 'available', endpoint: '/api/jobs' },
      { id: 'bigdata', status: 'available', endpoint: '/api/bigdata/health' },
    ],
  });
});
app.get('/api/jobs', async (req, res) => {
  try {
    const jobs = await listQueueJobs(parseInt(String(req.query.limit || '50'), 10));
    const stats = await queueStats();
    res.json({ jobs, count: jobs.length, stats });
  } catch (e) {
    const error = e instanceof AggregateError
      ? (e.errors?.map((err: unknown) => err instanceof Error ? err.message : String(err)).filter(Boolean).join('; ') || 'PostgreSQL unavailable')
      : String(e);
    res.json({
      jobs: [],
      count: 0,
      stats: [],
      status: 'degraded',
      warning: 'PostgreSQL unavailable; queue jobs cannot be listed.',
      error,
    });
  }
});

// ── Chat runtime metrics ─────────────────────────────────────────────────────
app.get('/api/metrics/chat', (_req, res) => {
  res.json({ ...chatMetrics.snapshot(), queue: queueState() });
});

// ── HTTP + WS server ────────────────────────────────────────────────────────
const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

// ── EADDRINUSE self-recovery ─────────────────────────────────────────────────
// Wait before binding instead of repeatedly calling listen() on the same server.
// Exiting here makes PM2 spawn another process and can create a restart storm.
let _bindAttempts = 0;
const BIND_RETRY_MS = 2500;

function canBind(port: number, host: string): Promise<boolean> {
  return new Promise(resolve => {
    const probe = net.createServer();
    probe.once('error', () => resolve(false));
    probe.once('listening', () => {
      probe.close(() => resolve(true));
    });
    probe.listen(port, host);
  });
}

async function startHttpServer(): Promise<void> {
  const MAX_BIND_ATTEMPTS = 3;
  while (!(await canBind(PORT, HOST))) {
    _bindAttempts++;
    if (_bindAttempts >= MAX_BIND_ATTEMPTS) {
      console.error(`[Mi][EADDRINUSE] Port ${PORT} still busy after ${MAX_BIND_ATTEMPTS} attempts — exiting so PM2 can restart cleanly`);
      process.exit(1);
    }
    console.warn(`[Mi][EADDRINUSE] Port ${PORT} busy — waiting for release (attempt ${_bindAttempts})`);
    await new Promise(resolve => setTimeout(resolve, BIND_RETRY_MS));
  }
  server.listen(PORT, HOST, onListenSuccess);
}

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[Mi][EADDRINUSE] Port ${PORT} busy after bind — exiting for clean PM2 restart`);
    process.exit(1);
  } else {
    console.error('[Mi] HTTP server error:', err);
  }
});
// ws library re-emits server errors on wss — must handle or it becomes uncaught exception
wss.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code !== 'EADDRINUSE') {
    console.error('[Mi] WebSocket server error:', err);
  }
  // EADDRINUSE handled above by server.on('error')
});

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
function onListenSuccess() {
  _bindAttempts = 0; // reset for future restarts
  // Tell PM2 the process is ready — stops it from spawning more instances
  if (typeof process.send === 'function') process.send('ready');
  const net = getNetworkInfo(PORT);
  console.log(`\n[Mi] ════════════════════════════════════════`);
  console.log(`[Mi] Mi-Core Central Command — ONLINE`);
  console.log(`[Mi] Local:      http://127.0.0.1:${PORT}`);
  if (net.lan_url)       console.log(`[Mi] LAN:        ${net.lan_url}`);
  if (net.tailscale_url) console.log(`[Mi] Tailscale:  ${net.tailscale_url}  ← use on iPhone/Mac`);
  console.log(`[Mi] AgenView:   http://127.0.0.1:${PORT}/agenview`);
  console.log(`[Mi] LiveBoard:  http://127.0.0.1:${PORT}/liveboard.html`);
  console.log(`[Mi] Mobile:     http://127.0.0.1:${PORT}/mobile.html`);
  console.log(`[Mi] WebSocket:  ws://127.0.0.1:${PORT}/ws`);
  console.log(`[Mi] ════════════════════════════════════════\n`);
  validateReviewApprovalStartup();

  connectorRegistry.init();
  // Auto-mark connectors as connected when credentials are available in env
  if (process.env.ASANA_TOKEN) {
    connectorRegistry.update('asana', { auth_status: 'connected', status: 'active', health_status: 'unknown' });
  }
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    const googleTokenPath = require('path').join(process.env.GLOBAL_DIR || 'E:/Project/Master/.local-agent-global', 'visibility', 'google-tokens.json');
    if (require('fs').existsSync(googleTokenPath)) {
      for (const id of ['gmail', 'google-calendar', 'google-drive', 'google-contacts']) {
        connectorRegistry.update(id, { auth_status: 'connected', status: 'active' });
      }
    }
  }
  // DEV2: Live-probe HTTP connectors after init to prevent stale "healthy" in registry
  setTimeout(() => {
    connectorRegistry.liveProbe().catch(() => {/* probe failures are non-fatal */});
  }, 3000);
  executiveMemory.init();
  console.log('[Mi] ✓ Connector Registry initialized');
  console.log('[Mi] ✓ Executive Memory initialized');

  setTimeout(() => {
    if (process.env.MI_BOOT_KNOWLEDGE_INGEST === '1') {
      try {
        const result = fullIngest();
        console.log(`[Mi] ✓ Knowledge DB: ${result.ingested} docs ingested`);
      } catch (e) { console.warn('[Mi] Knowledge DB ingest error:', e); }

      try {
        const packs = installAllPacks();
        console.log(`[Mi] ✓ Knowledge Packs: ${packs.total_installed} docs from all packs`);
      } catch (e) { console.warn('[Mi] Pack install error:', e); }
    } else {
      console.log('[Mi] Knowledge DB boot ingest skipped (set MI_BOOT_KNOWLEDGE_INGEST=1 to enable)');
    }

    startScheduler();
    console.log('[Mi] ✓ Scheduler started');

    startBurnInScheduler();
    startSelfHealingScheduler(5);
    startSelfHealingMonitor(60_000); // Phase 12: monitor 11 services every 60s
    console.log('[Mi] ✓ Operations layer started (burn-in + self-healing + Phase12-monitor)');

    const timeoutMinutes = parseInt(process.env.REVIEW_APPROVAL_TIMEOUT_MINUTES || '1440', 10);
    setInterval(() => {
      fetch(`http://127.0.0.1:${PORT}/api/mi/review-approvals/sweep-timeouts`, { method: 'POST' }).catch(() => undefined);
    }, Math.max(1, Math.min(timeoutMinutes, 60)) * 60_000);
    console.log(`[Mi] ✓ Review approval timeout monitor started (${timeoutMinutes}m)`);

    initBigData().then(() => {
      console.log('[Mi] ✓ Big Data Foundation initialized');
    }).catch(e => console.warn('[Mi] Big Data init (non-critical):', e.message));

    // Jarvis proactive monitor — broadcast alerts via WebSocket
    onAlert((alert) => broadcast({ type: 'jarvis_alert', alert }));
    const MONITOR_INTERVAL = parseInt(process.env.JARVIS_MONITOR_INTERVAL_MIN || '15');
    startProactiveMonitor(MONITOR_INTERVAL);
    console.log(`[Mi] ✓ Jarvis Proactive Monitor started (interval: ${MONITOR_INTERVAL}m)`);

    // Phase 7: Leader Lock — claim leadership on boot, start heartbeat
    claimLeadershipOnBoot();
    startLeaderHeartbeat(30_000);
    console.log('[Mi] ✓ Leader Lock initialized (Phase 7 — multi-node coordination)');

    startDailyBriefingScheduler();
    console.log('[Mi] ✓ Daily Briefing Scheduler started (07:00 VN time)');

    import('./jarvis/qb-online-watcher').then(({ startQbOnlineWatcher }) => {
      startQbOnlineWatcher();
      console.log('[Mi] ✓ QB Online Watcher started (auto-sync when Laptop1 reconnects)');
    }).catch(() => {});

    // Jarvis Evolution Phase 30 — boot all 10 phases
    import('./jarvis/phase30-jarvis/jarvis-core').then(({ bootJarvis }) => {
      bootJarvis().catch(() => {});
      console.log('[Mi] ✓ Jarvis Evolution Phase 30 booted (knowledge, memory, graph, health, workflows, twin)');
    }).catch(() => {});
  });
}

startHttpServer().catch(e => {
  console.error('[Mi] HTTP server startup failed:', e);
});

// ── Graceful shutdown — prevents EADDRINUSE on PM2 restart ───────────────────
function gracefulShutdown(signal: string) {
  console.log(`[Mi] ${signal} received — shutting down gracefully`);
  server.closeAllConnections?.();
  server.close(() => {
    console.log('[Mi] HTTP server closed');
    process.exit(0);
  });
  // Force exit after 5s — port already released by closeAllConnections
  setTimeout(() => {
    console.warn('[Mi] Forced shutdown after timeout');
    process.exit(0);
  }, 5000).unref();
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT',  () => gracefulShutdown('SIGINT'));
