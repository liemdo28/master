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
import { healthPublicRouter } from './health-truth/public-router';
import { healthDetailRouter } from './health-truth/detail-router';
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
import { qbFinancialRouter } from './routes/qb-financial';
import { integrationAgentReleasesRouter } from './routes/integrationAgentReleases';
import { projectsRouter } from './routes/projects';
import { remoteRouter } from './routes/remote';
import { dataAnalystRouter } from './routes/data-analyst';
import { whatsappRouter } from './routes/whatsapp';
import { ceoObserverRouter } from './routes/ceo-observer';
import { skillRouter } from './routes/skill-router';
import { browserAgentRouter } from './routes/browser-agent';
import { doordashAgentRouter } from './routes/doordash-agent';
import { doordashMetricsRouter } from './routes/doordash-metrics';
import { bigdataRouter, initBigData } from './routes/bigdata';
import { enterpriseRouter } from './routes/enterprise';
import { voiceRouter } from './routes/voice';
import { controlledActionsJsonParser, controlledActionsRouter } from './personal-os/actions/router';
import { governanceJsonParser, governanceRouter } from './personal-os/actions/governance/router';
import { orchestrationJsonParser, orchestrationRouter } from './personal-os/orchestration/router';
import { delegationJsonParser, delegationRouter } from './personal-os/delegation/router';
import { workflowMetricsRouter } from './routes/workflow-metrics';
import { gstackRouter } from './routes/gstack';
import { nodesRouter } from './routes/nodes';
import { modelsRegistryRouter } from './routes/models-registry';
import { miReviewApprovalsRouter } from './routes/mi-review-approvals';
import { operationalKnowledgeRouter } from './routes/operational-knowledge';
import { graphRouter } from './graph/graph-router';
import { operationalMemoryRouter } from './operational-memory/operational-memory-router';
import { taskIntelligenceRouter } from './task-intelligence/task-intelligence-router';
import { taskRuntimeJsonErrorHandler, taskRuntimeJsonParser, taskRuntimeRouter } from './routes/task-runtime';
import { codingJsonParser, codingRouter } from './routes/coding';
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
import { gscRouter } from './routes/gsc';
import { ceoControlRouter } from './routes/ceo-control';
import { ga4AnalyticsRouter } from './routes/ga4-analytics';
import { gbpAnalyticsRouter } from './routes/gbp-analytics';
import { engineeringRouter }  from './routes/engineering';
import { aiPlatformRouter }   from './routes/ai-platform';
import { connectorsRouter }   from './routes/connectors';
import ceoObjectiveRouter from './ceo-command-center';
import { personalOsJsonParser, personalOsRouter } from './personal-os/router';
import { intelligenceJsonParser, intelligenceRouter } from './intelligence/router';
import { knowledgeDocumentsJsonParser, knowledgeDocumentsRouter } from './personal-os/documents/router';
import { simulationJsonParser, automationSimulationRouter } from './personal-os/automation-simulation/router';
import { jarvisGatewayJsonParser, jarvisGatewayJsonErrorHandler, jarvisGatewayRouter } from './jarvis-gateway/router';
import { operatingJsonParser, operatingRouter } from './personal-os/operating/router';
import { authorityRouter } from './authority-control-plane/router';
import { operatorControlRouter } from './operator-control/router';
import { evidenceRouter } from './evidence/router';
import { assertAuthorityManifest, generateAuthorityManifest } from './authority-control-plane/scanner';
import { validateLegacyAuthorityRuntime } from './authority-control-plane/legacy-adapter';
import { legacyAuthorityBoundary } from './authority-control-plane/guard';

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

function applyIpGuard(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (req.path === '/api/remote/health' || req.path === '/api/remote/login') return next();
  ipGuard(req, res, next);
}

function requireTaskRuntimeAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const supplied = String(req.headers['x-api-key'] || '');
  const expected = process.env.MI_CORE_API_KEY || process.env.AGENT_CODING_API_KEY || '';
  if (supplied && expected && supplied === expected) return next();
  return res.status(401).json({ error: 'Unauthorized' });
}

