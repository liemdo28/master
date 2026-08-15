/**
 * Phase 7F §13 — the voice confirmation boundary. Hard rule: spoken
 * confirmation is NEVER canonical approval.
 *
 * This module only ever detects a transcript that IS a bare confirmation
 * phrase (nothing else) and short-circuits it with a fixed, honest reply —
 * it does not and cannot grant approval; no code path exists anywhere in
 * this module, or in handleGatewayRequest(), that calls an approve/execute
 * method. Even if this detector were deleted entirely, the Gateway would
 * still be structurally incapable of approving anything from a transcript
 * — this module exists purely to give a clear, correct answer instead of
 * routing a bare "yes" through intent classification, where it would
 * likely produce a confusing NO_SUPPORTED_ANSWER instead of the honest
 * "approval is still required in Command Center" message §13 requires.
 */

const BARE_CONFIRMATION_PATTERNS: RegExp[] = [
  /^(yes|yeah|yep|yup)[.!]?$/i,
  /^approved?[.!]?$/i,
  /^go\s+ahead[.!]?$/i,
  /^send\s+it[.!]?$/i,
  /^do\s+it[.!]?$/i,
  /^confirm(ed)?[.!]?$/i,
  /^looks?\s+good[.!]?$/i,
  /^(ok|okay)[,.!]?\s*(send|do)\s+it[.!]?$/i,
  /^that('s| is)\s+correct[.!]?$/i,
];

export const CONFIRMATION_BOUNDARY_MESSAGE =
  'Approval is still required in Command Center. Voice confirmation is never treated as canonical approval — please review and approve in the Actions page.';

export function isBareConfirmationPhrase(transcript: string): boolean {
  const trimmed = transcript.trim();
  return BARE_CONFIRMATION_PATTERNS.some(p => p.test(trimmed));
}
