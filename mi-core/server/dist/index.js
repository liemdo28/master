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
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const path_1 = __importDefault(require("path"));
const http_1 = require("http");
const ws_1 = require("ws");
const dotenv_1 = __importDefault(require("dotenv"));
const chat_1 = require("./routes/chat");
const executive_1 = require("./routes/executive");
const profile_1 = require("./routes/profile");
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
const skill_router_1 = require("./routes/skill-router");
const browser_agent_1 = require("./routes/browser-agent");
const doordash_agent_1 = require("./routes/doordash-agent");
const bigdata_1 = require("./routes/bigdata");
const enterprise_1 = require("./routes/enterprise");
const voice_1 = require("./routes/voice");
const actions_1 = require("./routes/actions");
const jarvis_1 = require("./routes/jarvis");
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
const council_router_1 = require("./council/council-router");
const self_improvement_router_1 = require("./self-improvement/self-improvement-router");
const health_router_1 = require("./health-intelligence/health-router");
const digital_twin_router_1 = require("./digital-twin/digital-twin-router");
const agenview_router_1 = require("./agenview/agenview-router");
const coo_v4_router_1 = require("./routes/coo-v4-router");
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
const network_info_1 = require("./remote/network-info");
const connector_registry_1 = require("./visibility/connector-registry");
const executive_memory_1 = require("./memory/executive-memory");
const knowledge_db_1 = require("./knowledge/knowledge-db");
const pack_manager_1 = require("./knowledge/pack-manager");
const sync_scheduler_1 = require("./cron/sync-scheduler");
const whatsapp_key_manager_1 = require("./services/whatsapp-key-manager");
dotenv_1.default.config();
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../.env'), override: false });
const app = (0, express_1.default)();
const PORT = parseInt(process.env.MI_PORT || '4001');
// Bind to 0.0.0.0 when MOBILE_ACCESS=1 or HOST env set; default localhost for safety
const HOST = process.env.HOST || (process.env.MOBILE_ACCESS === '1' ? '0.0.0.0' : '127.0.0.1');
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
app.use('/api/remote', remote_1.remoteRouter); // Remote access (login/health/devices)
app.use('/api/chat', chat_1.chatRouter);
app.use('/api/executive', executive_1.executiveRouter);
app.use('/api/profile', profile_1.profileRouter);
app.use('/api/health', health_1.healthRouter);
app.use('/api/approval', approval_1.approvalRouter);
app.use('/api/workspace', workspace_1.workspaceRouter);
app.use('/api/auth', auth_1.authRouter);
app.use('/api/models', models_1.modelsRouter);
app.use('/api/reminders', reminders_1.remindersRouter);
app.use('/api/visibility', visibility_1.visibilityRouter);
app.use('/api/knowledge', knowledge_1.knowledgeRouter);
app.use('/api/memory', memory_1.memoryRouter);
app.use('/api/brain', brain_1.brainRouter);
app.use('/api/agent-engine', agent_engine_1.agentEngineRouter);
app.use('/api/qb-agent', qb_agent_1.qbAgentRouter);
app.use('/api/integration-agent', integrationAgentReleases_1.integrationAgentReleasesRouter);
app.use('/api', operational_knowledge_1.operationalKnowledgeRouter);
app.use('/api/projects', projects_1.projectsRouter);
app.use('/api/data-analyst', data_analyst_1.dataAnalystRouter);
app.use('/api/whatsapp', whatsapp_1.whatsappRouter);
app.use('/api/skills', skill_router_1.skillRouter);
app.use('/api/browser', browser_agent_1.browserAgentRouter);
app.use('/api/doordash-agent', doordash_agent_1.doordashAgentRouter);
app.use('/api/bigdata', bigdata_1.bigdataRouter);
app.use('/api/enterprise', enterprise_1.enterpriseRouter);
app.use('/api/voice', voice_1.voiceRouter);
app.use('/api/actions', actions_1.actionsRouter);
app.use('/api/jarvis', jarvis_1.jarvisRouter);
app.use('/api/gstack', gstack_1.gstackRouter);
app.use('/api/nodes', nodes_1.nodesRouter);
app.use('/api/models', models_registry_1.modelsRegistryRouter);
app.use('/api/mi', mi_review_approvals_1.miReviewApprovalsRouter);
app.use('/api/graph', graph_router_1.graphRouter); // Phase 14: Ownership + Dependency Graph
app.use('/api/memory', operational_memory_router_1.operationalMemoryRouter); // Phase 15: Operational Memory Runtime
app.use('/api/tasks', task_intelligence_router_1.taskIntelligenceRouter); // Phase 16: Personal Task Intelligence
app.use('/api/briefing', briefing_router_1.briefingRouter); // Phase 17: Executive Daily Briefing
app.use('/api/strategic', strategic_memory_router_1.strategicMemoryRouter); // Phase 18: Strategic Memory
app.use('/api/agenview', agenview_router_1.agenviewRouter); // Phase 19: AgenView Dashboard
app.use('/api/coo-v4', coo_v4_router_1.cooV4Router); // COO V4: Autonomous 24-Domain Engine
app.use('/api/autonomous', autonomous_router_1.autonomousRouter); // Phase 20: Autonomous Execution
app.use('/api/council', council_router_1.councilRouter); // Phase 21: Multi-Agent Council
app.use('/api/improvement', self_improvement_router_1.selfImprovementRouter); // Phase 22: Self-Improvement
app.use('/api/health-intel', health_router_1.healthIntelligenceRouter); // Phase 23: Health Intelligence
app.use('/api/digital-twin', digital_twin_router_1.digitalTwinRouter); // Phase 24: Digital Twin
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
server.on('error', (err) => {
    console.error('[Mi] HTTP server listen error:', err);
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
server.listen(PORT, HOST, () => {
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
        // Jarvis Evolution Phase 30 — boot all 10 phases
        Promise.resolve().then(() => __importStar(require('./jarvis/phase30-jarvis/jarvis-core'))).then(({ bootJarvis }) => {
            bootJarvis().catch(() => { });
            console.log('[Mi] ✓ Jarvis Evolution Phase 30 booted (knowledge, memory, graph, health, workflows, twin)');
        }).catch(() => { });
    });
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
