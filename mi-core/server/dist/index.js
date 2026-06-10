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
const http_1 = require("http");
const ws_1 = require("ws");
const dotenv_1 = __importDefault(require("dotenv"));
const chat_1 = require("./routes/chat");
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
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = parseInt(process.env.MI_PORT || '4001');
// Bind to 0.0.0.0 when MOBILE_ACCESS=1 or HOST env set; default localhost for safety
const HOST = process.env.HOST || (process.env.MOBILE_ACCESS === '1' ? '0.0.0.0' : '127.0.0.1');
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
app.use(express_1.default.static('../ui'));
app.get('/liveboard', (_req, res) => res.redirect('/liveboard.html'));
app.get('/mobile', (_req, res) => res.redirect('/mobile.html'));
// ── API routes ──────────────────────────────────────────────────────────────
app.use('/api/remote', remote_1.remoteRouter); // Remote access (login/health/devices)
app.use('/api/chat', chat_1.chatRouter);
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
app.use('/api/projects', projects_1.projectsRouter);
app.use('/api/data-analyst', data_analyst_1.dataAnalystRouter);
// ── HTTP + WS server ────────────────────────────────────────────────────────
const server = (0, http_1.createServer)(app);
const wss = new ws_1.WebSocketServer({ server, path: '/ws' });
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
    console.log(`[Mi] LiveBoard:  http://127.0.0.1:${PORT}/liveboard.html`);
    console.log(`[Mi] Mobile:     http://127.0.0.1:${PORT}/mobile.html`);
    console.log(`[Mi] WebSocket:  ws://127.0.0.1:${PORT}/ws`);
    console.log(`[Mi] ════════════════════════════════════════\n`);
    connector_registry_1.connectorRegistry.init();
    executive_memory_1.executiveMemory.init();
    console.log('[Mi] ✓ Connector Registry initialized');
    console.log('[Mi] ✓ Executive Memory initialized');
    setImmediate(() => {
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
        (0, sync_scheduler_1.startScheduler)();
        console.log('[Mi] ✓ Scheduler started');
    });
});
