/**
 * AI Client — compatibility wrapper around the provider router.
 */

import { providerRouter } from '../providers/provider-router';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AiResponse {
  text: string;
  model: string;
  source: string;
}

// ── Standard call (existing behavior) ─────────────────────────────────────
export async function askAi(messages: ChatMessage[]): Promise<AiResponse> {
  const result = await providerRouter.generateText(messages);
  return { text: result.text, model: result.model, source: result.provider };
}

// ── Brain-router-driven call (WS1) ─────────────────────────────────────────
export interface BrainCallConfig {
  brain: string;
  model: string;
  timeout_ms: number;
  system_suffix?: string;
}

export async function askAiWithBrain(messages: ChatMessage[], config: BrainCallConfig): Promise<AiResponse> {
  // Apply system suffix if provided
  let msgs = messages;
  if (config.system_suffix) {
    msgs = messages.map(m =>
      m.role === 'system' ? { ...m, content: m.content + config.system_suffix } : m
    );
  }

  const providers = config.brain === 'claude-api' ? ['anthropic', 'ollama'] as const : undefined;
  const result = await providerRouter.generateText(msgs, {
    providers: providers ? [...providers] : undefined,
    model: config.model,
    timeoutMs: config.timeout_ms,
  });
  return { text: result.text, model: result.model, source: result.provider };
}
