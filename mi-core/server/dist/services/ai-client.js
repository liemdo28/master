"use strict";
/**
 * AI Client — supports Python service, Ollama direct, and model selection.
 * WS1: Added askAiWithBrain() for brain-router-driven model selection.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.askAi = askAi;
exports.askAiWithBrain = askAiWithBrain;
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:4002';
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
async function callPythonService(messages) {
    const res = await fetch(`${AI_SERVICE_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, stream: false }),
        signal: AbortSignal.timeout(30000),
    });
    if (!res.ok)
        throw new Error(`AI service error: ${res.status}`);
    const data = await res.json();
    return { text: data.text, model: data.model, source: 'python-service' };
}
async function callOllamaDirect(messages, model, timeoutMs = 60000) {
    const m = model || process.env.OLLAMA_FAST_MODEL || 'qwen3:8b';
    const res = await fetch(`${OLLAMA_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: m, messages, stream: false }),
        signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok)
        throw new Error(`Ollama error: ${res.status}`);
    const data = await res.json();
    return { text: data.message.content, model: m, source: 'ollama-direct' };
}
async function callClaudeApi(messages, model, timeoutMs = 60000) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey)
        throw new Error('ANTHROPIC_API_KEY not configured');
    const systemMsg = messages.find(m => m.role === 'system');
    const chatMsgs = messages.filter(m => m.role !== 'system');
    const body = {
        model,
        max_tokens: 4096,
        messages: chatMsgs,
    };
    if (systemMsg)
        body.system = systemMsg.content;
    const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Claude API error: ${res.status} — ${err}`);
    }
    const data = await res.json();
    return { text: data.content[0]?.text || '', model, source: 'claude-api' };
}
// ── Standard call (existing behavior) ─────────────────────────────────────
async function askAi(messages) {
    try {
        return await callPythonService(messages);
    }
    catch {
        console.warn('[Mi] Python AI service unavailable, falling back to Ollama direct');
        return await callOllamaDirect(messages);
    }
}
async function askAiWithBrain(messages, config) {
    // Apply system suffix if provided
    let msgs = messages;
    if (config.system_suffix) {
        msgs = messages.map(m => m.role === 'system' ? { ...m, content: m.content + config.system_suffix } : m);
    }
    // Claude API path
    if (config.brain === 'claude-api') {
        try {
            return await callClaudeApi(msgs, config.model, config.timeout_ms);
        }
        catch (e) {
            console.warn('[Mi] Claude API failed, falling back to Ollama:', e);
            return callOllamaDirect(msgs, process.env.OLLAMA_DEEP_MODEL || 'qwen3:14b', config.timeout_ms);
        }
    }
    // Ollama path — try python service first (uses its own model config), then direct with model
    try {
        return await callPythonService(msgs);
    }
    catch {
        return callOllamaDirect(msgs, config.model, config.timeout_ms);
    }
}
