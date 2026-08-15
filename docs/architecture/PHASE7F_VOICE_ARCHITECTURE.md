# Phase 7F — Voice Experience Architecture

Date: 2026-08-15

Phase 7F gives Jarvis a voice interface without granting voice any new
authority. **VOICE IS NOT AUTHORITY.** Voice is a second input/output
modality over the existing Phase 7C Jarvis Gateway — not a new engine,
planner, approval system, execution engine, or identity proof.

## The canonical flow

```
transcript (typed or Web-Speech-recognized)
  → normalize (whitespace/punctuation only, never a security-sensitive target)
  → confirmation-boundary check (bare "yes"/"approved"/"yes, approve it" → fixed message, never approval)
  → safety-label (Gmail SEND/financial/shell/deploy/browser-write/desktop-control/
    autonomous-approval phrasings → BLOCKED before the Gateway ever runs)
  → confidence guard (low-confidence action-shaped request → clarification, never proceeds)
  → handleGatewayRequest() — the exact same Phase 7C Gateway a typed request uses
  → spoken-text extraction (already-redacted answer, optional TTS playback)
```

Every arrow above is implemented in
`server/src/jarvis-gateway/voice/voice-gateway.ts`'s `handleVoiceRequest()`
— the **only** function that ever calls `handleGatewayRequest()` from a
transcript. It never calls Knowledge, the planner, Simulation, Controlled
Actions, provider writers, the approval service, or shell/process directly
— every one of those is reached exclusively through the unchanged Gateway,
identically to how the Command Center Jarvis page's typed form already
calls it.

## Input contract

`server/src/jarvis-gateway/voice/types.ts`:

```ts
interface VoiceRequestInput {
  transcript: string;           // already-transcribed text — see below
  sessionId?: string;
  projectId?: string | null;
  language?: string;            // diagnostic metadata only, never routing input
  confidence?: number;          // 0-1, ASR confidence when known
  source: 'web_speech' | 'server_stt' | 'typed';
  capturedAt?: string;
  isWakeWordTriggered?: boolean; // diagnostic only, never grants authority
}
```

Nothing in this contract is trusted as identity or authority. Caller
identity comes exclusively from the same `requireRemoteAuth`/
`requireTaskRuntimeAuth` check every other Gateway route uses — unchanged
by this phase.

## Why transcript-first, not audio-first

The primary, zero-server-upload input path is the browser's native Web
Speech API (`command-center/src/lib/useSpeechRecognition.ts`) — the
browser and OS/Google speech service produce the transcript; no audio ever
reaches this server for that path. `POST /jarvis/voice/transcript` is
therefore the **one** canonical entrypoint, accepting text, exactly
matching directive §21's "prefer transcript-first server interface."

A secondary, narrow fallback exists for browsers without a usable Web
Speech API: `POST /jarvis/voice/audio-transcribe` accepts a single
uploaded audio file (strict 10MB/type limits, `multer`'s `dest` mode
generates its own server-side filename — never a client-suppliable path),
reuses the existing `transcription-service.ts` library, and returns
**only a transcript** — it never calls the Gateway itself. The Command
Center must show that transcript to the user and let them explicitly
submit it via the same `/jarvis/voice/transcript` route as a separate step
(§22/§23 — no hidden auto-submit).

## Wake word

No wake-word/always-listening loop exists. Push-to-talk is the only
recording mode (§8) — the operator explicitly starts and stops each
recording. This eliminates the accidental-wake/background-speech/nearby-
speaker threat class for v1 entirely, rather than attempting to mitigate
it. `isWakeWordTriggered` exists in the contract for future diagnostics
only; no code path reads it to grant anything.

## Confirmation boundary (§13)

