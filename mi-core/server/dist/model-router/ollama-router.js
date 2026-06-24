"use strict";
/**
 * Ollama Model Router — detect installed models, auto-select best for task,
 * benchmark speed, show status in UI. Offline-first.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getInstalledModels = getInstalledModels;
exports.selectModel = selectModel;
exports.getModelStatus = getModelStatus;
exports.benchmarkModel = benchmarkModel;
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
// Priority lists per role — first match wins
const ROLE_PRIORITY = {
    fast_chat: ['qwen3:8b', 'qwen2.5:7b', 'llama3.2:3b', 'phi3:mini', 'mistral:7b'],
    deep_reasoning: ['qwen3:14b', 'qwen3:8b', 'deepseek-r1:14b', 'llama3.1:8b', 'mistral:7b'],
    coding: ['qwen2.5-coder:7b', 'deepseek-coder-v2:16b', 'codellama:7b', 'qwen3:8b'],
    qa_review: ['qwen3:14b', 'qwen3:8b', 'qwen2.5-coder:7b', 'llama3.1:8b'],
    embeddings: ['nomic-embed-text', 'mxbai-embed-large', 'all-minilm'],
};
let _cache = null;
let _cacheTime = 0;
const CACHE_TTL = 60_000; // 1 min
async function getInstalledModels(force = false) {
    if (!force && _cache && Date.now() - _cacheTime < CACHE_TTL)
        return _cache;
    try {
        const res = await fetch(`${OLLAMA_URL}/api/tags`, {
            signal: AbortSignal.timeout(5000),
        });
        if (!res.ok)
            return [];
        const data = await res.json();
        _cache = data.models || [];
        _cacheTime = Date.now();
        return _cache;
    }
    catch {
        return _cache || [];
    }
}
async function selectModel(role) {
    const models = await getInstalledModels();
    const names = models.map(m => m.name);
    for (const candidate of ROLE_PRIORITY[role]) {
        // Exact match first, then quantization-suffix only (e.g. qwen3:8b-q4_K_M)
        const found = names.find(n => n === candidate)
            ?? names.find(n => n.startsWith(candidate + '-'));
        if (found)
            return found;
    }
    // Fallback: first available non-embedding model
    if (role !== 'embeddings') {
        return names.find(n => !n.includes('embed')) || null;
    }
    return null;
}
async function getModelStatus() {
    const models = await getInstalledModels();
    const ollamaOnline = models.length > 0 || await pingOllama();
    const selected = {
        fast_chat: null, deep_reasoning: null, coding: null, qa_review: null, embeddings: null,
    };
    for (const role of Object.keys(ROLE_PRIORITY)) {
        selected[role] = await selectModel(role);
    }
    const offlineReady = ollamaOnline && selected.fast_chat !== null;
    return { available: models, selected, ollama_online: ollamaOnline, offline_ready: offlineReady };
}
async function pingOllama() {
    try {
        const res = await fetch(`${OLLAMA_URL}/`, { signal: AbortSignal.timeout(3000) });
        return res.ok;
    }
    catch {
        return false;
    }
}
async function benchmarkModel(modelName) {
    const start = Date.now();
    try {
        const res = await fetch(`${OLLAMA_URL}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: modelName, prompt: 'Hello', stream: false }),
            signal: AbortSignal.timeout(30000),
        });
        const data = await res.json();
        const elapsed = Date.now() - start;
        const tps = data.eval_duration
            ? Math.round((data.eval_count || 1) / (data.eval_duration / 1e9))
            : Math.round(1000 / elapsed * 10);
        return { model: modelName, tokens_per_sec: tps, ok: true };
    }
    catch {
        return { model: modelName, tokens_per_sec: 0, ok: false };
    }
}
