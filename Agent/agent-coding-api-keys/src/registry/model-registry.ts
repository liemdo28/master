/**
 * Antigravity Universal AI Gateway — Dynamic Model Registry
 *
 * Central truth for what every model can do, which providers serve it,
 * and which protocol they speak. The router and dashboard consult this
 * registry to make routing decisions and surface compatibility warnings.
 *
 * Design principles:
 *  - Provider-agnostic: a model is a capability spec, not a vendor SKU
 *  - Alias-first: Cline sends "claude-opus-4-7"; we normalise to canonical IDs
 *  - Runtime-extensible: addModel() lets providers self-register at boot
 */

export type Protocol = 'anthropic' | 'openai' | 'ollama' | 'gemini';
export type ModelFamily = 'claude' | 'gpt' | 'gemini' | 'deepseek' | 'qwen' | 'llama' | 'unknown';

export interface ModelEntry {
  /** Canonical model ID (provider's native name). */
  id: string;
  /** Human-readable label. */
  label: string;
  /** Short aliases that clients may send (e.g. "claude-opus-4-7"). */
  aliases: string[];
  /** Native protocol this model speaks. */
  protocol: Protocol;
  /** Provider IDs that can serve this model. */
  providers: string[];
  /** Model family for heuristic routing. */
  family: ModelFamily;

  // ── Capability flags ──────────────────────────────────────────────────
  supportsTools: boolean;
  supportsThinking: boolean;
  supportsStreaming: boolean;
  supportsVision: boolean;
  supportsFunctionCalling: boolean;

  // ── Limits ────────────────────────────────────────────────────────────
  maxContextTokens: number;
  maxOutputTokens: number;

  // ── Optional metadata ─────────────────────────────────────────────────
  releaseDate?: string | undefined;
  deprecated?: boolean | undefined;
  notes?: string | undefined;
}

// ─── Built-in registry ────────────────────────────────────────────────────

const BUILT_IN: ModelEntry[] = [
  // ── Claude 4.x ────────────────────────────────────────────────────────
  {
    id: 'claude-opus-4-1-20250805',
    label: 'Claude Opus 4.1',
    aliases: ['claude-opus-4-7', 'claude-opus-4.7', 'claude-opus-4', 'claude-opus-4.1'],
    protocol: 'anthropic',
    providers: ['opusmax', 'antigravity', 'anthropic', 'openrouter'],
    family: 'claude',
    supportsTools: true, supportsThinking: false, supportsStreaming: true,
    supportsVision: true, supportsFunctionCalling: true,
    maxContextTokens: 200_000, maxOutputTokens: 32_000,
    releaseDate: '2025-08-05',
  },
  {
    id: 'claude-sonnet-4-5-20250929',
    label: 'Claude Sonnet 4.5',
    aliases: ['claude-sonnet-4-6', 'claude-sonnet-4-5', 'claude-sonnet-4'],
    protocol: 'anthropic',
    providers: ['anthropic', 'antigravity', 'openrouter'],
    family: 'claude',
    supportsTools: true, supportsThinking: true, supportsStreaming: true,
    supportsVision: true, supportsFunctionCalling: true,
    maxContextTokens: 200_000, maxOutputTokens: 16_000,
    notes: 'Supports extended thinking via anthropic-beta header',
  },
  {
    id: 'claude-haiku-4-5',
    label: 'Claude Haiku 4.5',
    aliases: ['claude-haiku-4-5', 'claude-haiku-4'],
    protocol: 'anthropic',
    providers: ['anthropic', 'openrouter'],
    family: 'claude',
    supportsTools: true, supportsThinking: false, supportsStreaming: true,
    supportsVision: true, supportsFunctionCalling: true,
    maxContextTokens: 200_000, maxOutputTokens: 8_192,
  },

  // ── OpenAI GPT-4.x ────────────────────────────────────────────────────
  {
    id: 'gpt-4.1',
    label: 'GPT-4.1',
    aliases: ['gpt-4.1', 'openai/gpt-4.1'],
    protocol: 'openai',
    providers: ['openai', 'openrouter'],
    family: 'gpt',
    supportsTools: true, supportsThinking: false, supportsStreaming: true,
    supportsVision: true, supportsFunctionCalling: true,
    maxContextTokens: 128_000, maxOutputTokens: 32_768,
  },
  {
    id: 'gpt-4.1-mini',
    label: 'GPT-4.1 Mini',
    aliases: ['gpt-4.1-mini'],
    protocol: 'openai',
    providers: ['openai', 'openrouter'],
    family: 'gpt',
    supportsTools: true, supportsThinking: false, supportsStreaming: true,
    supportsVision: true, supportsFunctionCalling: true,
    maxContextTokens: 128_000, maxOutputTokens: 16_384,
  },
  {
    id: 'gpt-4o',
    label: 'GPT-4o',
    aliases: ['gpt-4o'],
    protocol: 'openai',
    providers: ['openai', 'openrouter'],
    family: 'gpt',
    supportsTools: true, supportsThinking: false, supportsStreaming: true,
    supportsVision: true, supportsFunctionCalling: true,
    maxContextTokens: 128_000, maxOutputTokens: 16_384,
  },

  // ── Gemini ────────────────────────────────────────────────────────────
  {
    id: 'gemini-2.5-pro',
    label: 'Gemini 2.5 Pro',
    aliases: ['gemini-2.5-pro', 'google/gemini-2.5-pro'],
    protocol: 'openai',
    providers: ['gemini', 'openrouter'],
    family: 'gemini',
    supportsTools: true, supportsThinking: true, supportsStreaming: true,
    supportsVision: true, supportsFunctionCalling: true,
    maxContextTokens: 1_000_000, maxOutputTokens: 65_536,
  },
  {
    id: 'gemini-2.0-flash',
    label: 'Gemini 2.0 Flash',
    aliases: ['gemini-2.0-flash'],
    protocol: 'openai',
    providers: ['gemini', 'openrouter'],
    family: 'gemini',
    supportsTools: true, supportsThinking: false, supportsStreaming: true,
    supportsVision: true, supportsFunctionCalling: true,
    maxContextTokens: 1_000_000, maxOutputTokens: 8_192,
  },

  // ── DeepSeek ─────────────────────────────────────────────────────────
  {
    id: 'deepseek-chat',
    label: 'DeepSeek V3',
    aliases: ['deepseek-chat', 'deepseek-v3'],
    protocol: 'openai',
    providers: ['deepseek', 'openrouter'],
    family: 'deepseek',
    supportsTools: true, supportsThinking: false, supportsStreaming: true,
    supportsVision: false, supportsFunctionCalling: true,
    maxContextTokens: 64_000, maxOutputTokens: 8_192,
  },
  {
    id: 'deepseek-coder',
    label: 'DeepSeek Coder',
    aliases: ['deepseek-coder'],
    protocol: 'openai',
    providers: ['deepseek', 'openrouter'],
    family: 'deepseek',
    supportsTools: true, supportsThinking: false, supportsStreaming: true,
    supportsVision: false, supportsFunctionCalling: true,
    maxContextTokens: 64_000, maxOutputTokens: 8_192,
  },

  // ── Local / Ollama ────────────────────────────────────────────────────
  {
    id: 'qwen2.5-coder:7b',
    label: 'Qwen 2.5 Coder 7B',
    aliases: ['qwen2.5-coder:7b', 'qwen-coder'],
    protocol: 'ollama',
    providers: ['ollama'],
    family: 'qwen',
    supportsTools: false, supportsThinking: false, supportsStreaming: true,
    supportsVision: false, supportsFunctionCalling: false,
    maxContextTokens: 32_768, maxOutputTokens: 4_096,
    notes: 'Local model — no API key required',
  },
  {
    id: 'llama3.1',
    label: 'Llama 3.1',
    aliases: ['llama3.1', 'llama3', 'llama-3'],
    protocol: 'ollama',
    providers: ['ollama'],
    family: 'llama',
    supportsTools: false, supportsThinking: false, supportsStreaming: true,
    supportsVision: false, supportsFunctionCalling: false,
    maxContextTokens: 128_000, maxOutputTokens: 4_096,
  },
];

