export type ProviderKind = 'anthropic' | 'openai-compatible' | 'ollama' | 'gemini-compatible' | 'custom';
export type RouterMode = 'fallback' | 'roundrobin' | 'lowest-latency' | 'load-balance';
export type ProviderHealthStatus = 'unknown' | 'healthy' | 'degraded' | 'disabled';

// ─── Anthropic-native content block types ─────────────────────────────────

export interface TextBlock { type: 'text'; text: string }
export interface ThinkingBlock { type: 'thinking'; thinking: string; signature?: string }
export interface ToolUseBlock { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
export interface ToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: string | ContentBlock[];
  is_error?: boolean;
}
export type ContentBlock = TextBlock | ThinkingBlock | ToolUseBlock | ToolResultBlock;

// ─── Anthropic-native tool definition ─────────────────────────────────────

export interface AnthropicTool {
  name: string;
  description?: string;
  input_schema: Record<string, unknown>;
  cache_control?: { type: 'ephemeral' };
}

export interface AnthropicToolChoice {
  type: 'auto' | 'any' | 'tool' | 'none';
  name?: string;
}

// ─── OpenAI-native types (used in wire format only) ───────────────────────

export interface OpenAIToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export interface ChatMessage {
  role: 'system' | 'developer' | 'user' | 'assistant' | 'tool';
  content: string | ContentBlock[] | null;
  name?: string | undefined;
  tool_call_id?: string | undefined;
  tool_calls?: OpenAIToolCall[] | undefined;
}

export interface ChatCompletionRequest {
  model?: string | undefined;
  messages: ChatMessage[];
  temperature?: number | undefined;
  max_tokens?: number | undefined;
  max_completion_tokens?: number | undefined;
  stream?: boolean | undefined;
  tools?: unknown[] | undefined;
  tool_choice?: unknown | undefined;
  thinking?: { type: 'enabled'; budget_tokens: number } | undefined;
  response_format?: unknown | undefined;
  metadata?: Record<string, unknown> | undefined;
}

// ─── Universal (Anthropic-native) message format ──────────────────────────

export interface UniversalMessage {
  role: 'user' | 'assistant';
  content: string | ContentBlock[];
}

// ─── Universal request (Anthropic-native after adapter conversion) ─────────

export interface UniversalChatRequest {
  model: string;
  messages: UniversalMessage[];
  system?: string | undefined;
  temperature?: number | undefined;
  maxTokens: number;
  stream: boolean;
  tools?: AnthropicTool[] | undefined;
  toolChoice?: AnthropicToolChoice | undefined;
  metadata?: Record<string, unknown> | undefined;
  thinking?: { type: 'enabled'; budget_tokens: number } | undefined;
}

export interface UniversalUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface UniversalChatResponse {
  id: string;
  model: string;
  providerId: string;
  content: ContentBlock[];
  text: string;
  finishReason: string;
  usage: UniversalUsage;
  raw?: unknown;
}

// ─── Provider config ───────────────────────────────────────────────────────

export interface ProviderKey {
  id: string;
  value: string;
  active: boolean;
  label?: string | undefined;
  disabledUntil?: number | undefined;
  lastError?: string | undefined;
}

export interface ProviderConfig {
  id: string;
  label: string;
  kind: ProviderKind;
  baseURL: string;
  defaultModel: string;
  models: string[];
  aliases: Record<string, string[]>;
  keys: ProviderKey[];
  enabled: boolean;
  priority: number;
  timeoutMs: number;
  headers?: Record<string, string> | undefined;
  capabilities: {
    chat: boolean;
    streaming: boolean;
    tools: boolean;
    thinking: boolean;
    embeddings: boolean;
    multimodal: boolean;
    modelDiscovery: boolean;
  };
}

export interface GatewayConfig {
  host: string;
  port: number;
  mode: RouterMode;
  requestTimeoutMs: number;
  healthIntervalMs: number;
  providers: ProviderConfig[];
  modelAliases: Record<string, string[]>;
  routes: Record<string, string[]>;
}

export interface ProviderModel {
  id: string;
  ownedBy?: string | undefined;
  contextWindow?: number | undefined;
  capabilities?: string[] | undefined;
}

export interface ProviderHealth {
  providerId: string;
  status: ProviderHealthStatus;
  latencyMs: number | null;
  checkedAt: string;
  activeModel: string;
  availableModels: string[];
  error?: string | undefined;
  quota?: string | undefined;
}

export interface RouteAttempt {
  providerId: string;
  model: string;
  latencyMs: number;
  ok: boolean;
  error?: string | undefined;
  keyId?: string | undefined;
  sourceId?: string | undefined;
  sourceLabel?: string | undefined;
}

export interface RouteResult {
  response: UniversalChatResponse;
  attempts: RouteAttempt[];
}

export interface StreamRouteResult {
  upstream: Response;
  provider: { id: string; kind: ProviderKind };
  model: string;
  attempts: RouteAttempt[];
  sourceId?: string;
  /** Confirm the upstream stream produced a valid first event. Idempotent. */
  confirmStreamStart?: () => void;
  /** Reject an upstream stream whose first event is an error. Idempotent. */
  rejectStreamStart?: (errorType: string, message: string) => void;
  /** Call when the stream ends (success, error, or client disconnect) to free the concurrency slot. */
  releaseSlot?: () => void;
}
