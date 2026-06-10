"use strict";
/**
 * Remote Proxy Connector
 * Proxies to mi-remote-agent running on a different machine (LAN/Tailscale).
 * Used for: integration-system, whatsapp-api
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkRemoteAgent = checkRemoteAgent;
exports.syncRemoteProject = syncRemoteProject;
exports.getCachedRemote = getCachedRemote;
exports.executeRemoteAction = executeRemoteAction;
exports.runRemoteQA = runRemoteQA;
exports.previewRemoteCommand = previewRemoteCommand;
exports.getAllRemoteStatuses = getAllRemoteStatuses;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const http_1 = __importDefault(require("http"));
const https_1 = __importDefault(require("https"));
const GLOBAL_DIR = process.env.GLOBAL_DIR || 'E:/Project/Master/.local-agent-global';
const REMOTE_TOKEN = process.env.MI_REMOTE_TOKEN || 'mi-remote-changeme';
// Default configs — override via env or project-connectors.json
const DEFAULT_REMOTE_AGENTS = [
    {
        agent_id: 'integration-system',
        name: 'Integration System',
        host: process.env.INTEGRATION_SYSTEM_HOST || '',
        port: parseInt(process.env.INTEGRATION_SYSTEM_PORT || '4005'),
        project_id: 'integration-system',
        token: process.env.MI_REMOTE_TOKEN || REMOTE_TOKEN,
    },
    {
        agent_id: 'whatsapp-api',
        name: 'WhatsApp API',
        host: process.env.WHATSAPP_HOST || '',
        port: parseInt(process.env.WHATSAPP_PORT || '4005'),
        project_id: 'whatsapp-ai-gateway',
        token: process.env.MI_REMOTE_TOKEN || REMOTE_TOKEN,
    },
];
function getConfig(agentId) {
    // Check project-connectors.json first
    const registryFile = path_1.default.join(GLOBAL_DIR, 'mi-core', 'project-connectors.json');
    if (fs_1.default.existsSync(registryFile)) {
        try {
            const registry = JSON.parse(fs_1.default.readFileSync(registryFile, 'utf-8'));
            const found = registry.connectors?.find((c) => c.agent_id === agentId || c.project_id === agentId);
            if (found?.host)
                return found;
        }
        catch { /* ignore */ }
    }
    return DEFAULT_REMOTE_AGENTS.find(a => a.agent_id === agentId) || null;
}
async function remoteRequest(config, method, endpoint, body, timeoutMs = 8000) {
    return new Promise((resolve) => {
        if (!config.host) {
            resolve({ ok: false, status: 0, data: { error: 'Host not configured' } });
            return;
        }
        const payload = body ? JSON.stringify(body) : undefined;
        const isHttps = config.host.startsWith('https://');
        const host = config.host.replace(/^https?:\/\//, '');
        const lib = isHttps ? https_1.default : http_1.default;
        const options = {
            hostname: host,
            port: config.port,
            path: endpoint,
            method: method.toUpperCase(),
            headers: {
                'Content-Type': 'application/json',
                'X-Mi-Token': config.token,
                ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
            },
            timeout: timeoutMs,
        };
        const req = lib.request(options, (res) => {
            let data = '';
            res.on('data', c => { data += c; });
            res.on('end', () => {
                try {
                    resolve({ ok: (res.statusCode || 0) < 400, status: res.statusCode || 0, data: JSON.parse(data) });
                }
                catch {
                    resolve({ ok: false, status: res.statusCode || 0, data: { raw: data } });
                }
            });
        });
        req.on('error', (e) => resolve({ ok: false, status: 0, data: { error: e.message } }));
        req.on('timeout', () => { req.destroy(); resolve({ ok: false, status: 0, data: { error: 'timeout' } }); });
        if (payload)
            req.write(payload);
        req.end();
    });
}
async function checkRemoteAgent(agentId) {
    const config = getConfig(agentId);
    const now = new Date().toISOString();
    if (!config || !config.host) {
        return {
            agent_id: agentId, name: agentId, reachable: false,
            project_id: agentId, host: '',
            last_checked: now,
            error: `Remote agent not configured. Set ${agentId.toUpperCase().replace(/-/g, '_')}_HOST in .env`,
        };
    }
    const result = await remoteRequest(config, 'GET', '/health', undefined, 5000);
    return {
        agent_id: config.agent_id,
        name: config.name,
        reachable: result.ok,
        project_id: config.project_id,
        host: `${config.host}:${config.port}`,
        status: result.ok ? 'online' : 'unreachable',
        last_checked: now,
        error: result.ok ? undefined : String(result.data?.error || 'Connection failed'),
    };
}
async function syncRemoteProject(agentId) {
    const config = getConfig(agentId);
    const now = new Date().toISOString();
    const cacheDir = path_1.default.join(GLOBAL_DIR, 'mi-core', 'connectors', agentId);
    if (!config || !config.host) {
        const snap = {
            synced_at: now, status: 'not_configured', agent_id: agentId, name: agentId,
            host: '',
            summary_text: [
                `🔗 ${agentId}: Remote agent NOT configured`,
                `  To connect: set ${agentId.toUpperCase().replace(/-/g, '_')}_HOST=<ip> in mi-core/.env`,
                `  Then deploy mi-remote-agent on the remote machine`,
                `  Install: copy mi-core/mi-remote-agent/ to remote, run: node index.mjs`,
            ].join('\n'),
        };
        cacheSnapshot(cacheDir, snap);
        return snap;
    }
    // Get status from remote
    const [statusRes, logsRes, errorsRes] = await Promise.all([
        remoteRequest(config, 'GET', '/project/status'),
        remoteRequest(config, 'GET', '/project/logs'),
        remoteRequest(config, 'GET', '/project/errors'),
    ]);
    if (!statusRes.ok) {
        const snap = {
            synced_at: now, status: 'unreachable', agent_id: agentId,
            name: config.name, host: `${config.host}:${config.port}`,
            errors: [String(statusRes.data?.error || 'Connection failed')],
            summary_text: [
                `🔗 ${config.name}: UNREACHABLE`,
                `  Host: ${config.host}:${config.port}`,
                `  Error: ${statusRes.data?.error || 'Connection failed'}`,
                `  Make sure mi-remote-agent is running on the remote machine`,
            ].join('\n'),
        };
        cacheSnapshot(cacheDir, snap);
        return snap;
    }
    const projectData = statusRes.data;
    const logs = Array.isArray(logsRes.data?.logs) ? logsRes.data.logs.slice(-20) : [];
    const errors = Array.isArray(errorsRes.data?.errors) ? errorsRes.data.errors.slice(-10) : [];
    const snap = {
        synced_at: now, status: 'live', agent_id: agentId, name: config.name,
        host: `${config.host}:${config.port}`,
        project_data: projectData,
        logs,
        errors,
        summary_text: [
            `🔗 ${config.name}: ✓ CONNECTED`,
            `  Host: ${config.host}:${config.port}`,
            `  Status: ${JSON.stringify(projectData).slice(0, 100)}`,
            errors.length ? `  Recent errors: ${errors.length}` : '  No recent errors',
        ].join('\n'),
    };
    cacheSnapshot(cacheDir, snap);
    return snap;
}
function cacheSnapshot(cacheDir, snap) {
    fs_1.default.mkdirSync(cacheDir, { recursive: true });
    fs_1.default.writeFileSync(path_1.default.join(cacheDir, 'data.json'), JSON.stringify(snap, null, 2));
    fs_1.default.writeFileSync(path_1.default.join(cacheDir, 'health.json'), JSON.stringify({ status: snap.status, host: snap.host, synced_at: snap.synced_at }));
    fs_1.default.writeFileSync(path_1.default.join(cacheDir, 'last_sync.json'), JSON.stringify({ synced_at: snap.synced_at }));
    fs_1.default.writeFileSync(path_1.default.join(cacheDir, 'errors.json'), JSON.stringify(snap.errors || []));
}
function getCachedRemote(agentId) {
    try {
        return JSON.parse(fs_1.default.readFileSync(path_1.default.join(GLOBAL_DIR, 'mi-core', 'connectors', agentId, 'data.json'), 'utf-8'));
    }
    catch {
        return null;
    }
}
// Execute approved action on remote
async function executeRemoteAction(agentId, action) {
    const config = getConfig(agentId);
    if (!config)
        throw new Error(`Remote agent ${agentId} not configured`);
    const result = await remoteRequest(config, 'POST', '/project/execute-approved-action', action);
    if (!result.ok)
        throw new Error(String(result.data?.error || 'Remote execution failed'));
    return result.data;
}
async function runRemoteQA(agentId) {
    const config = getConfig(agentId);
    if (!config)
        return { error: `Agent ${agentId} not configured` };
    const result = await remoteRequest(config, 'POST', '/project/qa', {});
    return result.data;
}
async function previewRemoteCommand(agentId, command) {
    const config = getConfig(agentId);
    if (!config)
        return { error: `Agent ${agentId} not configured` };
    const result = await remoteRequest(config, 'POST', '/project/command-preview', { command });
    return result.data;
}
function getAllRemoteStatuses() {
    return Promise.all(DEFAULT_REMOTE_AGENTS.map(a => checkRemoteAgent(a.agent_id)));
}
