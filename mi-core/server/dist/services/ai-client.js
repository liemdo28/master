"use strict";
/**
 * AI Client — compatibility wrapper around the provider router.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.askAi = askAi;
exports.askAiWithBrain = askAiWithBrain;
const provider_router_1 = require("../providers/provider-router");
// ── Standard call (existing behavior) ─────────────────────────────────────
async function askAi(messages) {
    const result = await provider_router_1.providerRouter.generateText(messages);
    return { text: result.text, model: result.model, source: result.provider };
}
async function askAiWithBrain(messages, config) {
    // Apply system suffix if provided
    let msgs = messages;
    if (config.system_suffix) {
        msgs = messages.map(m => m.role === 'system' ? { ...m, content: m.content + config.system_suffix } : m);
    }
    const providers = config.brain === 'claude-api' ? ['anthropic', 'ollama'] : undefined;
    const result = await provider_router_1.providerRouter.generateText(msgs, {
        providers: providers ? [...providers] : undefined,
        model: config.model,
        timeoutMs: config.timeout_ms,
    });
    return { text: result.text, model: result.model, source: result.provider };
}
