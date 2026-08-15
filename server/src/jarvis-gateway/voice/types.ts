/**
 * Phase 7F — Voice Experience, read/propose only (directive §5).
 *
 * Voice is an input/output modality over the canonical Jarvis Gateway — not
 * a new engine, planner, approval system, or authority source. Every field
 * here describes what was SAID or HEARD; none of it carries authority by
 * itself. `handleVoiceRequest()` (voice-gateway.ts) is the only place a
 * VoiceRequestInput ever gets translated into a JarvisRequestInput, and it
 * does so by producing plain `text` — the Gateway has no separate "voice
 * mode" that trusts a transcript more or differently than typed text.
 */
import type { JarvisResponse } from '../types';

/** Where the transcript came from — never used as an authority/identity
 *  signal, only for UX/diagnostics (§5, §26). */
export type VoiceSource = 'web_speech' | 'server_stt' | 'typed';

export interface VoiceRequestInput {
  /** Already-transcribed text — §21 "prefer transcript-first server
   *  interface". Audio never reaches the Gateway directly; if audio was
   *  captured, it is transcribed by a separate route first (voice-stt-route.ts)
   *  and the resulting text is what gets submitted here, exactly like a
   *  user reviewing and sending a typed message. */
  transcript: string;
  sessionId?: string;
  projectId?: string | null;
  language?: string;
  /** ASR confidence, 0-1, when known (§7). Absent for `typed`/manually-edited
   *  transcripts. */
  confidence?: number;
  source: VoiceSource;
  capturedAt?: string;
  /** §8 — recorded for diagnostics only; wake-word detection never grants
   *  authority and is never treated as identity proof. */
  isWakeWordTriggered?: boolean;
}

export interface VoiceRequest extends VoiceRequestInput {
  voiceRequestId: string;
  receivedAt: string;
}

/** §15/§16 — sensitivity classes for spoken output. Reuses the same idea as
 *  Phase 6D's evidence redaction, not a new secret-classification system. */
export type VoiceOutputPrivacyClass = 'PUBLIC_SAFE' | 'OPERATOR_SAFE' | 'SCREEN_ONLY';

/** §14 — a transcript can be blocked before it ever reaches the Gateway if
 *  it names a high-risk, not-authorized intent. This is a pre-Gateway safety
 *  label, not a second authority decision — the Gateway itself already
 *  cannot execute any of these; this label exists so voice gives an honest,
 *  immediate "not authorized" answer instead of a confusing NEEDS_CLARIFICATION
 *  or ANSWERED for a request that could never succeed. */
export type VoiceSafetyLabel =
  | 'SAFE'
  | 'FORBIDDEN_GMAIL_SEND'
  | 'FORBIDDEN_FINANCIAL'
  | 'FORBIDDEN_SHELL'
  | 'FORBIDDEN_DEPLOY'
  | 'FORBIDDEN_BROWSER_WRITE'
  | 'FORBIDDEN_DESKTOP_CONTROL'
  | 'FORBIDDEN_AUTONOMOUS_APPROVAL';

export interface VoiceResponse {
  voiceRequestId: string;
  safetyLabel: VoiceSafetyLabel;
  /** Present unless safetyLabel !== 'SAFE' — a blocked transcript never
   *  reaches handleGatewayRequest() at all (§14), so there is no
   *  JarvisResponse to attach. */
  gatewayResponse: JarvisResponse | null;
  /** Always present — the honest, spoken-and-displayed answer, whether that
   *  came from the Gateway or from the pre-Gateway safety block. */
  spokenText: string;
  spokenTextPrivacyClass: VoiceOutputPrivacyClass;
  /** True only when the transcript's own low confidence, on an
   *  action/proposal-shaped request, forced a clarification instead of
   *  letting the request proceed (§7). */
  lowConfidenceClarification: boolean;
  generatedAt: string;
}
