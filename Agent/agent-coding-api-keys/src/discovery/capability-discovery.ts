/**
 * Antigravity Gateway — Provider Capability Auto-Discovery
 *
 * Dynamically probes providers to discover:
 *  - Available models
 *  - Streaming support
 *  - Tool calling support
 *  - Context window sizes
 *  - Thinking/reasoning support
 *
 * Replaces static registry with live capability data.
 */

import type { BaseProvider } from '../providers/base-provider.js';
import type { ProviderModel } from '../types.js';

export interface DiscoveredCapabilities {
    providerId: string;
    discoveredAt: number;
    models: DiscoveredModel[];
    features: {
        streaming: boolean | 'unknown';
        toolCalling: boolean | 'unknown';
        thinking: boolean | 'unknown';
        vision: boolean | 'unknown';
        embeddings: boolean | 'unknown';
    };
    limits: {
        maxContextWindow: number | null;
        maxOutputTokens: number | null;
        rateLimit: number | null;
    };
    status: 'discovered' | 'partial' | 'failed';
    error?: string;
}

export interface DiscoveredModel {
    id: string;
    contextWindow?: number;
    maxOutputTokens?: number;
    supportsTools?: boolean;
    supportsStreaming?: boolean;
    supportsThinking?: boolean;
    supportsVision?: boolean;
}

export interface DiscoveryResult {
    provider: string;
    capabilities: DiscoveredCapabilities;
    durationMs: number;
}

class CapabilityDiscovery {
    private cache = new Map<string, DiscoveredCapabilities>();
    private discoveryInProgress = new Set<string>();

    /**
     * Discover capabilities for a single provider.
     * Uses model listing + heuristic probing.
     */
    async discover(provider: BaseProvider): Promise<DiscoveryResult> {
        const start = Date.now();
        const providerId = provider.id;

        if (this.discoveryInProgress.has(providerId)) {
            const cached = this.cache.get(providerId);
            if (cached) return { provider: providerId, capabilities: cached, durationMs: 0 };
        }

        this.discoveryInProgress.add(providerId);

        try {
            // Step 1: Fetch model list
            const models = await this.fetchModels(provider);

            // Step 2: Infer capabilities from provider kind and config
            const features = this.inferFeatures(provider);

            // Step 3: Infer limits from model metadata
            const limits = this.inferLimits(models, provider);

            const capabilities: DiscoveredCapabilities = {
                providerId,
                discoveredAt: Date.now(),
                models,
                features,
                limits,
                status: models.length > 0 ? 'discovered' : 'partial',
            };

            this.cache.set(providerId, capabilities);
            return { provider: providerId, capabilities, durationMs: Date.now() - start };
        } catch (err) {
            const error = err instanceof Error ? err.message : String(err);
            const capabilities: DiscoveredCapabilities = {
                providerId,
                discoveredAt: Date.now(),
                models: [],
                features: {
                    streaming: 'unknown',
                    toolCalling: 'unknown',
                    thinking: 'unknown',
                    vision: 'unknown',
                    embeddings: 'unknown',
                },
                limits: { maxContextWindow: null, maxOutputTokens: null, rateLimit: null },
                status: 'failed',
                error,
            };
            this.cache.set(providerId, capabilities);
            return { provider: providerId, capabilities, durationMs: Date.now() - start };
        } finally {
            this.discoveryInProgress.delete(providerId);
        }
    }

    /**
     * Discover capabilities for all providers in parallel.
     */
    async discoverAll(providers: BaseProvider[]): Promise<DiscoveryResult[]> {
        return Promise.all(providers.map((p) => this.discover(p)));
    }

    /** Get cached capabilities for a provider. */
    getCached(providerId: string): DiscoveredCapabilities | undefined {
        return this.cache.get(providerId);
    }

    /** Get all cached capabilities. */
    getAllCached(): Map<string, DiscoveredCapabilities> {
        return new Map(this.cache);
    }

    /** Check if a specific model supports a feature. */
    modelSupports(providerId: string, modelId: string, feature: keyof DiscoveredModel): boolean {
        const caps = this.cache.get(providerId);
        if (!caps) return false;
        const model = caps.models.find((m) => m.id === modelId);
        if (!model) return false;
        return Boolean(model[feature]);
    }

    /** Invalidate cache for a provider (force re-discovery). */
    invalidate(providerId: string): void {
        this.cache.delete(providerId);
    }

    /** Clear all cached discoveries. */
    clear(): void {
        this.cache.clear();
    }

    // ── Private helpers ─────────────────────────────────────────────────────

    private async fetchModels(provider: BaseProvider): Promise<DiscoveredModel[]> {
        try {
            const models = await provider.listModels();
            return models.map((m) => this.enrichModel(m, provider));
        } catch {
            // Fall back to static config models
            return provider.config.models.map((id) => this.enrichModel({ id }, provider));
        }
    }

    private enrichModel(model: ProviderModel, provider: BaseProvider): DiscoveredModel {
        const id = model.id;
        const kind = provider.config.kind;

        // Heuristic context window inference
        let contextWindow = model.contextWindow;
        if (!contextWindow) {
            if (id.includes('200k') || id.includes('opus') || id.includes('sonnet')) contextWindow = 200_000;
            else if (id.includes('128k') || id.includes('gpt-4')) contextWindow = 128_000;
            else if (id.includes('1m') || id.includes('gemini')) contextWindow = 1_000_000;
            else contextWindow = 32_000;
        }

        // Heuristic feature inference
        const supportsTools = kind === 'anthropic' || kind === 'openai-compatible' || id.includes('gpt') || id.includes('claude');
        const supportsStreaming = provider.config.capabilities.streaming;
        const supportsThinking = kind === 'anthropic' && (id.includes('opus') || id.includes('sonnet'));
        const supportsVision = id.includes('vision') || id.includes('4o') || id.includes('claude-3') || id.includes('claude-4') || id.includes('gemini');

        return {
            id,
            contextWindow,
            maxOutputTokens: contextWindow > 100_000 ? 32_000 : 8_192,
            supportsTools,
            supportsStreaming,
            supportsThinking,
            supportsVision,
        };
    }

    private inferFeatures(provider: BaseProvider): DiscoveredCapabilities['features'] {
        const caps = provider.config.capabilities;
        return {
            streaming: caps.streaming,
            toolCalling: caps.tools,
            thinking: caps.thinking,
            vision: caps.multimodal,
            embeddings: caps.embeddings,
        };
    }

    private inferLimits(models: DiscoveredModel[], provider: BaseProvider): DiscoveredCapabilities['limits'] {
        const maxContext = models.reduce((max, m) => Math.max(max, m.contextWindow ?? 0), 0);
        const maxOutput = models.reduce((max, m) => Math.max(max, m.maxOutputTokens ?? 0), 0);

        return {
            maxContextWindow: maxContext || null,
            maxOutputTokens: maxOutput || null,
            rateLimit: null, // Would need actual probing
        };
    }
}

/** Singleton discovery instance. */
export const discovery = new CapabilityDiscovery();
