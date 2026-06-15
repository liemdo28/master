"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.knowledgeRouter = void 0;
const express_1 = require("express");
const knowledge_db_1 = require("../knowledge/knowledge-db");
const pack_manager_1 = require("../knowledge/pack-manager");
const reference_brain_path_1 = require("../knowledge/reference-brain-path");
exports.knowledgeRouter = (0, express_1.Router)();
const KNOWLEDGE_API_KEY = process.env.MI_CORE_API_KEY || 'mi-core-secret-2026';
function requireApiKey(req, res, next) {
    const key = req.headers['x-api-key'] || req.body?.api_key || '';
    if (key !== KNOWLEDGE_API_KEY)
        return res.status(401).json({ error: 'Unauthorized' });
    next();
}
exports.knowledgeRouter.get('/search', (req, res) => {
    const { q, category, limit } = req.query;
    if (!q?.trim())
        return res.status(400).json({ error: 'q required' });
    res.json((0, knowledge_db_1.search)(q, parseInt(limit || '10'), category));
});
exports.knowledgeRouter.get('/category/:cat', (req, res) => {
    res.json((0, knowledge_db_1.searchByCategory)(req.params.cat, 20));
});
exports.knowledgeRouter.get('/stats', (_req, res) => {
    res.json((0, knowledge_db_1.getStats)());
});
exports.knowledgeRouter.get('/catalog', (_req, res) => {
    res.json((0, knowledge_db_1.buildCatalog)());
});
exports.knowledgeRouter.post('/ingest', requireApiKey, (_req, res) => {
    const result = (0, knowledge_db_1.fullIngest)();
    res.json({ ok: true, ...result });
});
exports.knowledgeRouter.post('/rebuild', requireApiKey, (_req, res) => {
    const result = (0, knowledge_db_1.clearAndRebuild)();
    res.json({ ok: true, ...result });
});
exports.knowledgeRouter.post('/ingest-dir', requireApiKey, (req, res) => {
    const { dir, source } = req.body;
    if (!dir)
        return res.status(400).json({ error: 'dir required' });
    res.json({ ok: true, ...(0, knowledge_db_1.ingestDirectory)(dir, source) });
});
// Packs
exports.knowledgeRouter.get('/packs', (_req, res) => {
    res.json((0, pack_manager_1.listPacks)());
});
exports.knowledgeRouter.post('/packs/install-all', requireApiKey, (_req, res) => {
    res.json((0, pack_manager_1.installAllPacks)());
});
exports.knowledgeRouter.post('/packs/:packId/install', requireApiKey, (req, res) => {
    res.json((0, pack_manager_1.installPack)(req.params.packId));
});
exports.knowledgeRouter.delete('/packs/:packId', requireApiKey, (req, res) => {
    res.json((0, pack_manager_1.uninstallPack)(req.params.packId));
});
// US Compliance DB status (legacy shape: includes status field)
exports.knowledgeRouter.get('/us-compliance/status', (_req, res) => {
    res.json((0, reference_brain_path_1.getComplianceDBStatus)());
});
// US Compliance DB health (canonical shape per CEO directive)
exports.knowledgeRouter.get('/us-compliance/health', (_req, res) => {
    res.json((0, reference_brain_path_1.checkUSComplianceDBHealth)());
});
