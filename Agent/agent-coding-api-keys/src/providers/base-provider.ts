import type { ProviderConfig, ProviderHealth, ProviderKey, ProviderModel, UniversalChatRequest, UniversalChatResponse } from '../types.js';
import { nowIso } from '../utils/http.js';

export abstract class BaseProvider {
  protected keyCursor = 0;

  constructor(public readonly config: ProviderConfig) {}

  get id(): string { return this.config.id; }

  get activeKey(): ProviderKey | null {
    const usable = this.config.keys.filter((k) => !k.disabledUntil || k.disabledUntil < Date.now());
    if (!usable.length) {
      return this.config.id === 'ollama' ? { id: 'local', value: 'ollama', active: true } : null;
    }
    const primary = usable.find((k) => k.active);
    if (primary) return primary;
    const key = usable[this.keyCursor % usable.length] ?? usable[0];
    this.keyCursor += 1;
    return key ?? null;
  }

  /**
   * Non-streaming chat.
   * @param key Optional key override — if supplied, uses this key instead of activeKey.
   *            The router uses this to implement per-key retry without mutating state.
   */
  abstract chat(request: UniversalChatRequest, key?: ProviderKey): Promise<UniversalChatResponse>;

  /**
   * Streaming chat — returns the raw upstream Response whose body is an SSE stream.
   * The server is responsible for transforming and piping to the client.
   * The caller must check response.ok before consuming the body.
   * @param key Optional key override — same semantics as chat().
   */
  abstract fetchStream(request: UniversalChatRequest, key?: ProviderKey): Promise<Response>;

  async listModels(): Promise<ProviderModel[]> {
    return this.config.models.map((id) => ({ id }));
  }

  async healthCheck(model: string): Promise<ProviderHealth> {
    const start = Date.now();
    try {
      const models = await this.listModels();
      return {
        providerId: this.id,
        status: 'healthy',
        latencyMs: Date.now() - start,
        checkedAt: nowIso(),
        activeModel: model || this.config.defaultModel,
        availableModels: models.map((m) => m.id),
      };
    } catch (error) {
      return {
        providerId: this.id,
        status: 'degraded',
        latencyMs: Date.now() - start,
        checkedAt: nowIso(),
        activeModel: model || this.config.defaultModel,
        availableModels: this.config.models,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  protected timeoutSignal(): AbortSignal {
    return AbortSignal.timeout(this.config.timeoutMs);
  }

  protected streamTimeoutSignal(): AbortSignal {
    // Streaming can legitimately run much longer
    return AbortSignal.timeout(Math.max(this.config.timeoutMs * 4, 300_000));
  }

  protected endpoint(path: string): string {
    return `${this.config.baseURL.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
  }

  protected requireKey(override?: ProviderKey): ProviderKey {
    const key = override ?? this.activeKey;
    if (!key) throw new Error(`${this.id} has no active API key`);
    return key;
  }
}
