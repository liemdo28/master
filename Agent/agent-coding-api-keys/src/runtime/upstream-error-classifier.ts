/**
 * Antigravity Gateway — Upstream Error Classifier
 *
 * Converts raw provider HTTP status + body into a typed error category.
 * Used by the router for:
 *  - Structured logging
 *  - Auto-fallback decisions (retryable vs. not)
 *  - Dashboard status display
 *  - Error telemetry
 *
 * Error types:
 *  auth_failed      — invalid API key / auth-specific forbidden
 *  quota_exceeded   — daily/monthly quota used up (not retryable)
 *  rate_limited     — RPM/TPM exceeded (429, retryable after backoff)
 *  invalid_model    — model name rejected (400 + model-related message)
 *  model_locked     — provider key is valid but requested model/tier is locked
 *  model_not_allowed — provider key is valid but requested model is not enabled
 *  prompt_too_large — prompt/context exceeds provider token window
 *  provider_down    — 5xx / "temporarily unavailable" (retryable with fallback)
 *  timeout          — request timed out (retryable)
 *  unknown          — unclassified error
 */

export type UpstreamErrorType =
  | 'auth_failed'
  | 'quota_exceeded'
  | 'rate_limited'
  | 'concurrency_limit'
  | 'invalid_model'
  | 'model_locked'
  | 'model_not_allowed'
  | 'prompt_too_large'
  | 'request_schema_error'
  | 'sse_tool_unsupported'
  | 'provider_down'
  | 'timeout'
  | 'unknown';

export interface ClassifiedError {
  type: UpstreamErrorType;
  /** The full raw error body (truncated to 500 chars for logging). */
  raw: string;
  /** HTTP status code, if available. */
  status?: number;
  /**
   * Whether the gateway should attempt a fallback provider for this error.
   * true  → provider_down, rate_limited, timeout (transient)
   * false → auth_failed, quota_exceeded, invalid_model (permanent / no-retry)
   */
  retryable: boolean;
  /** Short human-readable label for dashboard display. */
  label: string;
}

export function isModelCompatibilityError(type: UpstreamErrorType): boolean {
  return type === 'invalid_model' || type === 'model_locked' || type === 'model_not_allowed';
}

export function shouldDisableKeyForError(type: UpstreamErrorType): boolean {
  return type === 'auth_failed';
}

export function shouldTripProviderForError(type: UpstreamErrorType): boolean {
  return type === 'provider_down' || type === 'timeout' || type === 'rate_limited';
}

