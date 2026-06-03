/**
 * Model capability registry.
 * Allows the gateway to validate tool/thinking/streaming support before routing,
 * and to surface warnings in the dashboard.
 */

export interface ModelCapabilities {
  supportsTools: boolean;
  supportsThinking: boolean;
  supportsStreaming: boolean;
  supportsVision: boolean;
  supportsFunctionCalling: boolean;
  maxContextTokens: number;
  maxOutputTokens: number;
  preferredProtocol: 'anthropic' | 'openai';
  family: string;
}

const ANTHROPIC_BASE: ModelCapabilities = {
  supportsTools: true,
  supportsThinking: false,
  supportsStreaming: true,
  supportsVision: true,
  supportsFunctionCalling: true,
  maxContextTokens: 200_000,
  maxOutputTokens: 32_000,
  preferredProtocol: 'anthropic',
  family: 'claude',
};

const REGISTRY: Record<string, ModelCapabilities> = {
  // Claude 4.x
  'claude-opus-4-7':            { ...ANTHROPIC_BASE, maxOutputTokens: 32_000 },
  'claude-opus-4.7':            { ...ANTHROPIC_BASE, maxOutputTokens: 32_000 },
  'claude-opus-4-1-20250805':   { ...ANTHROPIC_BASE, maxOutputTokens: 32_000 },
  'claude-opus-4':              { ...ANTHROPIC_BASE, maxOutputTokens: 32_000 },
  'claude-opus-4.1':            { ...ANTHROPIC_BASE, maxOutputTokens: 32_000 },
  'claude-sonnet-4-6':          { ...ANTHROPIC_BASE, supportsThinking: true },
  'claude-sonnet-4-5-20250929': { ...ANTHROPIC_BASE, supportsThinking: true },
  'claude-sonnet-4-20250514':   { ...ANTHROPIC_BASE, supportsThinking: true },
  'claude-haiku-4-5':           { ...ANTHROPIC_BASE, maxContextTokens: 200_000, maxOutputTokens: 8_192 },

  // OpenAI
  'gpt-4.1': {
    supportsTools: true, supportsThinking: false, supportsStreaming: true,
    supportsVision: true, supportsFunctionCalling: true,
    maxContextTokens: 128_000, maxOutputTokens: 32_768,
    preferredProtocol: 'openai', family: 'gpt',
  },
  'gpt-4.1-mini': {
    supportsTools: true, supportsThinking: false, supportsStreaming: true,
    supportsVision: true, supportsFunctionCalling: true,
    maxContextTokens: 128_000, maxOutputTokens: 16_384,
    preferredProtocol: 'openai', family: 'gpt',
  },
  'gpt-4o': {
    supportsTools: true, supportsThinking: false, supportsStreaming: true,
    supportsVision: true, supportsFunctionCalling: true,
    maxContextTokens: 128_000, maxOutputTokens: 16_384,
    preferredProtocol: 'openai', family: 'gpt',
  },

  // Gemini
  'gemini-2.5-pro': {
    supportsTools: true, supportsThinking: true, supportsStreaming: true,
    supportsVision: true, supportsFunctionCalling: true,
    maxContextTokens: 1_000_000, maxOutputTokens: 65_536,
    preferredProtocol: 'openai', family: 'gemini',
  },
  'gemini-2.0-flash': {
    supportsTools: true, supportsThinking: false, supportsStreaming: true,
    supportsVision: true, supportsFunctionCalling: true,
    maxContextTokens: 1_000_000, maxOutputTokens: 8_192,
    preferredProtocol: 'openai', family: 'gemini',
  },

  // DeepSeek
  'deepseek-chat': {
    supportsTools: true, supportsThinking: false, supportsStreaming: true,
    supportsVision: false, supportsFunctionCalling: true,
    maxContextTokens: 64_000, maxOutputTokens: 8_192,
    preferredProtocol: 'openai', family: 'deepseek',
  },
  'deepseek-coder': {
    supportsTools: true, supportsThinking: false, supportsStreaming: true,
    supportsVision: false, supportsFunctionCalling: true,
    maxContextTokens: 64_000, maxOutputTokens: 8_192,
    preferredProtocol: 'openai', family: 'deepseek',
  },
};

const FALLBACK: ModelCapabilities = {
  supportsTools: false,
  supportsThinking: false,
  supportsStreaming: true,
  supportsVision: false,
  supportsFunctionCalling: false,
  maxContextTokens: 8_192,
  maxOutputTokens: 4_096,
  preferredProtocol: 'openai',
  family: 'unknown',
};

export function getModelCapabilities(modelId: string): ModelCapabilities {
  // Exact match
  const exact = REGISTRY[modelId];
  if (exact) return exact;

  // Prefix match (handles date-versioned names)
  for (const [key, caps] of Object.entries(REGISTRY)) {
    if (modelId.startsWith(key) || key.startsWith(modelId)) return caps;
  }

  // Heuristics
  const lower = modelId.toLowerCase();
  if (lower.includes('claude')) return { ...ANTHROPIC_BASE };
  if (lower.includes('gpt')) return { ...REGISTRY['gpt-4.1']! };
  if (lower.includes('gemini')) return { ...REGISTRY['gemini-2.5-pro']! };

  return FALLBACK;
}

export function validateToolRequest(modelId: string): string | null {
  const caps = getModelCapabilities(modelId);
  if (!caps.supportsTools) {
    return `Model "${modelId}" does not support tool calling. Agentic workflows will fail.`;
  }
  return null;
}