`server/src/jarvis-gateway/voice/confirmation-boundary.ts`. A transcript
that IS a bare confirmation phrase ("yes", "approved", "go ahead", "send
it", "do it", "confirm", "looks good", or the realistic compound "yes,
approve it") is intercepted **before** normalization's output ever reaches
the Gateway and answered with a fixed message:

> "Approval is still required in Command Center. Voice confirmation is
> never treated as canonical approval — please review and approve in the
> Actions page."

This is enforcement by construction, not policy: even if this detector
were deleted entirely, `handleGatewayRequest()` is structurally incapable
of approving anything from a transcript (unchanged since Phase 7C —
`ACTION_PROPOSAL` never calls `.propose()`/`.approve()`/`.execute()`). The
detector exists purely so voice gives a clear, honest answer instead of
routing a bare "yes" through intent classification, where it would produce
a confusing `NO_SUPPORTED_ANSWER`.

## Safety labeling (§14)

`server/src/jarvis-gateway/voice/safety-label.ts`. A transcript matching a
high-risk, never-authorized phrasing (Gmail SEND, financial action, shell
command, deploy, browser write, desktop control, autonomous approval) is
labeled and answered `BLOCKED`/not-authorized **before** it reaches the
Gateway. This label can never be "smarter" than the Gateway — it only ever
adds an earlier, more honest rejection for phrasings the Gateway would
structurally reject anyway; it never translates a forbidden request into a
"similar" permitted one.

## Confidence handling (§7)

`server/src/jarvis-gateway/voice/confidence.ts`. Two deterministic
thresholds: `LOW_CONFIDENCE_THRESHOLD = 0.55` (below this, any request is
UX-flagged as possibly-misheard) and the stricter
`ACTION_SHAPED_CONFIDENCE_THRESHOLD = 0.75` (below this, an
action/proposal-shaped request — `ACTION_PROPOSAL`/`CODING`/`PLANNING`/
`SIMULATION` — is forced to a clarification response and **never reaches
the Gateway at all** with an unreliable transcript). A benign read at low
confidence still proceeds normally; only the action-shaped class gets the
stricter bar, since a misheard target in that class has real downstream
consequences if later acted on.

## TTS output and privacy classes (§15/§16)

`server/src/jarvis-gateway/voice/synthesize.ts`. TTS only ever synthesizes
text that already passed through the Phase 7C `scrubReply()` redaction
pipeline — no new, separate, unredacted text channel exists. Privacy class
(`PUBLIC_SAFE`/`OPERATOR_SAFE`/`SCREEN_ONLY`) is derived from the already-
redacted answer itself, reusing the existing redaction decision rather
than inventing new secret-classification logic. Synthesized audio is
returned inline as base64 in the JSON response and never persisted to disk
beyond the single request.

## Session integration (§17, unchanged Phase 7D rules)

Voice reuses Phase 7D's `SessionStore` exactly — same TTL, same
explicit-always-wins rule, same `device:`/`explicit:` prefix caller
isolation. No separate voice session store exists; `sessionId` in the
voice contract is the identical field the typed-text path already uses.

## HTTP surface

Three new routes, mounted on the same `jarvisGatewayRouter` with the exact
dual-auth pattern (`requireRemoteAuth` at `/api/command-center`,
`requireTaskRuntimeAuth` at bare `/api`) every other Gateway route uses:

| Route | Purpose | Calls the Gateway? |
|---|---|---|
| `POST /jarvis/voice/transcript` | Canonical voice entrypoint | Yes — the only one that does |
| `POST /jarvis/voice/audio-transcribe` | Upload audio → transcript only | No |
| `POST /jarvis/voice/synthesize` | Text → speech audio | No |

No arbitrary audio URL is ever accepted (no SSRF surface); the only
audio-accepting route takes a file upload with strict size/type limits.

## Command Center UX (§22-24)

`command-center/src/components/jarvis/VoiceControls.tsx`. Push-to-talk,
Stop recording, an **always-visible** transcript field (typeable directly
— not gated behind a successful speech-recognition result, so a keyboard-
only user or anyone without a working microphone can still reach the full
voice-response pipeline), an explicit Submit button (nothing is ever sent
automatically), and a Play button for spoken playback of any response. The
existing typed-text Ask form is completely untouched and remains
first-class regardless of browser support. See
`docs/security/PHASE7F_VOICE_SECURITY.md` for the security proof and
`docs/operations/PHASE7F_VOICE_RUNBOOK.md` for measured performance.

## What this phase deliberately did not build

Per the directive's explicit NOT-authorized list and the component audit's
findings: no new external action type, no voice-triggered approval or
execution, no shell/process/browser-write/desktop-control path reachable
from voice, no speaker-identity/biometric system, no persistent voice
history, no always-listening/wake-word loop, no reconnection of either
legacy voice stack (`routes/voice.ts`, `engineering/voice/voice-engine.ts`)
or either dead module (`whatsapp-voice-handler.ts`,
`voice-output-orchestrator.ts`) — all four remain exactly as quarantined/
dead as the component audit found them.