/** Classify an upstream HTTP error by status code and raw body text. */
export function classifyUpstreamError(status: number, body: string): ClassifiedError {
  const lower = body.toLowerCase();

  // ── Prompt/context too large: client payload issue, not key/provider health. ──
  if (
    lower.includes('prompt quá lớn') ||
    lower.includes('context length exceeded') ||
    lower.includes('context_length_exceeded') ||
    lower.includes('maximum context') ||
    lower.includes('context window') ||
    lower.includes('prompt too large') ||
    lower.includes('input too large') ||
    lower.includes('too many tokens') ||
    lower.includes('token limit') ||
    lower.includes('exceeds the context') ||
    lower.includes('exceeded your current quota') && lower.includes('context')
  ) {
    return { type: 'prompt_too_large', raw: body, status, retryable: false, label: 'Prompt Too Large' };
  }

  // ── Model/tier compatibility must be checked before generic 403 auth. ──
  if (
    lower.includes('model locked') ||
    lower.includes('model_locked') ||
    lower.includes('locked tier') ||
    lower.includes('premium tier') ||
    lower.includes('not active') ||
    lower.includes('chưa active') ||
    lower.includes('not enabled for this key')
  ) {
    return { type: 'model_locked', raw: body, status, retryable: true, label: 'Model Locked' };
  }

  if (
    lower.includes('model_not_allowed') ||
    lower.includes('model not allowed') ||
    lower.includes('model is not allowed') ||
    lower.includes('unsupported model') ||
    lower.includes('model_not_found') ||
    lower.includes('invalid model') ||
    lower.includes('not found')
  ) {
    return { type: 'model_not_allowed', raw: body, status, retryable: true, label: 'Model Not Allowed' };
  }

  if (
    lower.includes('tool') && (lower.includes('unsupported') || lower.includes('not supported')) ||
    lower.includes('sse') && lower.includes('unsupported')
  ) {
    return { type: 'sse_tool_unsupported', raw: body, status, retryable: true, label: 'SSE/Tool Unsupported' };
  }

  if (
    status === 400 &&
    (lower.includes('schema') || lower.includes('invalid request') || lower.includes('bad request'))
  ) {
    return { type: 'request_schema_error', raw: body, status, retryable: false, label: 'Request Schema Error' };
  }

  // ── Auth failures (401 / 403 / key-related messages) ──────────────────
  if (
    status === 401 || status === 403 ||
    lower.includes('invalid_api_key') ||
    lower.includes('invalid api key') ||
    lower.includes('unauthorized') ||
    (lower.includes('forbidden') && !lower.includes('model')) ||
    lower.includes('authentication_error') ||
    lower.includes('x-api-key')
  ) {
    return { type: 'auth_failed', raw: body, status, retryable: false, label: 'Auth Failed' };
  }

  // ── Quota / credits exhausted ──────────────────────────────────────────
  if (
    lower.includes('quota_exceeded') ||
    lower.includes('quota exceeded') ||
    lower.includes('daily limit') ||
    lower.includes('monthly limit') ||
    lower.includes('weekly limit') ||
    lower.includes('week limit') ||
    lower.includes('usage limit') ||
    lower.includes('giới hạn tuần') ||
    lower.includes('gioi han tuan') ||
    lower.includes('đạt giới hạn tuần') ||
    lower.includes('dat gioi han tuan') ||
    lower.includes('credit') ||
    lower.includes('out of tokens') ||
    (status === 402)
  ) {
    return { type: 'quota_exceeded', raw: body, status, retryable: false, label: 'Quota Exceeded' };
  }

  // OpusMax sometimes returns this as HTTP 429, but the account pool failure is
  // provider-side/transient. Do not cool down the user's API key for it.
  if (
    lower.includes('all available accounts exhausted') ||
    lower.includes('no available accounts')
  ) {
    return { type: 'provider_down', raw: body, status, retryable: true, label: 'Provider Down' };
  }

  // ── Concurrency limit — transient, retry quickly (10s cooldown) ───────
  // Must be checked before generic rate_limited (also 429) to get a shorter cooldown.
  if (
    lower.includes('concurrency limit') ||
    lower.includes('concurrency_limit') ||
    lower.includes('concurrent') && lower.includes('limit')
  ) {
    return { type: 'concurrency_limit', raw: body, status, retryable: true, label: 'Concurrency Limit' };
  }

  // ── Rate limiting (429) ────────────────────────────────────────────────
  if (
    status === 429 ||
    lower.includes('rate_limit') ||
    lower.includes('rate limit') ||
    lower.includes('too many requests') ||
    lower.includes('rpm') ||
    lower.includes('tpm') ||
    lower.includes('overloaded') ||
    lower.includes('throughput')
  ) {
    return { type: 'rate_limited', raw: body, status, retryable: true, label: 'Rate Limited' };
  }

  // ── Invalid model ──────────────────────────────────────────────────────
  if (
    status === 400 &&
    (lower.includes('model') ||
     lower.includes('chưa active') ||
     lower.includes('not found') ||
     lower.includes('invalid model') ||
     lower.includes('model_not_found'))
  ) {
    return { type: 'invalid_model', raw: body, status, retryable: true, label: 'Invalid Model' };
  }

  // ── Provider down / temporarily unavailable ───────────────────────────
  if (
    (status === 418 && (
      lower.includes('provider:') ||
      lower.includes('invokemodel') ||
      lower.includes('permission_denied') ||
      lower.includes('permission denied')
    )) ||
    status >= 500 ||
    lower.includes('temporarily unavailable') ||
    lower.includes('service unavailable') ||
    lower.includes('internal server error') ||
    lower.includes('bad gateway') ||
    lower.includes('gateway timeout') ||
    lower.includes('provider_error') ||
    lower.includes('api_error') ||
    lower.includes('overload') ||
    lower.includes('capacity')
  ) {
    return { type: 'provider_down', raw: body, status, retryable: true, label: 'Provider Down' };
  }

  return { type: 'unknown', raw: body, status, retryable: false, label: 'Error' };
}

/** Classify an error thrown by a provider (timeout, network, etc.). */
export function classifyThrownError(error: unknown): ClassifiedError {
  const msg = error instanceof Error ? error.message : String(error);
  const lower = msg.toLowerCase();

  if (lower.includes('timeout') || lower.includes('abort') || lower.includes('timed out')) {
    return { type: 'timeout', raw: msg, retryable: true, label: 'Timeout' };
  }

  if (
    lower.includes('fetch failed') ||
    lower.includes('econnreset') ||
    lower.includes('enotfound') ||
    lower.includes('econnrefused') ||
    lower.includes('und_err')
  ) {
    return { type: 'provider_down', raw: msg, retryable: true, label: 'Provider Down' };
  }

  // Try to extract status from message like "antigravity 503: ..."
  const statusMatch = msg.match(/\b([45]\d{2})\b/);
  const status = statusMatch ? parseInt(statusMatch[1]!, 10) : undefined;

  if (status) return classifyUpstreamError(status, msg);

  return { type: 'unknown', raw: msg, retryable: false, label: 'Error' };
}
