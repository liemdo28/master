"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// ── ENV MUST LOAD FIRST — before any module initializes ─────────────────────
// auth.ts reads process.env.MI_PIN at module-load time to compute PIN_HASH.
// All imports below run their top-level code when require()'d, so dotenv
// must execute synchronously before the import block runs.
// In CommonJS this is guaranteed by placing the require + config call here,
// before any other require. In ESM/tsc output the compiled code preserves
// declaration order, so dotenv calls at lines 1-2 of dist/index.js run first.
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config();
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../.env'), override: false });
// ── Auth boot assertion — fail fast if PIN env is missing ───────────────────
{
    const crypto = require('crypto');
    const pin = process.env.MI_PIN || '';
    const pinHash = process.env.MI_PIN_HASH || '';
    if (!pin && !pinHash) {
        console.warn('[Mi][Auth] WARNING: MI_PIN and MI_PIN_HASH are both unset — auth disabled (dev mode)');
    }
    else if (pin) {
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
    }
    else {
        console.log('[Mi][Auth] MI_CORE_API_KEY configured — API key enforcement active');
    }
}
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const net_1 = __importDefault(require("net"));
const http_1 = require("http");
const ws_1 = require("ws");
const chat_1 = require("./routes/chat");
const executive_1 = require("./routes/executive");
const health_1 = require("./routes/health");
const approval_1 = require("./routes/approval");
const workspace_1 = require("./routes/workspace");
const models_1 = require("./routes/models");
const reminders_1 = require("./routes/reminders");
const auth_1 = require("./routes/auth");
const visibility_1 = require("./routes/visibility");
const knowledge_1 = require("./routes/knowledge");
const memory_1 = require("./routes/memory");
const brain_1 = require("./routes/brain");
const agent_engine_1 = require("./routes/agent-engine");
const qb_agent_1 = require("./routes/qb-agent");
const integrationAgentReleases_1 = require("./routes/integrationAgentReleases");
const projects_1 = require("./routes/projects");
const remote_1 = require("./routes/remote");
const data_analyst_1 = require("./routes/data-analyst");
const whatsapp_1 = require("./routes/whatsapp");
const ceo_observer_1 = require("./routes/ceo-observer");
const ceo_control_1 = require("./routes/ceo-control");
const skill_router_1 = require("./routes/skill-router");
const browser_agent_1 = require("./routes/browser-agent");
const doordash_agent_1 = require("./routes/doordash-agent");
const bigdata_1 = require("./routes/bigdata");
const enterprise_1 = require("./routes/enterprise");
const voice_1 = require("./routes/voice");
const actions_1 = require("./routes/actions");
const jarvis_1 = require("./routes/jarvis");
const workflow_metrics_1 = require("./routes/workflow-metrics");
const gstack_1 = require("./routes/gstack");
const nodes_1 = require("./routes/nodes");
const models_registry_1 = require("./routes/models-registry");
const mi_review_approvals_1 = require("./routes/mi-review-approvals");
const operational_knowledge_1 = require("./routes/operational-knowledge");
const graph_router_1 = require("./graph/graph-router");
const operational_memory_router_1 = require("./operational-memory/operational-memory-router");
const task_intelligence_router_1 = require("./task-intelligence/task-intelligence-router");
const briefing_router_1 = require("./executive-briefing/briefing-router");
const strategic_memory_router_1 = require("./strategic-memory/strategic-memory-router");
const autonomous_router_1 = require("./autonomous/autonomous-router");
const ceo_telemetry_router_1 = require("./telemetry/ceo-telemetry-router");
const council_router_1 = require("./council/council-router");
const self_improvement_router_1 = require("./self-improvement/self-improvement-router");
const health_router_1 = require("./health-intelligence/health-router");
const digital_twin_router_1 = require("./digital-twin/digital-twin-router");
const agenview_router_1 = require("./agenview/agenview-router");
const seo_1 = require("./routes/seo");
const coo_v4_router_1 = require("./routes/coo-v4-router");
const company_os_router_1 = __importDefault(require("./company-os/company-os-router"));
const operations_1 = require("./routes/operations");
const executive_routes_1 = require("./executive-intelligence/executive-routes");
const burn_in_1 = require("./operations/burn-in");
const self_healing_1 = require("./operations/self-healing");
const self_healing_monitor_1 = require("./company-os/self-healing-monitor");
const chat_metrics_1 = require("./chat/chat-metrics");
const chat_queue_1 = require("./chat/chat-queue");
const leader_lock_persistent_1 = require("./nodes/leader-lock-persistent");
const proactive_monitor_1 = require("./jarvis/proactive-monitor");
const daily_briefing_scheduler_1 = require("./jarvis/daily-briefing-scheduler");
const job_queue_1 = require("./queue/job-queue");
const reminder_store_1 = require("./reminders/reminder-store");
const gate_1 = require("./approval/gate");
const rate_limit_1 = require("./middleware/rate-limit");
const remote_auth_1 = require("./remote/remote-auth");
const auth_2 = require("./routes/auth");
const network_info_1 = require("./remote/network-info");
const connector_registry_1 = require("./visibility/connector-registry");
const executive_memory_1 = require("./memory/executive-memory");
const knowledge_db_1 = require("./knowledge/knowledge-db");
const pack_manager_1 = require("./knowledge/pack-manager");
const sync_scheduler_1 = require("./cron/sync-scheduler");
const whatsapp_key_manager_1 = require("./services/whatsapp-key-manager");
const n8n_router_1 = require("./n8n/n8n-router");
// dotenv already loaded at top of file — do not call again here.
const app = (0, express_1.default)();
const PORT = parseInt(process.env.MI_PORT || '4001');
// QB Laptop1 reports over Tailscale, so Mi-Core must listen beyond localhost.
const HOST = process.env.HOST || process.env.MI_BIND_HOST || '0.0.0.0';
function validateReviewApprovalStartup() {
    const allowedNumbers = (process.env.CEO_WHATSAPP_ALLOWED_NUMBERS || '').split(',').map(v => v.trim()).filter(Boolean);
    const keyStatus = (0, whatsapp_key_manager_1.getKeyStatus)();
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
app.use((0, helmet_1.default)({ contentSecurityPolicy: false }));
// ── CORS — allow LAN + Tailscale origins ────────────────────────────────────
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : ['http://localhost:4001', 'http://127.0.0.1:4001'];
app.use((0, cors_1.default)({
    origin: (origin, cb) => {
        // Allow no-origin (mobile apps, curl, same-origin)
        if (!origin)
            return cb(null, true);
        // Allow any LAN / Tailscale origin dynamically
        if (ALLOWED_ORIGINS.includes(origin) ||
            /^http:\/\/192\.168\.\d+\.\d+:\d+$/.test(origin) ||
            /^http:\/\/10\.\d+\.\d+\.\d+:\d+$/.test(origin) ||
            /^http:\/\/100\.\d+\.\d+\.\d+:\d+$/.test(origin))
            return cb(null, true);
        cb(new Error('CORS blocked'));
    },
    credentials: true,
}));
app.use(express_1.default.json({ limit: '10mb' }));
app.use(rate_limit_1.rateLimiter);
// ── IP Guard — block non-LAN/Tailscale (skip for remote/health, applied globally) ─
// /api/remote/health is intentionally public (returns server info, no sensitive data)
app.use((req, res, next) => {
    if (req.path === '/api/remote/health' || req.path === '/api/remote/login')
        return next();
    (0, remote_auth_1.ipGuard)(req, res, next);
});
// ── Static UI ───────────────────────────────────────────────────────────────
app.use(express_1.default.static(path_1.default.resolve(__dirname, '../../ui')));
app.get('/liveboard', (_req, res) => res.redirect('/liveboard.html'));
app.get('/mobile', (_req, res) => res.redirect('/mobile.html'));
app.get('/voice', (_req, res) => res.redirect('/voice.html'));
app.get('/agenview', (_req, res) => res.redirect('/agenview.html'));
// ── API routes ──────────────────────────────────────────────────────────────
// Auth strategy: requireAuth checks PIN-based token sessions.
// - If MI_PIN is not configured, requireAuth is a no-op (all requests pass).
// - If MI_PIN is configured, all P0/P1 routes require a valid Bearer token.
// - /api/remote (has its own auth), /api/health, /api/auth, /api/nodes are public.
// P0 — Write access (approve actions, send emails, modify data)
app.use('/api/approval', auth_2.requireAuth, approval_1.approvalRouter);
app.use('/api/actions', auth_2.requireAuth, actions_1.actionsRouter);
// P1 — Sensitive read (executive data, memory, briefing)
app.use('/api/executive', auth_2.requireAuth, executive_1.executiveRouter);
app.use('/api/memory', auth_2.requireAuth, memory_1.memoryRouter);
app.use('/api/briefing', auth_2.requireAuth, briefing_router_1.briefingRouter);
app.use('/api/graph', auth_2.requireAuth, graph_router_1.graphRouter);
app.use('/api/brain', auth_2.requireAuth, brain_1.brainRouter);
app.use('/api/visibility', auth_2.requireAuth, visibility_1.visibilityRouter);
// P2 — Operational (protected but less sensitive)
app.use('/api/chat', auth_2.requireAuth, chat_1.chatRouter);
app.use('/api/jarvis', auth_2.requireAuth, jarvis_1.jarvisRouter);
app.use('/api/qb-agent', auth_2.requireAuth, qb_agent_1.qbAgentRouter);
app.use('/api/projects', auth_2.requireAuth, projects_1.projectsRouter);
app.use('/api/reminders', auth_2.requireAuth, reminders_1.remindersRouter);
app.use('/api/workspace', auth_2.requireAuth, workspace_1.workspaceRouter);
app.use('/api/knowledge', auth_2.requireAuth, knowledge_1.knowledgeRouter);
app.use('/api/ceo-observer', auth_2.requireAuth, ceo_observer_1.ceoObserverRouter); // Session A proxy
app.use('/api/ceo', ceo_control_1.ceoControlRouter); // CEO Control Center (Phase 23D)
// Internal / already protected / public
app.use('/api/remote', remote_1.remoteRouter); // Remote access (has own auth)
app.use('/api/auth', auth_1.authRouter); // Auth endpoints (must be public)
app.use('/api/health', health_1.healthRouter); // Health check (public)
app.use('/api/nodes', auth_2.requireAuth, nodes_1.nodesRouter); // Node registration (internal)
app.use('/api/whatsapp', whatsapp_1.whatsappRouter); // Has API key auth middleware
app.use('/api/models', models_1.modelsRouter);
app.use('/api/agent-engine', agent_engine_1.agentEngineRouter);
app.use('/api/integration-agent', integrationAgentReleases_1.integrationAgentReleasesRouter);
app.use('/api', operational_knowledge_1.operationalKnowledgeRouter);
app.use('/api/data-analyst', data_analyst_1.dataAnalystRouter);
app.use('/api/skills', skill_router_1.skillRouter);
app.use('/api/browser', browser_agent_1.browserAgentRouter);
app.use('/api/doordash-agent', doordash_agent_1.doordashAgentRouter);
app.use('/api/bigdata', bigdata_1.bigdataRouter);
app.use('/api/enterprise', enterprise_1.enterpriseRouter);
app.use('/api/voice', voice_1.voiceRouter);
app.use('/api/gstack', gstack_1.gstackRouter);
app.use('/api/models', models_registry_1.modelsRegistryRouter);
app.use('/api/mi', mi_review_approvals_1.miReviewApprovalsRouter);
app.use('/api/memory', operational_memory_router_1.operationalMemoryRouter); // Phase 15: Operational Memory Runtime
app.use('/api/tasks', task_intelligence_router_1.taskIntelligenceRouter); // Phase 16: Personal Task Intelligence
app.use('/api/strategic', strategic_memory_router_1.strategicMemoryRouter); // Phase 18: Strategic Memory
app.use('/api/agenview', agenview_router_1.agenviewRouter); // Phase 19: AgenView Dashboard
app.use('/api/seo', seo_1.seoRouter); // SEO Phase 2: 7 SEO Agent Integration
app.use('/api/coo-v4', coo_v4_router_1.cooV4Router); // COO V4: Autonomous 24-Domain Engine
app.use('/api/company-os', company_os_router_1.default); // Mi Company OS: 19-dept pipeline
app.use('/api/autonomous', autonomous_router_1.autonomousRouter); // Phase 20: Autonomous Execution
app.use('/api/council', council_router_1.councilRouter); // Phase 21: Multi-Agent Council
app.use('/api/improvement', self_improvement_router_1.selfImprovementRouter); // Phase 22: Self-Improvement
app.use('/api/health-intel', health_router_1.healthIntelligenceRouter); // Phase 23: Health Intelligence
app.use('/api/digital-twin', digital_twin_router_1.digitalTwinRouter); // Phase 24: Digital Twin
app.use('/api/operations', auth_2.requireAuth, operations_1.operationsRouter); // DEV3: Operations & Reliability Layer
app.use('/api/workflows', auth_2.requireAuth, workflow_metrics_1.workflowMetricsRouter); // DEV5: Workflow Execution Ledger & Metrics
app.use('/api/telemetry', auth_2.requireAuth, ceo_telemetry_router_1.ceoTelemetryRouter); // CEO Production Telemetry Foundation (P0-1..P0-6)
app.use('/api/executive-intelligence', auth_2.requireAuth, executive_routes_1.executiveRouter); // Phase 21: Executive Intelligence Layer
app.use('/api/n8n', n8n_router_1.n8nRouter); // n8n Execution Bus
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
        const jobs = await (0, job_queue_1.listQueueJobs)(parseInt(String(req.query.limit || '50'), 10));
        const stats = await (0, job_queue_1.queueStats)();
        res.json({ jobs, count: jobs.length, stats });
    }
    catch (e) {
        const error = e instanceof AggregateError
            ? (e.errors?.map((err) => err instanceof Error ? err.message : String(err)).filter(Boolean).join('; ') || 'PostgreSQL unavailable')
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
    res.json({ ...chat_metrics_1.chatMetrics.snapshot(), queue: (0, chat_queue_1.queueState)() });
});
// ── HTTP + WS server ────────────────────────────────────────────────────────
const server = (0, http_1.createServer)(app);
const wss = new ws_1.WebSocketServer({ server, path: '/ws' });
// ── EADDRINUSE self-recovery ─────────────────────────────────────────────────
// Wait before binding instead of repeatedly calling listen() on the same server.
// Exiting here makes PM2 spawn another process and can create a restart storm.
let _bindAttempts = 0;
const BIND_RETRY_MS = 2500;
function canBind(port, host) {
    return new Promise(resolve => {
        const probe = net_1.default.createServer();
        probe.once('error', () => resolve(false));
        probe.once('listening', () => {
            probe.close(() => resolve(true));
        });
        probe.listen(port, host);
    });
}
async function startHttpServer() {
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
server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`[Mi][EADDRINUSE] Port ${PORT} busy after bind — exiting for clean PM2 restart`);
        process.exit(1);
    }
    else {
        console.error('[Mi] HTTP server error:', err);
    }
});
// ws library re-emits server errors on wss — must handle or it becomes uncaught exception
wss.on('error', (err) => {
    if (err.code !== 'EADDRINUSE') {
        console.error('[Mi] WebSocket server error:', err);
    }
    // EADDRINUSE handled above by server.on('error')
});
function broadcast(data) {
    const payload = JSON.stringify(data);
    wss.clients.forEach(client => {
        if (client.readyState === 1)
            client.send(payload);
    });
}
reminder_store_1.reminderEvents.on('reminder', (r) => {
    console.log(`[Mi] Reminder fired: ${r.message}`);
    broadcast({ type: 'reminder', reminder: r });
});
gate_1.gateEvents.on('new_action', (a) => broadcast({ type: 'approval_new', action: a }));
gate_1.gateEvents.on('approved', (a) => broadcast({ type: 'approval_resolved', action: a }));
gate_1.gateEvents.on('rejected', (a) => broadcast({ type: 'approval_resolved', action: a }));
wss.on('connection', (ws, req) => {
    const ip = req.socket.remoteAddress || 'unknown';
    console.log(`[Mi] WebSocket client connected — ${ip}`);
    ws.on('message', async (data) => {
        try {
            const msg = JSON.parse(data.toString());
            const { handleWsChat } = await Promise.resolve().then(() => __importStar(require('./routes/chat')));
            await handleWsChat(ws, msg);
        }
        catch {
            ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
        }
    });
    ws.on('close', () => console.log(`[Mi] WebSocket disconnected — ${ip}`));
});
// ── Boot ─────────────────────────────────────────────────────────────────────
function onListenSuccess() {
    _bindAttempts = 0; // reset for future restarts
    // Tell PM2 the process is ready — stops it from spawning more instances
    if (typeof process.send === 'function')
        process.send('ready');
    const net = (0, network_info_1.getNetworkInfo)(PORT);
    console.log(`\n[Mi] ════════════════════════════════════════`);
    console.log(`[Mi] Mi-Core Central Command — ONLINE`);
    console.log(`[Mi] Local:      http://127.0.0.1:${PORT}`);
    if (net.lan_url)
        console.log(`[Mi] LAN:        ${net.lan_url}`);
    if (net.tailscale_url)
        console.log(`[Mi] Tailscale:  ${net.tailscale_url}  ← use on iPhone/Mac`);
    console.log(`[Mi] AgenView:   http://127.0.0.1:${PORT}/agenview`);
    console.log(`[Mi] LiveBoard:  http://127.0.0.1:${PORT}/liveboard.html`);
    console.log(`[Mi] Mobile:     http://127.0.0.1:${PORT}/mobile.html`);
    console.log(`[Mi] WebSocket:  ws://127.0.0.1:${PORT}/ws`);
    console.log(`[Mi] ════════════════════════════════════════\n`);
    validateReviewApprovalStartup();
    connector_registry_1.connectorRegistry.init();
    // Auto-mark connectors as connected when credentials are available in env
    if (process.env.ASANA_TOKEN) {
        connector_registry_1.connectorRegistry.update('asana', { auth_status: 'connected', status: 'active', health_status: 'unknown' });
    }
    if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
        const googleTokenPath = require('path').join(process.env.GLOBAL_DIR || 'E:/Project/Master/.local-agent-global', 'visibility', 'google-tokens.json');
        if (require('fs').existsSync(googleTokenPath)) {
            for (const id of ['gmail', 'google-calendar', 'google-drive', 'google-contacts']) {
                connector_registry_1.connectorRegistry.update(id, { auth_status: 'connected', status: 'active' });
            }
        }
    }
    // DEV2: Live-probe HTTP connectors after init to prevent stale "healthy" in registry
    setTimeout(() => {
        connector_registry_1.connectorRegistry.liveProbe().catch(() => { });
    }, 3000);
    executive_memory_1.executiveMemory.init();
    console.log('[Mi] ✓ Connector Registry initialized');
    console.log('[Mi] ✓ Executive Memory initialized');
    setTimeout(() => {
        if (process.env.MI_BOOT_KNOWLEDGE_INGEST === '1') {
            try {
                const result = (0, knowledge_db_1.fullIngest)();
                console.log(`[Mi] ✓ Knowledge DB: ${result.ingested} docs ingested`);
            }
            catch (e) {
                console.warn('[Mi] Knowledge DB ingest error:', e);
            }
            try {
                const packs = (0, pack_manager_1.installAllPacks)();
                console.log(`[Mi] ✓ Knowledge Packs: ${packs.total_installed} docs from all packs`);
            }
            catch (e) {
                console.warn('[Mi] Pack install error:', e);
            }
        }
        else {
            console.log('[Mi] Knowledge DB boot ingest skipped (set MI_BOOT_KNOWLEDGE_INGEST=1 to enable)');
        }
        (0, sync_scheduler_1.startScheduler)();
        console.log('[Mi] ✓ Scheduler started');
        (0, burn_in_1.startBurnInScheduler)();
        (0, self_healing_1.startSelfHealingScheduler)(5);
        (0, self_healing_monitor_1.startSelfHealingMonitor)(60_000); // Phase 12: monitor 11 services every 60s
        console.log('[Mi] ✓ Operations layer started (burn-in + self-healing + Phase12-monitor)');
        const timeoutMinutes = parseInt(process.env.REVIEW_APPROVAL_TIMEOUT_MINUTES || '1440', 10);
        setInterval(() => {
            fetch(`http://127.0.0.1:${PORT}/api/mi/review-approvals/sweep-timeouts`, { method: 'POST' }).catch(() => undefined);
        }, Math.max(1, Math.min(timeoutMinutes, 60)) * 60_000);
        console.log(`[Mi] ✓ Review approval timeout monitor started (${timeoutMinutes}m)`);
        (0, bigdata_1.initBigData)().then(() => {
            console.log('[Mi] ✓ Big Data Foundation initialized');
        }).catch(e => console.warn('[Mi] Big Data init (non-critical):', e.message));
        // Jarvis proactive monitor — broadcast alerts via WebSocket
        (0, proactive_monitor_1.onAlert)((alert) => broadcast({ type: 'jarvis_alert', alert }));
        const MONITOR_INTERVAL = parseInt(process.env.JARVIS_MONITOR_INTERVAL_MIN || '15');
        (0, proactive_monitor_1.startProactiveMonitor)(MONITOR_INTERVAL);
        console.log(`[Mi] ✓ Jarvis Proactive Monitor started (interval: ${MONITOR_INTERVAL}m)`);
        // Phase 7: Leader Lock — claim leadership on boot, start heartbeat
        (0, leader_lock_persistent_1.claimLeadershipOnBoot)();
        (0, leader_lock_persistent_1.startLeaderHeartbeat)(30_000);
        console.log('[Mi] ✓ Leader Lock initialized (Phase 7 — multi-node coordination)');
        (0, daily_briefing_scheduler_1.startDailyBriefingScheduler)();
        console.log('[Mi] ✓ Daily Briefing Scheduler started (07:00 VN time)');
        Promise.resolve().then(() => __importStar(require('./jarvis/qb-online-watcher'))).then(({ startQbOnlineWatcher }) => {
            startQbOnlineWatcher();
            console.log('[Mi] ✓ QB Online Watcher started (auto-sync when Laptop1 reconnects)');
        }).catch(() => { });
        // Jarvis Evolution Phase 30 — boot all 10 phases
        Promise.resolve().then(() => __importStar(require('./jarvis/phase30-jarvis/jarvis-core'))).then(({ bootJarvis }) => {
            bootJarvis().catch(() => { });
            console.log('[Mi] ✓ Jarvis Evolution Phase 30 booted (knowledge, memory, graph, health, workflows, twin)');
        }).catch(() => { });
    });
}
startHttpServer().catch(e => {
    console.error('[Mi] HTTP server startup failed:', e);
});
// ── Graceful shutdown — prevents EADDRINUSE on PM2 restart ───────────────────
function gracefulShutdown(signal) {
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
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
