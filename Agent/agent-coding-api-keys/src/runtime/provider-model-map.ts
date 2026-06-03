/**
 * Antigravity Gateway — Runtime Model Translation
 *
 * IDE clients (Cline, Claude Code, etc.) always send a fixed model identifier.
 * This module transparently maps it to the correct model string for each provider.
 *
 * IDE always sends:   claude-opus-4-7
 * ────────────────────────────────────────────────────
 * Active Provider  →  Model sent upstream
 * NKQ (antigravity) → claude-opus-4
 * OpusMax STANDARD  → gpt-5.4           (OpusMax alias for unlocked standard tier)
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

/** Ordered provider model support. First item is the default fallback. */
const PROVIDER_ALLOWED_MODELS: Record<string, string[]> = {
    antigravity: ['claude-opus-4'],
    opusmax: ['gpt-5.4', 'claude-opus-4.6', 'claude-opus-4'],
};

const OPUS_STANDARD_REQUESTS = new Set([
    'claude-opus-4-6',
    'claude-opus-4.6',
    'claude-opus-4-7',
    'claude-opus-4.7',
    'claude-opus-4-8',
    'claude-opus-4.8',
]);

/**
 * Resolve the model to send upstream for the active provider.
 * If no override is configured, the requested model is passed through unchanged.
 *
 * @param activeProviderId  The currently active provider (e.g. 'antigravity', 'opusmax')
 * @param requestedModel    The model the IDE client sent (e.g. 'claude-opus-4-7')
 * @returns                 The model string to forward to the upstream provider
 */
export function resolveRuntimeModel(activeProviderId: string, requestedModel: string): string {
    return resolveRuntimeModelDetailed(activeProviderId, requestedModel).resolvedModel;
}

export function resolveRuntimeModelDetailed(activeProviderId: string, requestedModel: string): ProviderModelResolution {
    const allowedModels = PROVIDER_ALLOWED_MODELS[activeProviderId] ?? [];
    let resolvedModel = requestedModel;
    let reason = 'pass_through';

    if (activeProviderId === 'opusmax' && OPUS_STANDARD_REQUESTS.has(requestedModel)) {
        resolvedModel = 'gpt-5.4';
        reason = 'opusmax_standard_alias';
    } else if (activeProviderId === 'antigravity' && OPUS_STANDARD_REQUESTS.has(requestedModel)) {
        resolvedModel = 'claude-opus-4';
        reason = 'provider_family_alias';
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
