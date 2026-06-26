import type { ProviderConfig, ProviderHealth } from '../types.js';

export class ModelResolver {
  constructor(
    private readonly aliases: Record<string, string[]>,
    private readonly health: Map<string, ProviderHealth>
  ) {}

  resolveForProvider(requested: string, provider: ProviderConfig): string {
    const candidates = this.candidatesForProvider(requested, provider);
    const health = this.health.get(provider.id);
    const available = new Set([...(health?.availableModels || []), ...provider.models, provider.defaultModel]);
    return candidates.find(model => available.has(model)) || candidates[0] || provider.defaultModel;
  }

  candidatesForProvider(requested: string, provider: ProviderConfig): string[] {
    const providerAliases = provider.aliases[requested] || [];
    const globalAliases = this.aliases[requested] || [];
    const normalized = this.normalizeProviderSpecific(requested, provider.id);
    return unique([...providerAliases, normalized, ...globalAliases, requested, provider.defaultModel]);
  }

  private normalizeProviderSpecific(model: string, providerId: string): string {
    if (providerId === 'opusmax') return model.replace(/(claude-[a-z]+-\d+)-(\d+)$/, '$1.$2');
    return model;
  }
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}