// ─── Registry class ────────────────────────────────────────────────────────

export class ModelRegistry {
  private readonly entries = new Map<string, ModelEntry>();

  constructor() {
    for (const entry of BUILT_IN) this.register(entry);
  }

  /** Register or overwrite a model entry. */
  register(entry: ModelEntry): void {
    this.entries.set(entry.id, entry);
    for (const alias of entry.aliases) {
      if (!this.entries.has(alias)) {
        // Store alias as pointer to canonical entry
        this.entries.set(alias, entry);
      }
    }
  }

  /** Resolve any model ID or alias to its canonical entry. */
  resolve(modelId: string): ModelEntry | undefined {
    return this.entries.get(modelId);
  }

  /** Resolve model ID to its canonical entry, or build a best-effort entry. */
  resolveOrInfer(modelId: string): ModelEntry {
    const found = this.entries.get(modelId);
    if (found) return found;

    // Heuristic inference from model name
    const lower = modelId.toLowerCase();
    const isClaude = lower.includes('claude');
    const isGPT = lower.includes('gpt');
    const isGemini = lower.includes('gemini');
    const isLocal = lower.includes('llama') || lower.includes('qwen') || lower.includes('mistral');

    return {
      id: modelId,
      label: modelId,
      aliases: [],
      protocol: isClaude ? 'anthropic' : isLocal ? 'ollama' : 'openai',
      providers: [],
      family: isClaude ? 'claude' : isGPT ? 'gpt' : isGemini ? 'gemini' : isLocal ? 'llama' : 'unknown',
      supportsTools: !isLocal,
      supportsThinking: false,
      supportsStreaming: true,
      supportsVision: isClaude || isGPT || isGemini,
      supportsFunctionCalling: !isLocal,
      maxContextTokens: 32_768,
      maxOutputTokens: 4_096,
    };
  }

  /** List all canonical entries (no duplicate aliases). */
  list(): ModelEntry[] {
    const seen = new Set<string>();
    const result: ModelEntry[] = [];
    for (const entry of this.entries.values()) {
      if (!seen.has(entry.id)) {
        seen.add(entry.id);
        result.push(entry);
      }
    }
    return result.sort((a, b) => a.id.localeCompare(b.id));
  }

  /** Check if a model supports tools; returns a warning string or null. */
  toolCompatibilityWarning(modelId: string): string | null {
    const entry = this.resolve(modelId);
    if (!entry) return null;
    if (!entry.supportsTools) {
      return `⚠  Model "${entry.label}" does not support tool calling. Agentic workflows will fail.`;
    }
    return null;
  }

  /** Return models that can serve a given intent (tools required, etc.). */
  compatible(opts: { requireTools?: boolean; requireThinking?: boolean; requireVision?: boolean }): ModelEntry[] {
    return this.list().filter((m) => {
      if (opts.requireTools && !m.supportsTools) return false;
      if (opts.requireThinking && !m.supportsThinking) return false;
      if (opts.requireVision && !m.supportsVision) return false;
      return true;
    });
  }
}

/** Singleton registry instance shared across the gateway. */
export const registry = new ModelRegistry();