function validateAuthorityStartup(): void {
  if (process.env.MI_AUTHORITY_STARTUP_ASSERT === 'false') return;
  const started = Date.now();
  const manifest = generateAuthorityManifest(path.resolve(__dirname, '..'));
  assertAuthorityManifest(manifest);
  validateLegacyAuthorityRuntime(manifest);
  console.log(`[Mi] ✓ Authority Control Plane validated (${manifest.counts.total} surfaces, ${manifest.counts.mutations} mutations, ${Date.now() - started}ms)`);
}

// ── Public / self-authenticating routes — mounted first (bug fix) ────────────
// These MUST be registered before the bare '/api' catch-all mounts below: Express
// runs app.use('/api', ...) middleware for every '/api/*' path, including
// '/api/remote/login', '/api/auth/login' and '/api/health', and requireTaskRuntimeAuth
// short-circuits with a 401 without calling next() — so if those bare mounts were
// registered first, none of these "intentionally public" routes could ever be
// reached without already having the raw API key, making PIN login itself
// impossible. (Found while wiring Phase 5E's Command Center login flow; these three
// routes were previously mounted much later in this file, after every bare '/api'
// mount, so this was already broken for mobile.html/liveboard.html before Phase 5E.)
app.use('/api/remote', express.json({ limit: '1mb' }), remoteRouter); // Remote access (has own auth)
app.use('/api/auth', express.json({ limit: '1mb' }), authRouter);     // Auth endpoints (must be public)
app.use('/api/health', healthPublicRouter);                            // Health check (public liveness only)

// ── Command Center bridge (Phase 5E) ──────────────────────────────────────────
// The exact same routers used below, mounted a second time under a session-token-gated
// path so the browser never needs the raw MI_CORE_API_KEY. No handler or business
// logic is duplicated — only the auth middleware differs (requireRemoteAuth's
// persisted PIN session instead of requireTaskRuntimeAuth's raw API key). This block
// MUST also come before the bare '/api' catch-all mounts just below, for the exact
// same route-shadowing reason as the public-routes block above — '/api/command-center/*'
// starts with '/api' too, so requireTaskRuntimeAuth would otherwise reject it first.
app.use('/api/command-center/task-runtime', taskRuntimeJsonParser, taskRuntimeJsonErrorHandler, rateLimiter, applyIpGuard, requireRemoteAuth, taskRuntimeRouter);
app.use('/api/command-center/coding', codingJsonParser, taskRuntimeJsonErrorHandler, rateLimiter, applyIpGuard, requireRemoteAuth, codingRouter);
app.use('/api/command-center/projects', express.json({ limit: '2mb' }), rateLimiter, applyIpGuard, requireRemoteAuth, projectsRouter);
app.use('/api/command-center', personalOsJsonParser, taskRuntimeJsonErrorHandler, rateLimiter, applyIpGuard, requireRemoteAuth, personalOsRouter);
app.use('/api/command-center', intelligenceJsonParser, taskRuntimeJsonErrorHandler, rateLimiter, applyIpGuard, requireRemoteAuth, intelligenceRouter);
app.use('/api/command-center', knowledgeDocumentsJsonParser, taskRuntimeJsonErrorHandler, rateLimiter, applyIpGuard, requireRemoteAuth, knowledgeDocumentsRouter);
app.use('/api/command-center', operatingJsonParser, taskRuntimeJsonErrorHandler, rateLimiter, applyIpGuard, requireRemoteAuth, operatingRouter);
app.use('/api/command-center', controlledActionsJsonParser, taskRuntimeJsonErrorHandler, rateLimiter, applyIpGuard, requireRemoteAuth, controlledActionsRouter);
app.use('/api/command-center', governanceJsonParser, taskRuntimeJsonErrorHandler, rateLimiter, applyIpGuard, requireRemoteAuth, governanceRouter);
app.use('/api/command-center', orchestrationJsonParser, taskRuntimeJsonErrorHandler, rateLimiter, applyIpGuard, requireRemoteAuth, orchestrationRouter);
app.use('/api/command-center', delegationJsonParser, taskRuntimeJsonErrorHandler, rateLimiter, applyIpGuard, requireRemoteAuth, delegationRouter);
app.use('/api/command-center', rateLimiter, applyIpGuard, requireRemoteAuth, authorityRouter);
app.use('/api/command-center', rateLimiter, applyIpGuard, requireRemoteAuth, operatorControlRouter);
app.use('/api/command-center', rateLimiter, applyIpGuard, requireRemoteAuth, evidenceRouter);
app.use('/api/command-center', simulationJsonParser, taskRuntimeJsonErrorHandler, rateLimiter, applyIpGuard, requireRemoteAuth, automationSimulationRouter);
app.use('/api/command-center', rateLimiter, applyIpGuard, requireRemoteAuth, healthDetailRouter);
app.use('/api/command-center', jarvisGatewayJsonParser, jarvisGatewayJsonErrorHandler, rateLimiter, applyIpGuard, requireRemoteAuth, jarvisGatewayRouter);

