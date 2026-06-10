"use strict";
/**
 * Calls Python AI service (FastAPI) which wraps Ollama.
 * Falls back to direct Ollama if Python service is down.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.askAi = askAi;
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:4002';
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
async function callPythonService(messages, stream = false) {
    const res = await fetch(`${AI_SERVICE_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, stream }),
        signal: AbortSignal.timeout(30000),
    });
    if (!res.ok)
        throw new Error(`AI service error: ${res.status}`);
    const data = await res.json();
    return { text: data.text, model: data.model, source: 'python-service' };
}
async function callOllamaDirect(messages) {
    const model = process.env.OLLAMA_FAST_MODEL || 'qwen3:8b';
    const res = await fetch(`${OLLAMA_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages, stream: false }),
        signal: AbortSignal.timeout(60000),
    });
    if (!res.ok)
        throw new Error(`Ollama error: ${res.status}`);
    const data = await res.json();
    return { text: data.message.content, model, source: 'ollama-direct' };
}
async function askAi(messages) {
    try {
        return await callPythonService(messages);
    }
    catch {
        console.warn('[Mi] Python AI service unavailable, falling back to Ollama direct');
        return await callOllamaDirect(messages);
    }
}
