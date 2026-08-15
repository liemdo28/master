# Phase 7F — Voice Experience Runbook

Date: 2026-08-15

## What changed operationally

- `server/src/jarvis-gateway/voice/` (new): `types.ts`, `normalize.ts`,
  `safety-label.ts`, `confirmation-boundary.ts`, `confidence.ts`,
  `audio-transcribe.ts`, `synthesize.ts`, `voice-gateway.ts` (the
  orchestrator).
- `server/src/jarvis-gateway/router.ts`: 3 new routes —
  `POST /jarvis/voice/transcript` (canonical entrypoint),
  `POST /jarvis/voice/audio-transcribe` (upload → transcript only),
  `POST /jarvis/voice/synthesize` (text → audio).
- `server/src/authority-control-plane/registry.ts`: 3 new rules, same
  `CANONICAL_LOCAL_MUTATION`/`LOCAL_REVERSIBLE` classification Phase 7C's
  own `POST /jarvis/request` already established.
- `server/src/health-truth/probes.ts`/`types.ts`: two new
  `OPTIONAL_DEGRADED` dependencies, `VOICE_INPUT`/`VOICE_OUTPUT`. Voice
  unavailable never marks overall Jarvis DOWN.
- `command-center/src/lib/useSpeechRecognition.ts` (new), `command-center/src/components/jarvis/VoiceControls.tsx`
  (new), `JarvisPage.tsx` (renders `VoiceControls` in the ask form area,
  reuses the exact same response-caching path a typed ask uses),
  `lib/types.ts` (Voice*/VoiceResponse mirrors).
- `server/src/jarvis-gateway/phase7c-acceptance.ts`: point 2 amended to
  enumerate the real known-good POST route set by name (was hardcoded to
  exactly 1 route) — see `docs/roadmap/PHASE7E_ACCEPTANCE.md`-style
  precedent; the preserved invariant was never the literal count.
- New test/eval scripts: `test:jarvis-voice`, `test:jarvis-voice-security`
  (server), `jarvis-voice:evaluation` (1255 scenarios),
  `test:jarvis-voice-security`/`test:jarvis-voice-a11y` (Command Center).

## What did NOT change

No database schema migration — `personal-os.db` stays v10; voice opens no
new database, retains no audio or transcript beyond a single request. No
new external action type — the governed set stays frozen at
`GMAIL_CREATE_DRAFT`/`CALENDAR_EVENT_PROPOSAL`/`CALENDAR_CREATE_EVENT`. No
Gmail SEND, no financial action, no autonomous approval/execution, no
shell/process/browser-write/desktop-control path. No speaker-identity
database, no persistent voice history, no wake-word/always-listening loop.
Neither pre-existing voice stack (`routes/voice.ts`,
`engineering/voice/voice-engine.ts`) nor either dead module
(`whatsapp-voice-handler.ts`, `voice-output-orchestrator.ts`) was touched,
reconnected, or reclassified.

## How to use it

Command Center → **Jarvis** → the **Voice input** panel below the existing
text form. Push-to-talk to speak (Web Speech API, zero server upload), or
type directly into the always-visible transcript field — both populate the
same field, reviewable/editable before sending. Click **Submit** to send;
nothing is ever sent automatically. If the response includes spoken text,
click **Play** to hear it (falls back to a visible "unavailable" message
if TTS isn't configured — the text answer is always shown regardless).

```bash
curl -X POST -H "x-api-key: $MI_CORE_API_KEY" -H "Content-Type: application/json" \
  -d '{"transcript":"what tasks are waiting on me","projectId":"proj-123","source":"typed"}' \
  http://localhost:4001/api/jarvis/voice/transcript
```

## Interpreting the response

| `safetyLabel` | Meaning | What to do |
|---|---|---|
| `SAFE` | Normal — check `gatewayResponse` for the actual answer (same shape as a typed request). | Nothing special. |
| `FORBIDDEN_*` (7 values) | A high-risk, never-authorized phrasing was detected before the Gateway ran. `gatewayResponse` is always `null`. | The `spokenText` explains why and points to the correct manual path. |

`lowConfidenceClarification: true` means the transcript's ASR confidence
was too low for an action-shaped request to proceed safely — ask the
caller to repeat or type the request instead; `gatewayResponse` is `null`
in this case too.

## Performance (measured, not planned — dev checkout, single machine)

Via `node e2e/phase7f-performance.cjs` (real Chromium + real compiled
server), STT/Gateway/TTS latency reported separately per the directive's
explicit instruction not to hide provider latency:

| Measurement | n | p50 | p95 | Note |
|---|---|---|---|---|
| Gateway processing (TASK_QUERY, no external provider) | 10 | 35ms | 48ms | Direct HTTP, isolates voice pre-processing + the unchanged Gateway cost |
| Gateway processing (INFORMATION, external-provider-bound) | 5 | 36ms | 41ms | Reported separately — dominated by provider reachability (Ollama down in this dev checkout), never folded into the number above |
| Safety-blocked path (pre-Gateway only) | 10 | 35ms | 36ms | Never reaches the Gateway — measures only normalize+safety-label+confirmation-boundary overhead |
| TTS generation | 0 | — | — | Unavailable in this dev checkout (edge-tts environment not present) — reported honestly, not fabricated |
| Audio-transcribe (STT fallback path) | 0 | — | — | Live multipart round trip not reliably automatable in this scripting environment; sourced cost bound (10s/120s worst case) cited directly from `transcription-service.ts`'s own unmodified code instead of a fabricated number |
| UI interaction (click Submit to rendered) | 6 | 36-40ms | 114-121ms | Real browser, includes network + Gateway + React render |

The primary voice-input path (Web Speech API) has **zero server-side STT
latency by design** — the browser and OS/Google speech service do that
work, not this server.

## Troubleshooting

- **Voice panel shows "Voice input isn't supported in this browser"**:
  expected for browsers without a Web Speech API (notably Firefox) — the
  transcript field is still fully usable by typing directly into it; the
  existing text Ask form above is unaffected either way.
- **"Microphone permission denied" after clicking Push to talk**: expected
  browser-permission behavior, not an application error — the caller can
  still type into the transcript field.
- **A voice request returns the fixed "Approval is still required"
  message**: this is correct, not a bug — the transcript was a bare
  confirmation phrase (see `PHASE7F_VOICE_SECURITY.md`'s confirmation-
  boundary section); the caller must use the canonical Approvals/Actions
  UI.
- **`VOICE_INPUT`/`VOICE_OUTPUT` show `UNAVAILABLE` on the Health page**:
  expected when the local faster-whisper/edge-tts environment isn't set
  up — this never marks overall Jarvis DOWN; the primary Web-Speech-API
  input path and the text-answer output path are both unaffected.
- **Health check felt slow after this phase**: if `VOICE_INPUT` shows
  `UNAVAILABLE`, its own probe is bounded to a 2s worst case
  (`probes.ts`'s explicit timeout race) — if health checks are still slow,
  that is not this probe; check the other real-network probes
  (`PYTHON_AI`/`LOCAL_MODEL`) per Phase 7B's own runbook.

## Rollback

Standard: redeploy the prior `server/dist`/`command-center/dist` snapshot.
Voice is additive to the existing `/jarvis` route and Gateway router with
no schema migration — rolling back removes the 3 new routes, the two new
health dependencies, and the Voice input UI panel; nothing requires a data
migration to revert, since voice never persisted anything beyond a single
request.
