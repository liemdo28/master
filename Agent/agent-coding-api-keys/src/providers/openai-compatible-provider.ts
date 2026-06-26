import type {
  ContentBlock,
  ProviderModel,
  TextBlock,
  ToolUseBlock,
  UniversalChatRequest,
  UniversalChatResponse,
} from '../types.js';
import { anthropicToolChoiceToOpenAI, anthropicToolsToOpenAI, universalMessagesToOpenAI } from '../compatibility/tool-bridge.js';
import { BaseProvider } from './base-provider.js';

interface OpenAIToolCall {
  id?: string;
  type?: string;
  function?: { name?: string; arguments?: string };
}

interface OpenAIMessage {
  content?: string | null;
  tool_calls?: OpenAIToolCall[];
}

interface OpenAIChoice {
  message?: OpenAIMessage;
  finish_reason?: string | null;
}

interface OpenAIResponse {
  id?: string;
  model?: string;
  choices?: OpenAIChoice[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

export class OpenAICompatibleProvider extends BaseProvider {
  async chat(request: UniversalChatRequest, keyOverride?: import('../types.js').ProviderKey): Promise<UniversalChatResponse> {
    const key = this.requireKey(keyOverride);
    const payload = this.buildPayload(request, false);

    const response = await fetch(this.endpoint('/chat/completions'), {
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

    const data = await response.json() as OpenAIResponse;
    return this.parseResponse(data, request.model);
  }

  async fetchStream(request: UniversalChatRequest, keyOverride?: import('../types.js').ProviderKey): Promise<Response> {
    const key = this.requireKey(keyOverride);
    const payload = this.buildPayload(request, true);

    try {
      const response = await fetch(this.endpoint('/chat/completions'), {
        method: 'POST',
        headers: this.buildHeaders(key.value),
        body: JSON.stringify(payload),
        signal: this.streamTimeoutSignal(),
      });

      if (this.shouldFallbackStreamToNonStream(response.status)) {
        const fallback = await this.fetchNonStreamAsSSE(request, key, 30_000);
        if (fallback) return fallback;
      }

      return response;
    } catch (error) {
      if (this.id === 'opusmax') {
        // Stream timed out or failed — retry as non-stream with a short 30s budget.
        // Non-stream skips chunked-streaming overhead and often succeeds when streaming hangs.
        const fallback = await this.fetchNonStreamAsSSE(request, key, 30_000);
        if (fallback) return fallback;
      }
      throw error;
    }
  }

  override async listModels(): Promise<ProviderModel[]> {
    if (!this.config.capabilities.modelDiscovery) return super.listModels();
    const key = this.activeKey;
    const headers: Record<string, string> = { ...this.config.headers };
    if (key) headers.Authorization = `Bearer ${key.value}`;

    const response = await fetch(this.endpoint('/models'), {
      headers,
      signal: this.timeoutSignal(),
    });
    if (!response.ok) return super.listModels();
    const data = await response.json() as { data?: Array<{ id: string; owned_by?: string }> };
    return (data.data ?? []).map((m) => ({ id: m.id, ownedBy: m.owned_by }));
  }

  protected buildPayload(request: UniversalChatRequest, stream: boolean): Record<string, unknown> {
    // Convert Universal (Anthropic-native) messages → OpenAI format
    const messages = universalMessagesToOpenAI(request.messages);
    if (request.system) {
      messages.unshift({ role: 'system', content: request.system });
    }

    const payload: Record<string, unknown> = {
      model: request.model,
      messages,
      max_tokens: request.maxTokens,
      stream,
    };
    if (request.temperature !== undefined) payload.temperature = request.temperature;
    if (request.metadata) payload.metadata = request.metadata;

    // Convert Anthropic-format tools → OpenAI format
    if (request.tools?.length) {
      payload.tools = anthropicToolsToOpenAI(request.tools);
    }
    if (request.toolChoice) {
      payload.tool_choice = anthropicToolChoiceToOpenAI(request.toolChoice);
    }

    return payload;
  }

  protected buildHeaders(apiKey: string): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      ...this.config.headers,
    };
  }

  private shouldFallbackStreamToNonStream(status: number): boolean {
    return this.id === 'opusmax' && [429, 502, 503, 504].includes(status);
  }

  private async fetchNonStreamAsSSE(request: UniversalChatRequest, key: import('../types.js').ProviderKey, timeoutMs?: number): Promise<Response | null> {
    const payload = this.buildPayload(request, false);
    try {
      const response = await fetch(this.endpoint('/chat/completions'), {
        method: 'POST',
        headers: this.buildHeaders(key.value),
        body: JSON.stringify(payload),
        signal: timeoutMs ? AbortSignal.timeout(timeoutMs) : this.timeoutSignal(),
      });
      if (!response.ok) return null;
      const data = await response.json() as OpenAIResponse;
      return new Response(this.openAIResponseToSSE(data, request.model), {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      });
    } catch {
      return null;
    }
  }

  private openAIResponseToSSE(data: OpenAIResponse, requestedModel: string): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder();
    const id = data.id ?? `${this.id}-${Date.now()}`;
    const model = data.model ?? requestedModel;
    const created = Math.floor(Date.now() / 1000);
    const choice = data.choices?.[0];
    const chunks: string[] = [];
    const emit = (chunk: unknown) => chunks.push(`data: ${JSON.stringify(chunk)}\n\n`);

    emit({
      id,
      object: 'chat.completion.chunk',
      created,
      model,
      choices: [{ index: 0, delta: { role: 'assistant' }, finish_reason: null }],
    });

    if (choice?.message?.content) {
      emit({
        id,
        object: 'chat.completion.chunk',
        created,
        model,
        choices: [{ index: 0, delta: { content: choice.message.content }, finish_reason: null }],
      });
    }

    if (choice?.message?.tool_calls?.length) {
      emit({
        id,
        object: 'chat.completion.chunk',
        created,
        model,
        choices: [{
          index: 0,
          delta: { tool_calls: choice.message.tool_calls },
          finish_reason: null,
        }],
      });
    }

    emit({
      id,
      object: 'chat.completion.chunk',
      created,
      model,
      choices: [{ index: 0, delta: {}, finish_reason: choice?.finish_reason ?? 'stop' }],
    });
    chunks.push('data: [DONE]\n\n');

    return new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(chunks.join('')));
        controller.close();
      },
    });
  }

  private parseResponse(data: OpenAIResponse, requestedModel: string): UniversalChatResponse {
    const choice = data.choices?.[0];
    const content: ContentBlock[] = [];

    if (choice?.message?.content) {
      content.push({ type: 'text', text: String(choice.message.content) } satisfies TextBlock);
    }

    for (const tc of choice?.message?.tool_calls ?? []) {
      let input: Record<string, unknown> = {};
      try {
        input = JSON.parse(tc.function?.arguments ?? '{}') as Record<string, unknown>;
      } catch { /* leave empty */ }
      content.push({
        type: 'tool_use',
        id: tc.id ?? `tool-${Date.now()}`,
        name: tc.function?.name ?? '',
        input,
      } satisfies ToolUseBlock);
    }

    const text = content
      .filter((b): b is TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');

    // Map OpenAI finish_reason → Universal finish_reason (Anthropic-style internally)
    const fr = choice?.finish_reason ?? 'stop';
    const finishReason = fr === 'tool_calls' ? 'tool_use' : fr;

    return {
      id: data.id ?? `${this.id}-${Date.now()}`,
      model: data.model ?? requestedModel,
      providerId: this.id,
      content,
      text,
      finishReason,
      usage: {
        inputTokens: data.usage?.prompt_tokens ?? 0,
        outputTokens: data.usage?.completion_tokens ?? 0,
      },
      raw: data,
    };
  }
}