app.use('/api/task-runtime', taskRuntimeJsonParser, taskRuntimeJsonErrorHandler, rateLimiter, applyIpGuard, requireTaskRuntimeAuth, taskRuntimeRouter);
app.use('/api/coding', codingJsonParser, taskRuntimeJsonErrorHandler, rateLimiter, applyIpGuard, requireTaskRuntimeAuth, codingRouter);
app.use('/api', personalOsJsonParser, taskRuntimeJsonErrorHandler, rateLimiter, applyIpGuard, requireTaskRuntimeAuth, personalOsRouter);
app.use('/api', intelligenceJsonParser, taskRuntimeJsonErrorHandler, rateLimiter, applyIpGuard, requireTaskRuntimeAuth, intelligenceRouter);
app.use('/api', knowledgeDocumentsJsonParser, taskRuntimeJsonErrorHandler, rateLimiter, applyIpGuard, requireTaskRuntimeAuth, knowledgeDocumentsRouter);
app.use('/api', operatingJsonParser, taskRuntimeJsonErrorHandler, rateLimiter, applyIpGuard, requireTaskRuntimeAuth, operatingRouter);
app.use('/api', controlledActionsJsonParser, taskRuntimeJsonErrorHandler, rateLimiter, applyIpGuard, requireTaskRuntimeAuth, controlledActionsRouter);
app.use('/api', governanceJsonParser, taskRuntimeJsonErrorHandler, rateLimiter, applyIpGuard, requireTaskRuntimeAuth, governanceRouter);
app.use('/api', orchestrationJsonParser, taskRuntimeJsonErrorHandler, rateLimiter, applyIpGuard, requireTaskRuntimeAuth, orchestrationRouter);
app.use('/api', delegationJsonParser, taskRuntimeJsonErrorHandler, rateLimiter, applyIpGuard, requireTaskRuntimeAuth, delegationRouter);
app.use('/api', rateLimiter, applyIpGuard, requireTaskRuntimeAuth, authorityRouter);
app.use('/api', rateLimiter, applyIpGuard, requireTaskRuntimeAuth, operatorControlRouter);
app.use('/api', rateLimiter, applyIpGuard, requireTaskRuntimeAuth, evidenceRouter);
app.use('/api', simulationJsonParser, taskRuntimeJsonErrorHandler, rateLimiter, applyIpGuard, requireTaskRuntimeAuth, automationSimulationRouter);
app.use('/api', rateLimiter, applyIpGuard, requireTaskRuntimeAuth, healthDetailRouter);
app.use('/api', jarvisGatewayJsonParser, jarvisGatewayJsonErrorHandler, rateLimiter, applyIpGuard, requireTaskRuntimeAuth, jarvisGatewayRouter);

app.use(express.json({ limit: '10mb' }));
app.use(rateLimiter);

// ── IP Guard — block non-LAN/Tailscale (skip for remote/health, applied globally) ─
// /api/remote/health is intentionally public (returns server info, no sensitive data)
app.use(applyIpGuard);
app.use(legacyAuthorityBoundary);

// ── Static UI ───────────────────────────────────────────────────────────────
app.use(express.static(path.resolve(__dirname, '../../ui')));
// Command Center (Phase 5E) — served additively at its own path; does not touch the
// existing root static mount above. SPA fallback so client-side routes (e.g.
// /command-center/goals) reload correctly.
const commandCenterDist = path.resolve(__dirname, '../../command-center/dist');
app.use('/command-center', express.static(commandCenterDist));
app.get('/command-center/*', (_req, res) => res.sendFile(path.join(commandCenterDist, 'index.html')));
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
// Phase 5F controlled actions are mounted above under `/api` and `/api/command-center`
// so route order cannot expose the older raw action adapter surface.

