"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.modelsRouter = void 0;
const express_1 = require("express");
const ollama_router_1 = require("../model-router/ollama-router");
exports.modelsRouter = (0, express_1.Router)();
exports.modelsRouter.get('/status', async (_req, res) => {
    res.json(await (0, ollama_router_1.getModelStatus)());
});
exports.modelsRouter.get('/list', async (_req, res) => {
    res.json(await (0, ollama_router_1.getInstalledModels)(true));
});
exports.modelsRouter.post('/benchmark', async (req, res) => {
    const { model } = req.body;
    if (!model)
        return res.status(400).json({ error: 'model required' });
    res.json(await (0, ollama_router_1.benchmarkModel)(model));
});
