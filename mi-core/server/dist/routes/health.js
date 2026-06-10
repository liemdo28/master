"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.healthRouter = void 0;
const express_1 = require("express");
exports.healthRouter = (0, express_1.Router)();
exports.healthRouter.get('/', async (_req, res) => {
    const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:4002';
    const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
    const checks = await Promise.allSettled([
        fetch(`${AI_SERVICE_URL}/health`).then(r => r.ok),
        fetch(`${OLLAMA_URL}/api/tags`).then(r => r.ok),
    ]);
    res.json({
        server: 'ok',
        python_ai_service: checks[0].status === 'fulfilled' && checks[0].value ? 'ok' : 'down',
        ollama: checks[1].status === 'fulfilled' && checks[1].value ? 'ok' : 'down',
        timestamp: new Date().toISOString(),
    });
});
