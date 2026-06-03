import type { ProviderModel } from '../types.js';
import { OpenAICompatibleProvider } from './openai-compatible-provider.js';

export class OllamaProvider extends OpenAICompatibleProvider {
  override async listModels(): Promise<ProviderModel[]> {
    const base = this.config.baseURL.replace(/\/v1\/?$/, '');
    const response = await fetch(`${base}/api/tags`, { signal: this.timeoutSignal() }).catch(() => null);
    if (!response?.ok) return super.listModels();
    const data = await response.json() as { models?: Array<{ name: string }> };
    return (data.models ?? []).map((m) => ({ id: m.name }));
  }
}
