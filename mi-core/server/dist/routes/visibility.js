"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.visibilityRouter = void 0;
const express_1 = require("express");
const visibility_hub_1 = require("../visibility/visibility-hub");
const connector_registry_1 = require("../visibility/connector-registry");
const local_projects_1 = require("../visibility/connectors/local-projects");
exports.visibilityRouter = (0, express_1.Router)();
exports.visibilityRouter.get('/snapshot', async (_req, res) => {
    res.json(await (0, visibility_hub_1.getDailySnapshot)());
});
exports.visibilityRouter.get('/connectors', (_req, res) => {
    res.json(connector_registry_1.connectorRegistry.getSummary());
});
exports.visibilityRouter.get('/connectors/health', (_req, res) => {
    res.json((0, visibility_hub_1.getPlatformHealth)());
});
exports.visibilityRouter.post('/sync', async (_req, res) => {
    res.json(await (0, visibility_hub_1.syncAll)());
});
exports.visibilityRouter.post('/sync/:connectorId', async (req, res) => {
    res.json(await (0, visibility_hub_1.syncPlatform)(req.params.connectorId));
});
exports.visibilityRouter.get('/projects', async (_req, res) => {
    const projects = await (0, local_projects_1.syncLocalProjects)();
    res.json({ projects, count: projects.length });
});
exports.visibilityRouter.get('/tasks', (_req, res) => res.json((0, visibility_hub_1.getTasksSnapshot)()));
exports.visibilityRouter.get('/tasks/overdue', (_req, res) => res.json((0, visibility_hub_1.getOverdueTasksAll)()));
exports.visibilityRouter.get('/tasks/person/:name', (req, res) => res.json((0, visibility_hub_1.getTasksForPerson_)(req.params.name)));
exports.visibilityRouter.get('/emails', (_req, res) => res.json((0, visibility_hub_1.getImportantEmailsAll)(20)));
exports.visibilityRouter.get('/calendar', (_req, res) => res.json((0, visibility_hub_1.getTodayEventsAll)()));
exports.visibilityRouter.get('/business', (_req, res) => res.json((0, visibility_hub_1.getBusinessSnapshot)()));
exports.visibilityRouter.get('/health-data', (_req, res) => res.json((0, visibility_hub_1.getHealthSnapshot)()));
exports.visibilityRouter.get('/drive/search', (req, res) => {
    const { q } = req.query;
    if (!q)
        return res.status(400).json({ error: 'q required' });
    res.json((0, visibility_hub_1.searchDrive)(q));
});
