/**
 * Phase 7F §7 — confidence handling. ASR confidence is only ever a UX
 * signal for whether to ask for clarification sooner — it never grants or
 * withholds authority, and it never lets an action/proposal-shaped request
 * auto-progress just because confidence happened to be high.
 *
 * Thresholds are deterministic constants, not tuned per-request — chosen
 * conservatively (favoring an extra clarification over a misrouted
 * action-shaped request) and documented here rather than left implicit.
 */
import type { RequestType } from '../types';

/** Below this, ANY request (even a benign read) is treated as
 *  low-confidence for UX purposes — the caller is told the transcript may
 *  be wrong and can confirm or retry. */
export const LOW_CONFIDENCE_THRESHOLD = 0.55;

/** Below this — even though still "acceptable" for a benign read — an
 *  action/proposal-shaped request (ACTION_PROPOSAL, CODING, PLANNING,
 *  SIMULATION) must not proceed; it is forced to NEEDS_CLARIFICATION
 *  regardless of what the Gateway's own classifier/handler would have
 *  done, because a misheard target (recipient, project, file) in this
 *  class of request has real consequences if acted on later. Set higher
 *  than LOW_CONFIDENCE_THRESHOLD deliberately — action-shaped requests get
 *  a stricter bar. */
export const ACTION_SHAPED_CONFIDENCE_THRESHOLD = 0.75;

const ACTION_SHAPED_TYPES = new Set<RequestType>(['ACTION_PROPOSAL', 'CODING', 'PLANNING', 'SIMULATION']);

export function isActionShaped(type: RequestType): boolean {
  return ACTION_SHAPED_TYPES.has(type);
}

export interface ConfidenceDecision {
  isLowConfidence: boolean;
  /** True only when the combination of low confidence + an action-shaped
   *  request means the caller must be asked to confirm/retry before the
   *  Gateway is ever called with this transcript for real. */
  forceClarification: boolean;
}

/** `requestType` is optional because confidence is evaluated once, before
 *  classification — callers that already know the shape (e.g. an explicit
 *  `requestType` override) can pass it; otherwise only the benign
 *  low-confidence signal applies, and the stricter action-shaped check is
 *  re-evaluated after the Gateway's own classifier runs (see voice-gateway.ts). */
export function evaluateConfidence(confidence: number | undefined, requestType?: RequestType): ConfidenceDecision {
  if (confidence === undefined) return { isLowConfidence: false, forceClarification: false };
  const isLowConfidence = confidence < LOW_CONFIDENCE_THRESHOLD;
  const forceClarification = requestType !== undefined
    ? isActionShaped(requestType) && confidence < ACTION_SHAPED_CONFIDENCE_THRESHOLD
    : false;
  return { isLowConfidence, forceClarification };
}
