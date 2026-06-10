"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.memoryRouter = void 0;
const express_1 = require("express");
const executive_memory_1 = require("../memory/executive-memory");
exports.memoryRouter = (0, express_1.Router)();
exports.memoryRouter.get('/profile', (_req, res) => {
    res.json(executive_memory_1.executiveMemory.getOwnerProfile());
});
exports.memoryRouter.get('/profile/summary', (_req, res) => {
    res.json({ summary: executive_memory_1.executiveMemory.summarizeOwnerProfile() });
});
exports.memoryRouter.get('/preferences', (_req, res) => {
    res.json(executive_memory_1.executiveMemory.getPreferences());
});
exports.memoryRouter.get('/business', (_req, res) => {
    res.json(executive_memory_1.executiveMemory.getBusinessMemory());
});
exports.memoryRouter.get('/decisions', (_req, res) => {
    res.json(executive_memory_1.executiveMemory.getDecisions());
});
exports.memoryRouter.get('/personal', (_req, res) => {
    res.json(executive_memory_1.executiveMemory.getPersonalContext());
});
exports.memoryRouter.get('/consent-log', (_req, res) => {
    res.json(executive_memory_1.executiveMemory.getConsentLog());
});
exports.memoryRouter.get('/export', (req, res) => {
    const { include_personal } = req.query;
    res.json(executive_memory_1.executiveMemory.exportMemory(include_personal === 'true'));
});
exports.memoryRouter.get('/search', (req, res) => {
    const { q } = req.query;
    if (!q?.trim())
        return res.status(400).json({ error: 'q required' });
    res.json(executive_memory_1.executiveMemory.searchMemory(q));
});
exports.memoryRouter.post('/remember', (req, res) => {
    const { category, key, value, consent } = req.body;
    if (!category || !key || value === undefined)
        return res.status(400).json({ error: 'category, key, value required' });
    res.json(executive_memory_1.executiveMemory.remember(category, key, value, consent));
});
exports.memoryRouter.post('/preference', (req, res) => {
    const { key, value } = req.body;
    if (!key || value === undefined)
        return res.status(400).json({ error: 'key, value required' });
    res.json(executive_memory_1.executiveMemory.addPreference(key, value));
});
exports.memoryRouter.post('/decision', (req, res) => {
    const { title, detail, tags } = req.body;
    if (!title || !detail)
        return res.status(400).json({ error: 'title, detail required' });
    res.json(executive_memory_1.executiveMemory.addDecision(title, detail, tags));
});
exports.memoryRouter.delete('/forget', (req, res) => {
    const { category, key } = req.body;
    if (!category)
        return res.status(400).json({ error: 'category required' });
    res.json(executive_memory_1.executiveMemory.forget(category, key));
});
exports.memoryRouter.delete('/personal', (_req, res) => {
    res.json(executive_memory_1.executiveMemory.deleteSensitiveMemory());
});