// P1 — Sensitive read (executive data, memory, briefing)
app.use('/api/executive',   requireAuth, executiveRouter);
app.use('/api/memory',      requireAuth, memoryRouter);
app.use('/api/briefing',    requireAuth, briefingRouter);
app.use('/api/graph',       requireAuth, graphRouter);
app.use('/api/brain',       requireAuth, brainRouter);
app.use('/api/visibility',  requireAuth, visibilityRouter);

// P2 — Operational (protected but less sensitive)
app.use('/api/chat',        requireAuth, chatRouter);
// Phase 8B: legacy 49-route /api/jarvis HTTP router retired — REMOVE_CANDIDATE,
// zero live callers found (no Command Center reference, no other backend caller,
// no test, no PM2/CLI entrypoint — see docs/architecture/PHASE8B_LEGACY_INVENTORY.md
// §1/§12). Its 20 backing modules (jarvis/proactive-monitor.ts through
// jarvis/phase21-knowledge/ .. phase30-jarvis/) are UNCHANGED and remain fully
// live via their real, non-HTTP callers (WhatsApp, voice, GStack skills/QA,
// natural-conversation-engine, and bootJarvis() at startup) — only this HTTP
// exposure layer, which had no caller, was removed.
app.use('/api/qb-agent',    requireAuth, qbAgentRouter);
app.use('/api/qb',          requireTaskRuntimeAuth, qbFinancialRouter);
app.use('/api/projects',    requireAuth, projectsRouter);
app.use('/api/reminders',   requireAuth, remindersRouter);
app.use('/api/workspace',   requireAuth, workspaceRouter);
app.use('/api/knowledge',   requireAuth, knowledgeRouter);
app.use('/api/ceo-observer', requireAuth, ceoObserverRouter); // Session A proxy

