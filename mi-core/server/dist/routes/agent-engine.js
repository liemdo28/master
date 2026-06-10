"use strict";
/**
 * Agent Engine Route — proxies to agent-engine bridge (port 4003).
 * Exposes: patch planning, code apply (approval-gated), git ops, company memory.
 */
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
exports.agentEngineRouter = void 0;
const express_1 = require("express");
const http_1 = __importDefault(require("http"));
exports.agentEngineRouter = (0, express_1.Router)();
const BRIDGE_URL = process.env.AGENT_ENGINE_URL || 'http://127.0.0.1:4003';
// ── Bridge proxy helper ───────────────────────────────────────────────────────
async function bridgeRequest(method, path, body) {
    return new Promise((resolve, reject) => {
        const payload = body ? JSON.stringify(body) : undefined;
        const url = new URL(BRIDGE_URL + path);
        const options = {
            hostname: url.hostname,
            port: parseInt(url.port || '4003'),
            path: `${url.pathname}${url.search}`,
            method: method.toUpperCase(),
            headers: {
                'Content-Type': 'application/json',
                ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
            },
        };
        const req = http_1.default.request(options, (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode || 500, data: JSON.parse(data) });
                }
                catch {
                    resolve({ status: res.statusCode || 500, data: { raw: data } });
                }
            });
        });
        req.on('error', () => reject(new Error('Agent engine bridge not reachable — is it running?')));
        req.setTimeout(30000, () => { req.destroy(); reject(new Error('Agent engine timeout')); });
        if (payload)
            req.write(payload);
        req.end();
    });
}
// ── Bridge status check ───────────────────────────────────────────────────────
exports.agentEngineRouter.get('/status', async (_req, res) => {
    try {
        const result = await bridgeRequest('GET', '/health');
        res.json({ connected: true, bridge: result.data });
    }
    catch {
        res.json({
            connected: false,
            message: 'Agent engine bridge offline. Start with: node mi-core/agent-engine/bridge.mjs',
        });
    }
});
exports.agentEngineRouter.get('/capabilities', async (_req, res) => {
    try {
        const result = await bridgeRequest('GET', '/capabilities');
        res.json(result.data);
    }
    catch (e) {
        res.status(503).json({ error: e.message });
    }
});
// ── Operator Harness ─────────────────────────────────────────────────────────
exports.agentEngineRouter.get('/harness/catalog', async (_req, res) => {
    try {
        const result = await bridgeRequest('GET', '/harness/catalog');
        res.status(result.status).json(result.data);
    }
    catch (e) {
        res.status(503).json({ error: e.message });
    }
});
exports.agentEngineRouter.get('/harness/plan', async (req, res) => {
    try {
        const profile = encodeURIComponent(String(req.query.profile || 'core'));
        const result = await bridgeRequest('GET', `/harness/plan?profile=${profile}`);
        res.status(result.status).json(result.data);
    }
    catch (e) {
        res.status(503).json({ error: e.message });
    }
});
exports.agentEngineRouter.get('/harness/brief', async (req, res) => {
    try {
        const profile = encodeURIComponent(String(req.query.profile || 'core'));
        const result = await bridgeRequest('GET', `/harness/brief?profile=${profile}`);
        res.status(result.status).json(result.data);
    }
    catch (e) {
        res.status(503).json({ error: e.message });
    }
});
exports.agentEngineRouter.get('/harness/context', async (req, res) => {
    try {
        const profile = encodeURIComponent(String(req.query.profile || 'core'));
        const result = await bridgeRequest('GET', `/harness/context?profile=${profile}`);
        res.status(result.status).json(result.data);
    }
    catch (e) {
        res.status(503).json({ error: e.message });
    }
});
exports.agentEngineRouter.post('/harness/materialize', async (req, res) => {
    try {
        const result = await bridgeRequest('POST', '/harness/materialize', req.body);
        res.status(result.status).json(result.data);
    }
    catch (e) {
        res.status(503).json({ error: e.message });
    }
});
// ── Patch planning (read-only, no approval needed) ───────────────────────────
exports.agentEngineRouter.post('/patch/plan', async (req, res) => {
    try {
        const { projectPath, task, context } = req.body;
        if (!projectPath || !task)
            return res.status(400).json({ error: 'projectPath and task required' });
        const result = await bridgeRequest('POST', '/patch/plan', { projectPath, task, context });
        res.status(result.status).json(result.data);
    }
    catch (e) {
        res.status(503).json({ error: e.message });
    }
});
// ── Patch validation (read-only) ──────────────────────────────────────────────
exports.agentEngineRouter.post('/patch/validate', async (req, res) => {
    try {
        const result = await bridgeRequest('POST', '/patch/validate', req.body);
        res.status(result.status).json(result.data);
    }
    catch (e) {
        res.status(503).json({ error: e.message });
    }
});
// ── Patch apply — requires approval gate (Level 2) ────────────────────────────
exports.agentEngineRouter.post('/patch/apply', async (req, res) => {
    try {
        const { enqueue } = await Promise.resolve().then(() => __importStar(require('../approval/gate')));
        const { projectPath, plan, dryRun } = req.body;
        if (!dryRun) {
            // Enqueue for approval before applying
            const action = enqueue({
                description: `Apply code patch to ${projectPath} — ${(plan?.changes?.length || 0)} files`,
                risk_level: 2,
                category: 'code-patch',
                target: projectPath,
                before_state: `${plan?.changes?.length || 0} files targeted`,
                rollback_plan: 'git checkout . to revert all changes',
            });
            return res.json({
                queued: true,
                approval_id: action.id,
                message: 'Patch queued for Level 2 approval. Approve via /api/approval/:id',
            });
        }
        // dry run: execute immediately, no changes written
        const result = await bridgeRequest('POST', '/patch/apply', { ...req.body, dryRun: true });
        res.status(result.status).json(result.data);
    }
    catch (e) {
        res.status(503).json({ error: e.message });
    }
});
// ── Git ops ───────────────────────────────────────────────────────────────────
exports.agentEngineRouter.post('/git/status', async (req, res) => {
    try {
        const result = await bridgeRequest('POST', '/git/status', req.body);
        res.status(result.status).json(result.data);
    }
    catch (e) {
        res.status(503).json({ error: e.message });
    }
});
exports.agentEngineRouter.post('/git/diff', async (req, res) => {
    try {
        const result = await bridgeRequest('POST', '/git/diff', req.body);
        res.status(result.status).json(result.data);
    }
    catch (e) {
        res.status(503).json({ error: e.message });
    }
});
// ── Company memory ────────────────────────────────────────────────────────────
exports.agentEngineRouter.get('/memory/:type', async (req, res) => {
    try {
        const result = await bridgeRequest('GET', `/memory/${req.params.type}`);
        res.status(result.status).json(result.data);
    }
    catch (e) {
        res.status(503).json({ error: e.message });
    }
});
exports.agentEngineRouter.post('/memory/:type', async (req, res) => {
    try {
        const result = await bridgeRequest('POST', `/memory/${req.params.type}`, req.body);
        res.status(result.status).json(result.data);
    }
    catch (e) {
        res.status(503).json({ error: e.message });
    }
});
// ── Recent patches list ───────────────────────────────────────────────────────
exports.agentEngineRouter.get('/patches', async (_req, res) => {
    try {
        const result = await bridgeRequest('GET', '/patches');
        res.status(result.status).json(result.data);
    }
    catch (e) {
        res.status(503).json({ error: e.message });
    }
});
