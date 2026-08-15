/**
 * Phase 7F — canonical voice orchestrator (directive §4).
 *
 *   transcript → normalize → confirmation-boundary check → safety label
 *   → (low-confidence action-shaped guard) → handleGatewayRequest()
 *   → spoken-text extraction (privacy-classed) → VoiceResponse
 *
 * This is the ONLY function that turns a VoiceRequestInput into a call to
 * the canonical Jarvis Gateway. It never calls Knowledge, planner,
 * simulation, Controlled Actions, provider writers, approval service, or
 * shell/process directly (§4) — every one of those is reached exclusively
 * through handleGatewayRequest(), identically to how the Command Center
 * Jarvis page already calls it.
 */
import { randomUUID } from 'crypto';
import { handleGatewayRequest } from '../gateway';
import { classifyRequest } from '../intent-classifier';
import type { CallerIdentity, JarvisResponse } from '../types';
import type { VoiceRequestInput, VoiceRequest, VoiceResponse, VoiceOutputPrivacyClass } from './types';
import { normalizeTranscript } from './normalize';
import { classifyVoiceSafety, safetyBlockMessage } from './safety-label';
import { isBareConfirmationPhrase, CONFIRMATION_BOUNDARY_MESSAGE } from './confirmation-boundary';
import { evaluateConfidence, isActionShaped, ACTION_SHAPED_CONFIDENCE_THRESHOLD } from './confidence';
import { scrubReply } from '../../middleware/response-scrubber';

export const MAX_VOICE_TRANSCRIPT_LENGTH = 2000;

function now(): string {
  return new Date().toISOString();
}

/** §15/§16 — the spoken text is always exactly what's already on screen
 *  (the Gateway's own `answer`, already scrubbed by Phase 7C's
 *  scrubReply() pipeline before this function ever sees it) — never a
 *  separate, unredacted channel. Privacy class is SCREEN_ONLY only for the
 *  rare case the answer itself is empty/degenerate (nothing safe to say
 *  aloud); everything else the Gateway would show on screen is equally
 *  safe to speak, since Phase 7C's redaction already ran. */
function derivePrivacyClass(answer: string): VoiceOutputPrivacyClass {
  return answer.trim().length > 0 ? 'OPERATOR_SAFE' : 'SCREEN_ONLY';
}

function blockedResponse(voiceRequestId: string, message: string): VoiceResponse {
  return {
    voiceRequestId,
    safetyLabel: 'SAFE', // set by caller when applicable; overwritten below for real blocks
    gatewayResponse: null,
    spokenText: message,
    spokenTextPrivacyClass: 'PUBLIC_SAFE',
    lowConfidenceClarification: false,
    generatedAt: now(),
  };
}

export async function handleVoiceRequest(input: VoiceRequestInput, caller: CallerIdentity): Promise<VoiceResponse> {
  const voiceRequestId = randomUUID();
  const request: VoiceRequest = { ...input, voiceRequestId, receivedAt: now() };

  const { normalized } = normalizeTranscript(request.transcript);

  // §13 — bare spoken confirmation is never approval. Checked before
  // safety-labeling and before the Gateway, since a bare "yes" carries no
  // action content to classify or block — it is its own case.
  if (isBareConfirmationPhrase(normalized)) {
    return { ...blockedResponse(voiceRequestId, CONFIRMATION_BOUNDARY_MESSAGE), safetyLabel: 'SAFE' };
  }

  // §14 — high-risk intents never reach the Gateway at all.
  const safetyLabel = classifyVoiceSafety(normalized);
  if (safetyLabel !== 'SAFE') {
    return { ...blockedResponse(voiceRequestId, safetyBlockMessage(safetyLabel)), safetyLabel };
  }

  // §7 — pre-classify (cheap, deterministic, no side effect) purely to
  // decide whether this transcript's ASR confidence is high enough for an
  // action-shaped request to proceed. If not, ask for confirmation instead
  // of ever calling the Gateway with an unreliable transcript for this
  // request class.
  const preClassification = classifyRequest(normalized);
  const confidenceDecision = evaluateConfidence(request.confidence, preClassification.type);
  if (confidenceDecision.forceClarification) {
    const clarify = `I heard "${normalized}" but I'm not confident enough to act on that — it sounds like a ${preClassification.type.toLowerCase().replace('_', ' ')} request, which needs a clear target. Could you repeat that, or type it instead?`;
    return {
      voiceRequestId,
      safetyLabel: 'SAFE',
      gatewayResponse: null,
      spokenText: clarify,
      spokenTextPrivacyClass: 'PUBLIC_SAFE',
      lowConfidenceClarification: true,
      generatedAt: now(),
    };
  }

  const gatewayResponse: JarvisResponse = await handleGatewayRequest(
    { text: normalized, projectId: request.projectId, sessionId: request.sessionId },
    caller,
  );

  // Defense in depth only — gatewayResponse.answer already passed through
  // scrubReply() inside handleGatewayRequest() itself (Phase 7C). Voice
  // never introduces a second, unredacted text channel.
  const spokenText = scrubReply(gatewayResponse.answer);

  return {
    voiceRequestId,
    safetyLabel: 'SAFE',
    gatewayResponse,
    spokenText,
    spokenTextPrivacyClass: derivePrivacyClass(spokenText),
    lowConfidenceClarification: false,
    generatedAt: now(),
  };
}

export { isActionShaped, ACTION_SHAPED_CONFIDENCE_THRESHOLD };
