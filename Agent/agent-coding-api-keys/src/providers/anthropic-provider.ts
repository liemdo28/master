import type {
  ContentBlock,
  ProviderModel,
  TextBlock,
  ThinkingBlock,
  ToolUseBlock,
  UniversalChatRequest,
  UniversalChatResponse,
} from '../types.js';
import { BaseProvider } from './base-provider.js';

interface AnthropicContentBlock {
  type?: string;
  text?: string;
  thinking?: string;
  id?: string;
  name?: string;
  input?: unknown;
}

interface AnthropicResponse {
  id?: string;
  model?: string;
  content?: AnthropicContentBlock[];
  stop_reason?: string | null;
  usage?: { input_tokens?: number; output_tokens?: number };
}

export class AnthropicProvider extends BaseProvider {
  async chat(request: UniversalChatRequest, keyOverride?: import('../types.js').ProviderKey): Promise<UniversalChatResponse> {
    const key = this.requireKey(keyOverride);
    const payload = this.buildPayload(request, false);

    const response = await fetch(this.endpoint('/messages'), {
      method: 'POST',
      headers: this.buildHeaders(key.value),
      body: JSON.stringify(payload),
      signal: this.timeoutSignal(),
    });

    if (!response.ok) {
      const rawBody = await response.text();
      console.error(`[UPSTREAM ERROR]\n  PROVIDER: ${this.id}\n  STATUS: ${response.status}\n  BODY: ${rawBody.slice(0, 500)}`);
      throw new Error(`${this.id} ${response.status}: ${rawBody}`);
    }

    const data = await response.json() as AnthropicResponse;
    return this.parseResponse(data, request.model);
  }

  async fetchStream(request: UniversalChatRequest, keyOverride?: import('../types.js').ProviderKey): Promise<Response> {
    const key = this.requireKey(keyOverride);
    const payload = this.buildPayload(request, true);

    return fetch(this.endpoint('/messages'), {
      method: 'POST',
      headers: this.buildHeaders(key.value),
      body: JSON.stringify(payload),
      signal: this.streamTimeoutSignal(),
    });
  }

  override async listModels(): Promise<ProviderModel[]> {
    const key = this.activeKey;
    if (!key) return super.listModels();
    const response = await fetch(this.endpoint('/models'), {
      headers: this.buildHeaders(key.value),
      signal: this.timeoutSignal(),
    });
    if (!response.ok) return super.listModels();
    const data = await response.json() as { data?: Array<{ id: string }> };
    return (data.data || []).map((m) => ({ id: m.id }));
  }

  private buildPayload(request: UniversalChatRequest, stream: boolean): Record<string, unknown> {
    const payload: Record<string, unknown> = {
      model: request.model,
      // UniversalMessage uses Anthropic-native format — pass through directly
      messages: request.messages,
      max_tokens: request.maxTokens,
      stream,
    };
    if (request.system) payload.system = request.system;
    if (request.temperature !== undefined) payload.temperature = request.temperature;
    if (request.tools?.length) payload.tools = request.tools;
    if (request.toolChoice) payload.tool_choice = request.toolChoice;
    if (request.thinking) payload.thinking = request.thinking;
    if (request.metadata) payload.metadata = request.metadata;
    return payload;
  }

  private buildHeaders(apiKey: string): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      ...this.config.headers,
    };
  }

  private parseResponse(data: AnthropicResponse, requestedModel: string): UniversalChatResponse {
    const content: ContentBlock[] = (data.content ?? []).map((block): ContentBlock => {
      switch (block.type) {
        case 'text':
          return { type: 'text', text: block.text ?? '' } satisfies TextBlock;
        case 'tool_use':
          return {
            type: 'tool_use',
            id: block.id ?? `tool-${Date.now()}`,
            name: block.name ?? '',
            input: (block.input as Record<string, unknown>) ?? {},
          } satisfies ToolUseBlock;
        case 'thinking':
          return { type: 'thinking', thinking: block.thinking ?? '' } satisfies ThinkingBlock;
        default:
          return { type: 'text', text: block.text ?? '' } satisfies TextBlock;
      }
    });

    const text = content
      .filter((b): b is TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');

    const stopReason = data.stop_reason ?? 'stop';
    const finishReason = stopReason === 'end_turn' ? 'stop' : stopReason;

    return {
      id: data.id ?? `${this.id}-${Date.now()}`,
      model: data.model ?? requestedModel,
      providerId: this.id,
      content,
      text,
      finishReason,
      usage: {
        inputTokens: data.usage?.input_tokens ?? 0,
        outputTokens: data.usage?.output_tokens ?? 0,
      },
      raw: data,
    };
  }
}
