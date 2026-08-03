/**
 * Phase 4 LLM coding engine types.
 *
 * The engine speaks in structured edits rather than unified diffs: local 7-14B
 * models produce malformed hunk headers often enough that diff parsing becomes
 * the dominant failure mode, while anchored search/replace degrades gracefully
 * (a bad anchor fails loudly instead of corrupting the file).
 */

export type FailureCategory =
  | 'MODEL_UNAVAILABLE'
  | 'MODEL_TIMEOUT'
  | 'INVALID_PLAN'
  | 'INVALID_PATCH'
  | 'CONTEXT_INSUFFICIENT'
  | 'VALIDATION_FAILED'
  | 'POLICY_DENIED'
  | 'RESOURCE_EXHAUSTED'
  | 'ENGINE_CRASHED';

export class CodingEngineError extends Error {
  constructor(readonly category: FailureCategory, message: string, readonly detail?: unknown) {
    super(message);
    this.name = 'CodingEngineError';
  }
}

/** A single anchored edit. `search` must match exactly once in the target file. */
export interface FileEdit {
  path: string;
  op: 'replace' | 'create';
  /** Required for `replace`; the exact existing text to be substituted. */
  search?: string;
  /** Replacement text for `replace`, full file body for `create`. */
  replace?: string;
  content?: string;
}

export interface ModelPlan {
  summary: string;
  filesToRead: string[];
  filesToChange: string[];
  steps: string[];
  confidence: number;
  /** Plan-gate fields: what the change centres on, in the model's own words. */
  targetFile?: string;
  targetSymbol?: string;
  targetMember?: string;
  relatedTest?: string;
}

export interface ModelPatch {
  summary: string;
  edits: FileEdit[];
}

/** A model-initiated request to widen the context window beyond the ranked candidates. */
export interface ContextExpansionRequest {
  path: string;
  reason: string;
}

export interface ContextExpansionOutcome {
  path: string;
  reason: string;
  granted: boolean;
  denialReason?: string;
  bytes: number;
}

export interface EngineTelemetry {
  model: string;
  promptTokens: number;
  evalTokens: number;
  latencyMs: number;
  tokensPerSecond: number;
  truncated: boolean;
}

export interface AppliedEdit {
  path: string;
  op: FileEdit['op'];
  applied: boolean;
  reason?: string;
  bytesBefore: number;
  bytesAfter: number;
}

/** JSON schema handed to Ollama structured output for the planning call. */
export const PLAN_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    filesToRead: { type: 'array', items: { type: 'string' } },
    filesToChange: { type: 'array', items: { type: 'string' } },
    targetFile: { type: 'string' },
    targetSymbol: { type: 'string' },
    targetMember: { type: 'string' },
    relatedTest: { type: 'string' },
    steps: { type: 'array', items: { type: 'string' } },
    confidence: { type: 'number' },
  },
  required: ['summary', 'filesToChange', 'targetFile', 'steps', 'confidence'],
} as const;

/** JSON schema handed to Ollama structured output for the patch call. */
export const PATCH_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    edits: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          op: { type: 'string', enum: ['replace', 'create'] },
          search: { type: 'string' },
          replace: { type: 'string' },
          content: { type: 'string' },
        },
        required: ['path', 'op'],
      },
    },
  },
  required: ['summary', 'edits'],
} as const;

/** JSON schema for the independent review pass. */
export const REVIEW_SCHEMA = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['PASS', 'FAIL'] },
    findings: { type: 'array', items: { type: 'string' } },
    reasoning: { type: 'string' },
  },
  required: ['status', 'findings'],
} as const;

/** JSON schema for model-requested context expansion. */
export const EXPANSION_SCHEMA = {
  type: 'object',
  properties: {
    needMoreContext: { type: 'boolean' },
    requests: {
      type: 'array',
      items: {
        type: 'object',
        properties: { path: { type: 'string' }, reason: { type: 'string' } },
        required: ['path', 'reason'],
      },
    },
  },
  required: ['needMoreContext'],
} as const;
