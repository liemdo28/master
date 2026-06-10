"use strict";
/**
 * Projects Route — /api/projects
 * CEO's single control point for all Master projects.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.projectsRouter = void 0;
const express_1 = require("express");
const project_scanner_1 = require("../projects/project-scanner");
const connector_router_1 = require("../projects/connector-router");
const raw_website_connector_1 = require("../projects/connectors/raw-website-connector");
const bakudan_website_connector_1 = require("../projects/connectors/bakudan-website-connector");
const dashboard_connector_1 = require("../projects/connectors/dashboard-connector");
const remote_proxy_connector_1 = require("../projects/connectors/remote-proxy-connector");
const gate_1 = require("../approval/gate");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
exports.projectsRouter = (0, express_1.Router)();
const GLOBAL_DIR = process.env.GLOBAL_DIR || 'E:/Project/Master/.local-agent-global';
// GET /api/projects — list all projects
exports.projectsRouter.get('/', async (_req, res) => {
    try {
        const projects = (0, project_scanner_1.scanAllProjects)();
        res.json({ total: projects.length, projects });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// GET /api/projects/scan — force rescan
exports.projectsRouter.get('/scan', async (_req, res) => {
    try {
        const projects = (0, project_scanner_1.scanAllProjects)(true);
        res.json({ scanned: true, total: projects.length, summary: (0, project_scanner_1.getProjectSummary)(), projects });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// GET /api/projects/health — connector health board
exports.projectsRouter.get('/health', async (_req, res) => {
    try {
        const [board, remotes] = await Promise.all([
            (0, connector_router_1.getConnectorHealthBoard)(),
            (0, remote_proxy_connector_1.getAllRemoteStatuses)(),
        ]);
        res.json({ board, remotes });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// GET /api/projects/registry — project-connectors.json
exports.projectsRouter.get('/registry', (_req, res) => {
    try {
        const file = path_1.default.join(GLOBAL_DIR, 'mi-core', 'project-connectors.json');
        if (!fs_1.default.existsSync(file))
            return res.json({ connectors: [], message: 'Registry not built yet — scan first' });
        res.json(JSON.parse(fs_1.default.readFileSync(file, 'utf-8')));
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// POST /api/projects/command — route a CEO command
exports.projectsRouter.post('/command', async (req, res) => {
    try {
        const { message } = req.body;
        if (!message)
            return res.status(400).json({ error: 'message required' });
        const result = await (0, connector_router_1.routeCommand)(message);
        res.json(result);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// GET /api/projects/:id — single project info
exports.projectsRouter.get('/:id', (req, res) => {
    try {
        const project = (0, project_scanner_1.getProjectById)(req.params.id);
        if (!project)
            return res.status(404).json({ error: `Project "${req.params.id}" not found` });
        res.json(project);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// GET /api/projects/:id/status — connector status
exports.projectsRouter.get('/:id/status', async (req, res) => {
    try {
        const id = req.params.id;
        const result = await (0, connector_router_1.routeCommand)(`Check ${id}`);
        res.json(result);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// POST /api/projects/:id/pull — pull data
exports.projectsRouter.post('/:id/pull', async (req, res) => {
    try {
        const result = await (0, connector_router_1.routeCommand)(`Pull data from ${req.params.id}`);
        res.json(result);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// POST /api/projects/:id/qa — run QA
exports.projectsRouter.post('/:id/qa', async (req, res) => {
    try {
        const id = req.params.id;
        let result;
        if (id === 'raw-website' || id === 'rawwebsite')
            result = (0, raw_website_connector_1.runRawQA)();
        else if (id === 'bakudan-website' || id === 'bakudan') {
            await (0, bakudan_website_connector_1.syncBakudanWebsite)();
            result = (0, bakudan_website_connector_1.runBakudanQA)();
        }
        else if (id === 'dashboard') {
            await (0, dashboard_connector_1.syncDashboardProject)();
            result = (0, dashboard_connector_1.runDashboardQA)();
        }
        else if (id === 'integration-system')
            result = await (0, remote_proxy_connector_1.runRemoteQA)('integration-system');
        else if (id === 'whatsapp-api')
            result = await (0, remote_proxy_connector_1.runRemoteQA)('whatsapp-api');
        else
            result = await (0, connector_router_1.routeCommand)(`Run QA ${id}`);
        res.json({ project: id, qa: result });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// POST /api/projects/:id/sync — force sync
exports.projectsRouter.post('/:id/sync', async (req, res) => {
    try {
        const id = req.params.id;
        let snap;
        if (id === 'raw-website' || id === 'rawwebsite')
            snap = (0, raw_website_connector_1.syncRawWebsite)();
        else if (id === 'bakudan-website' || id === 'bakudan')
            snap = await (0, bakudan_website_connector_1.syncBakudanWebsite)();
        else if (id === 'dashboard')
            snap = await (0, dashboard_connector_1.syncDashboardProject)();
        else if (id === 'integration-system')
            snap = await (0, remote_proxy_connector_1.syncRemoteProject)('integration-system');
        else if (id === 'whatsapp-api')
            snap = await (0, remote_proxy_connector_1.syncRemoteProject)('whatsapp-api');
        else
            return res.status(404).json({ error: `No connector for "${id}"` });
        res.json({ synced: true, data: snap });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// POST /api/projects/:id/command — preview a command (dry-run)
exports.projectsRouter.post('/:id/command', async (req, res) => {
    try {
        const { command } = req.body;
        if (!command)
            return res.status(400).json({ error: 'command required' });
        // All commands go to approval gate
        const action = (0, gate_1.enqueue)({
            risk_level: 2,
            category: 'project-command',
            target: req.params.id,
            description: `Command preview: ${command}`,
            before_state: `Project: ${req.params.id}`,
            rollback_plan: 'Reject the approval to cancel',
        });
        res.json({
            queued: true,
            approval_id: action.id,
            command,
            message: `Command queued for approval — use /api/approval/${action.id} to approve or reject`,
        });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// POST /api/projects/sync-all — sync all local connectors
exports.projectsRouter.post('/sync-all', async (_req, res) => {
    try {
        const results = {};
        const [raw, bakudan, dash, integration, whatsapp] = await Promise.allSettled([
            Promise.resolve((0, raw_website_connector_1.syncRawWebsite)()),
            (0, bakudan_website_connector_1.syncBakudanWebsite)(),
            (0, dashboard_connector_1.syncDashboardProject)(),
            (0, remote_proxy_connector_1.syncRemoteProject)('integration-system'),
            (0, remote_proxy_connector_1.syncRemoteProject)('whatsapp-api'),
        ]);
        results['raw-website'] = raw.status === 'fulfilled' ? 'ok' : 'error';
        results['bakudan-website'] = bakudan.status === 'fulfilled' ? 'ok' : 'error';
        results['dashboard'] = dash.status === 'fulfilled' ? 'ok' : 'error';
        results['integration-system'] = integration.status === 'fulfilled' ? 'ok' : integration.reason;
        results['whatsapp-api'] = whatsapp.status === 'fulfilled' ? 'ok' : whatsapp.reason;
        // Also rescan projects
        const projects = (0, project_scanner_1.scanAllProjects)(true);
        results['project-scan'] = `${projects.length} projects`;
        res.json({ synced_at: new Date().toISOString(), results });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
