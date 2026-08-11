import type { EvidenceCategory, EvidenceRedactionClass, EvidenceSourceSystem } from './types';

/** Same pattern set as Phase 5I's delegation eligibility secret scan
 *  (server/src/personal-os/delegation/eligibility.ts) — kept in sync deliberately
 *  rather than imported cross-module, since evidence must never depend on delegation. */
const SECRET_PATTERNS = [
  /sk-[A-Za-z0-9]{20,}/,
  /AIza[0-9A-Za-z_-]{20,}/,
  /-----BEGIN/,
  /refresh_token['"]?\s*[:=]/i,
  /client_secret['"]?\s*[:=]/i,
  /api[_-]?key['"]?\s*[:=]\s*['"][A-Za-z0-9_-]{16,}/i,
  /password['"]?\s*[:=]\s*['"][^'"]{4,}/i,
];

/** Never returns the matched secret text — callers must discard the original string on
 *  a positive match, not merely mask part of it. */
export function containsSecret(text: string): boolean {
  return SECRET_PATTERNS.some(p => p.test(text));
}

/** Deterministic default redaction class per (sourceSystem, category) — never inferred
 *  from claim content (content-driven upgrade to SECRET_NEVER_RENDER happens
 *  separately in normalize.ts's baseRecord(), based on containsSecret() on the RAW
 *  pre-sanitized text, not on this lookup). Aggregate, already-public-safe health
 *  counters (service health, approvals-waiting counts) are PUBLIC_SAFE; everything
 *  else defaults to OPERATOR_SAFE (safe for an authenticated Command Center operator,
 *  never for an unauthenticated route). Governance anomalies are SENSITIVE — their
 *  free-text `description` can reference specifics of a proposal/payload that
 *  shouldn't be broadly visible even to every operator view, unlike a plain health
 *  counter. Raw provider payloads are never modeled as EvidenceRecord claims at all —
 *  see normalize.ts, which only ever extracts pre-approved safe summary fields. */
export function classifyRedaction(sourceSystem: EvidenceSourceSystem, category: EvidenceCategory): EvidenceRedactionClass {
  if (category === 'HEALTH' && sourceSystem !== 'GOVERNANCE') return 'PUBLIC_SAFE';
  if (category === 'HEALTH' && sourceSystem === 'GOVERNANCE') return 'SENSITIVE'; // anomaly findings
  return 'OPERATOR_SAFE';
}

/** Sanitizes a claim string for safe storage/display. If the text matches any secret
 *  pattern, the ENTIRE claim is replaced — never partially masked, since a partial mask
 *  can still leak enough of a token to be dangerous. Also truncates to a bounded length
 *  so no evidence claim can smuggle an entire raw payload. */
export function sanitizeClaim(text: string, maxLength = 500): string {
  if (containsSecret(text)) return '[redacted: claim text matched a secret pattern]';
  const trimmed = text.trim();
  return trimmed.length > maxLength ? trimmed.slice(0, maxLength) + '…' : trimmed;
}

/** Applied to any canonicalReference before it is ever set on an EvidenceRecord — a
 *  reference must be a safe path/URI/short-hash, never a credential-bearing string. */
export function sanitizeCanonicalReference(ref: string | null): string | null {
  if (!ref) return null;
  if (containsSecret(ref)) return null;
  return ref.length > 240 ? ref.slice(0, 240) : ref;
}
