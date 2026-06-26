/**
 * Antigravity Gateway — Runtime Model Translation
 *
 * IDE clients (Cline, Claude Code, etc.) always send a fixed model identifier.
 * This module transparently maps it to the correct model string for each provider.
 *
 * IDE always sends:   claude-opus-4-7
 * ────────────────────────────────────────────────────
 * Active Provider  →  Model sent upstream
 * NKQ (antigravity) → pass exact 4.6 / 4.7 model through
 * OpusMax           → raw claude-opus-4-* first; STANDARD/THINKING are fallback pools
 * Anthropic         → pass-through
 * Others            → pass-through unchanged
 */

export interface ProviderModelResolution {
    providerId: string;
    requestedModel: string;
    resolvedModel: string;
    allowedModels: string[];
    downgraded: boolean;
    reason: string;
}

export interface ProviderModelResolveOptions {
    thinking?: boolean | undefined;
}

/** Ordered provider model support. First item is the default fallback. */
const PROVIDER_ALLOWED_MODELS: Record<string, string[]> = {
    antigravity: ['claude-opus-4-7', 'claude-opus-4-6', 'claude-opus-4'],
    opusmax: [
        'claude-opus-4-8',
        'claude-opus-4-7',
        'claude-opus-4-6',
        'claude-opus-4-8-thinking',
        'claude-opus-4-7-thinking',
        'claude-opus-4-6-thinking',
        'claude-opus-4-7-standard',
        'claude-opus-4-6-standard',
        'auto',
    ],
    anthropic: ['claude-opus-4-1-20250805', 'claude-sonnet-4-5-20250929', 'claude-sonnet-4-20250514'],
    openrouter: ['anthropic/claude-opus-4.1', 'anthropic/claude-sonnet-4.5', 'openai/gpt-4.1'],
    openai: ['gpt-4.1', 'gpt-4.1-mini', 'gpt-4o'],
    gemini: ['gemini-2.5-pro', 'gemini-2.0-flash'],
    deepseek: ['deepseek-chat', 'deepseek-coder'],
    ollama: ['qwen2.5-coder:7b', 'llama3.1', 'deepseek-r1:7b'],
};

const OPUS_STANDARD_REQUESTS = new Set([
    'claude-opus-4-6',
    'claude-opus-4.6',
    'claude-opus-4-6-thinking',
    'claude-opus-4.6-thinking',
    'claude-opus-4-7',
    'claude-opus-4.7',
    'claude-opus-4-7-thinking',
    'claude-opus-4.7-thinking',
    'claude-opus-4-8',
    'claude-opus-4.8',
    'claude-opus-4-8-thinking',
    'claude-opus-4.8-thinking',
]);

/**
 * Resolve the model to send upstream for the active provider.
 * If no override is configured, the requested model is passed through unchanged.
 *
 * @param activeProviderId  The currently active provider (e.g. 'antigravity', 'opusmax')
 * @param requestedModel    The model the IDE client sent (e.g. 'claude-opus-4-7')
 * @returns                 The model string to forward to the upstream provider
 */
export function resolveRuntimeModel(activeProviderId: string, requestedModel: string, options: ProviderModelResolveOptions = {}): string {
    return resolveRuntimeModelDetailed(activeProviderId, requestedModel, options).resolvedModel;
}

export function resolveRuntimeModelDetailed(activeProviderId: string, requestedModel: string, options: ProviderModelResolveOptions = {}): ProviderModelResolution {
    const allowedModels = PROVIDER_ALLOWED_MODELS[activeProviderId] ?? [];
    let resolvedModel = requestedModel;
    let reason = 'pass_through';
    const requestedThinking = options.thinking === true || /-thinking$/i.test(requestedModel);

    if (activeProviderId === 'opusmax' && OPUS_STANDARD_REQUESTS.has(requestedModel)) {
        const normalized = requestedModel.replace(/\./g, '-').replace(/-thinking$/i, '');
        if (requestedThinking) {
            if (normalized === 'claude-opus-4-6') {
                resolvedModel = 'claude-opus-4-6-thinking';
            } else if (normalized === 'claude-opus-4-8') {
                resolvedModel = 'claude-opus-4-8-thinking';
            } else {
                resolvedModel = 'claude-opus-4-7-thinking';
            }
            reason = 'opusmax_thinking_alias';
        } else if (normalized === 'claude-opus-4-6') {
            resolvedModel = 'claude-opus-4-6';
            reason = 'opusmax_raw_alias';
        } else if (normalized === 'claude-opus-4-8') {
            resolvedModel = 'claude-opus-4-8';
            reason = 'opusmax_raw_alias';
        } else {
            resolvedModel = 'claude-opus-4-7';
            reason = 'opusmax_raw_alias';
        }
    } else if (activeProviderId === 'antigravity' && OPUS_STANDARD_REQUESTS.has(requestedModel)) {
        if (requestedModel === 'claude-opus-4.6' || requestedModel === 'claude-opus-4.6-thinking' || requestedModel === 'claude-opus-4-6-thinking') {
            resolvedModel = 'claude-opus-4-6';
            reason = 'nkq_model_normalized';
        } else if (requestedModel === 'claude-opus-4.7' || requestedModel === 'claude-opus-4.7-thinking' || requestedModel === 'claude-opus-4-7-thinking') {
            resolvedModel = 'claude-opus-4-7';
            reason = 'nkq_model_normalized';
        } else if (requestedModel === 'claude-opus-4-8' || requestedModel === 'claude-opus-4.8' || requestedModel === 'claude-opus-4-8-thinking' || requestedModel === 'claude-opus-4.8-thinking') {
            resolvedModel = 'claude-opus-4-7';
            reason = 'nkq_4_8_to_4_7_fallback';
        } else {
            resolvedModel = requestedModel;
            reason = 'nkq_exact_model';
        }
    } else if (allowedModels.length > 0 && !allowedModels.includes(requestedModel)) {
        resolvedModel = allowedModels[0]!;
        reason = 'provider_default_model_fallback';
    }

    if (resolvedModel !== requestedModel) {
        console.log(`[model-map] translate: "${requestedModel}" → "${resolvedModel}" (provider: ${activeProviderId}, reason: ${reason})`);
    }

    return {
        providerId: activeProviderId,
        requestedModel,
        resolvedModel,
        allowedModels,
        downgraded: resolvedModel !== requestedModel,
        reason,
    };
}

/**
 * The canonical model for a provider — used by the dashboard to auto-fill
 * the route test console and show what model will actually be sent.
 */
export function getCanonicalModel(activeProviderId: string): string {
    return PROVIDER_ALLOWED_MODELS[activeProviderId]?.[0] ?? 'claude-opus-4-7';
}

export function getAllowedModels(activeProviderId: string): string[] {
    return PROVIDER_ALLOWED_MODELS[activeProviderId] ?? [];
}
