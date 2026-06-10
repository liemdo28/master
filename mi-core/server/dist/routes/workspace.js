"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.workspaceRouter = void 0;
const express_1 = require("express");
const pc_connector_1 = require("../connectors/pc-connector");
const project_connector_1 = require("../connectors/project-connector");
const briefing_engine_1 = require("../connectors/briefing-engine");
exports.workspaceRouter = (0, express_1.Router)();
exports.workspaceRouter.get('/projects', (_req, res) => {
    res.json((0, pc_connector_1.scanProjects)());
});
exports.workspaceRouter.get('/projects/health', (_req, res) => {
    res.json((0, project_connector_1.getAllProjectHealth)());
});
exports.workspaceRouter.get('/projects/issues', (_req, res) => {
    res.json((0, project_connector_1.getProjectsWithIssues)());
});
exports.workspaceRouter.get('/search', (req, res) => {
    const { q } = req.query;
    if (!q?.trim())
        return res.status(400).json({ error: 'q required' });
    res.json((0, pc_connector_1.searchFiles)(q));
});
exports.workspaceRouter.get('/processes', (_req, res) => {
    res.json((0, pc_connector_1.getRunningProcesses)());
});
exports.workspaceRouter.get('/ports', (_req, res) => {
    res.json((0, pc_connector_1.getListeningPorts)());
});
exports.workspaceRouter.get('/briefing', async (_req, res) => {
    try {
        const result = await (0, briefing_engine_1.generateBriefing)();
        res.json(result);
    }
    catch (e) {
        res.status(500).json({ error: String(e) });
    }
});