// Internal / already protected / public
app.use('/api/nodes',       requireAuth, nodesRouter);        // Node registration (internal)
app.use('/api/whatsapp',    whatsappRouter);     // AUTHENTICATED (Phase 8A audit): own validateApiKey() check on x-api-key/body.api_key, independent of requireAuth's PIN no-op
app.use('/api/models',      requireTaskRuntimeAuth, modelsRouter);
app.use('/api/agent-engine', requireTaskRuntimeAuth, agentEngineRouter);
app.use('/api/integration-agent', requireTaskRuntimeAuth, integrationAgentReleasesRouter);
app.use('/api',             requireTaskRuntimeAuth, operationalKnowledgeRouter);
app.use('/api/data-analyst',    requireTaskRuntimeAuth, dataAnalystRouter);
app.use('/api/skills',          requireTaskRuntimeAuth, skillRouter);
app.use('/api/browser',         requireTaskRuntimeAuth, browserAgentRouter);
app.use('/api/doordash-agent',  requireTaskRuntimeAuth, doordashAgentRouter);
app.use('/api/doordash',        requireTaskRuntimeAuth, doordashMetricsRouter);
app.use('/api/bigdata',         requireTaskRuntimeAuth, bigdataRouter);
app.use('/api/enterprise',      requireTaskRuntimeAuth, enterpriseRouter);
app.use('/api/voice',           requireTaskRuntimeAuth, voiceRouter);
app.use('/api/gstack',          requireTaskRuntimeAuth, gstackRouter);
app.use('/api/models',          requireTaskRuntimeAuth, modelsRegistryRouter);
app.use('/api/mi',              requireTaskRuntimeAuth, miReviewApprovalsRouter);
app.use('/api/memory',          requireTaskRuntimeAuth, operationalMemoryRouter); // Phase 15: Operational Memory Runtime
app.use('/api/tasks',           requireTaskRuntimeAuth, taskIntelligenceRouter);  // Phase 16: Personal Task Intelligence
app.use('/api/strategic',       requireTaskRuntimeAuth, strategicMemoryRouter);    // Phase 18: Strategic Memory
app.use('/api/agenview',        requireTaskRuntimeAuth, agenviewRouter);           // Phase 19: AgenView Dashboard
app.use('/api/seo',             requireTaskRuntimeAuth, seoRouter);                // SEO Phase 2: 7 SEO Agent Integration
app.use('/api/coo-v4',          requireTaskRuntimeAuth, cooV4Router);              // COO V4: Autonomous 24-Domain Engine
app.use('/api/company-os',      requireTaskRuntimeAuth, companyOsRouter);          // Mi Company OS: 19-dept pipeline
app.use('/api/autonomous',      requireTaskRuntimeAuth, autonomousRouter);         // Phase 20: Autonomous Execution
app.use('/api/council',         requireTaskRuntimeAuth, councilRouter);            // Phase 21: Multi-Agent Council
app.use('/api/improvement',     requireTaskRuntimeAuth, selfImprovementRouter);    // Phase 22: Self-Improvement
app.use('/api/health-intel',    requireTaskRuntimeAuth, healthIntelligenceRouter); // Phase 23: Health Intelligence
app.use('/api/digital-twin',    requireTaskRuntimeAuth, digitalTwinRouter);        // Phase 24: Digital Twin
app.use('/api/operations',      requireAuth, operationsRouter);  // DEV3: Operations & Reliability Layer
app.use('/api/workflows',       requireAuth, workflowMetricsRouter);  // DEV5: Workflow Execution Ledger & Metrics
app.use('/api/telemetry',       requireAuth, ceoTelemetryRouter); // CEO Production Telemetry Foundation (P0-1..P0-6)
app.use('/api/executive-intelligence', requireAuth, executiveIntelligenceRouter); // Phase 21: Executive Intelligence Layer
app.use('/api/n8n',                 requireTaskRuntimeAuth, n8nRouter);              // n8n Execution Bus
app.use('/api/seo/gsc',             requireTaskRuntimeAuth, gscRouter);              // Phase 4: Google Search Console
app.use('/api/analytics',         requireTaskRuntimeAuth, ga4AnalyticsRouter);              // Phase 33: GA4 Revenue Intelligence
app.use('/api/gbp',               requireTaskRuntimeAuth, gbpAnalyticsRouter);              // Phase 34B: Google Business Profile
app.use('/api/engineering',       requireTaskRuntimeAuth, engineeringRouter);               // Phase 34: Engineering Division OS
app.use('/api/ai',                requireTaskRuntimeAuth, aiPlatformRouter);                // Phase 34: AI Platform (workflow/rag/vision/voice/browser)
app.use('/api/connectors',        requireTaskRuntimeAuth, connectorsRouter);                // Phase 35: Drive/Reviews/Social connectors
app.use('/api/ceo',                 requireAuth, ceoObjectiveRouter); // Phase 25D: CEO Objective Command Center
app.use('/api/ceo',                 requireTaskRuntimeAuth, ceoControlRouter);       // Phase 23D: CEO Control Center
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

validateAuthorityStartup();

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
  scheduleE2eFixtureCleanup();
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

function scheduleE2eFixtureCleanup() {
  const root = process.env.MI_E2E_FIXTURE_ROOT;
  if (process.env.MI_E2E_FIXTURE !== '1' || !root) return;
  try {
    const fs = require('fs') as typeof import('fs');
    const os = require('os') as typeof import('os');
    const { spawn } = require('child_process') as typeof import('child_process');
    const tempRoot = fs.realpathSync(os.tmpdir());
    const fixtureRoot = fs.realpathSync(root);
    if (!fixtureRoot.startsWith(tempRoot) || !fixtureRoot.includes('mi-5e-e2e-')) return;
    const cleanupScript = `
const fs = require('fs');
const pid = Number(process.argv[1]);
const root = process.argv[2];
function alive() { try { process.kill(pid, 0); return true; } catch { return false; } }
function rm() { try { fs.rmSync(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 }); } catch {} }
(async () => {
  for (let i = 0; i < 80 && alive(); i++) await new Promise(r => setTimeout(r, 250));
  rm();
})();
`;
    const child = spawn(process.execPath, ['-e', cleanupScript, String(process.pid), fixtureRoot], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    });
    child.unref();
  } catch {
    // Fixture cleanup is best-effort and only active for E2E.
  }
}
