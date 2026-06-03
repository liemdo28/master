import type { ProviderConfig } from '../types.js';
import { AnthropicProvider } from './anthropic-provider.js';
import { BaseProvider } from './base-provider.js';
import { OllamaProvider } from './ollama-provider.js';
import { OpenAICompatibleProvider } from './openai-compatible-provider.js';

export function createProvider(config: ProviderConfig): BaseProvider {
  if (config.kind === 'anthropic') return new AnthropicProvider(config);
  if (config.kind === 'ollama') return new OllamaProvider(config);
  return new OpenAICompatibleProvider(config);
}
