import type { ProviderHealth } from '../types.js';
import type { BaseProvider } from '../providers/base-provider.js';

export class HealthManager {
  private readonly health = new Map<string, ProviderHealth>();
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly providers: BaseProvider[], private readonly intervalMs: number) {}

  snapshot(): Map<string, ProviderHealth> {
    return new Map(this.health);
  }

  list(): ProviderHealth[] {
    return [...this.health.values()];
  }

  get(providerId: string): ProviderHealth | undefined {
    return this.health.get(providerId);
  }

  async checkAll(): Promise<ProviderHealth[]> {
    const results = await Promise.all(this.providers.map(async provider => {
      const result = await provider.healthCheck(provider.config.defaultModel);
      this.health.set(provider.id, result);
      return result;
    }));
    return results;
  }

  start(): void {
    void this.checkAll();
    this.timer = setInterval(() => void this.checkAll(), this.intervalMs);
    this.timer.unref();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
  }
}
