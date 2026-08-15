# Phase 7F — Component Audit

Date: 2026-08-15

## Reality audit (read-only, performed before this document)

Verified independently against live production and current master before any
implementation:

| Check | Result |
|---|---|
| Current master SHA | `89316e7030cb2687828499e54c1e865cba22baa6` (docs-only, Phase 7E closure) |
| Deployed functional SHA | `d4696755e9850a95835c32009d5c76b657e7bbbb` (Phase 7E) |
| `.env` provenance | Consistent — `.env` reports `d4696755...`, matches deploy-owned snapshot and production's local `server/snapshot-manifest.json` |
| `personal-os.db` / `tasks.db` / `projects.db` | `integrity_check=ok`, `0` FK violations each |
| PM2 state | 5 apps online, no unexpected restarts (`mi-core` uptime ~19m from the 7E deploy restart, all others 26h+) |
| `GET /api/health` | `{"server":"ok","python_ai_service":"ok","ollama":"down","overall":"DEGRADED"}` (standing baseline) |
| `GET /api/health/detail` | `overall: DEGRADED (MODEL_UNAVAILABLE)`; `CORE`/`DATABASE`/`AUTHORITY`/`KNOWLEDGE` all `HEALTHY` |
| `GET /api/authority/status` | `mutations=402`, `unknownMutations=0`, `unresolvedLegacyMutations=0`, `total=1096` |
| Jarvis Gateway | `POST /api/jarvis/request` live, `SYSTEM_STATUS`/`DEGRADED` response with correct `sessionId: null` field |
| Operator Workspace | `GET /command-center/` → `200` |
| Session endpoint | `GET /api/jarvis/session/current` present since Phase 7D, unchanged |

No STOP condition triggered. Proceeding to implementation is authorized.

## Voice/speech component search — full inventory

A repository-wide search for voice/speech/STT/TTS-related code found **two
independent, live, HTTP-reachable voice stacks** and **two dead modules
containing an unreachable mutation chain**. No prior Phase 7A–7E component
audit enumerates voice as a subsystem — this is first coverage.

### Stack A — `server/src/routes/voice.ts`, mounted at `/api/voice`

| Route | Method | Live behavior (verified) | Classification |
|---|---|---|---|
| `/health` | GET | `200`, real functional check of `faster-whisper`/`edge-tts` availability | **ADAPTER candidate** — reusable as a technical health signal |
| `/transcribe` | POST | `409 LEGACY_AUTHORITY_QUARANTINED` (verified live) | **QUARANTINED** |
| `/ask` | POST | `409 LEGACY_AUTHORITY_QUARANTINED` (verified live) | **QUARANTINED** — also routes through the legacy `pipeline/response-pipeline.ts`/`jarvis-core.ts` path, not the Phase 7C Gateway, so even if unquarantined this is the wrong routing target |
| `/test` | POST | Quarantined (manifest-classified `LEGACY_QUARANTINED`) | **QUARANTINED** |
| `/output/health`, `/output/voices` | GET | Manifest-classified `LEGACY_QUARANTINED` but `READ_ONLY` effect class — reads only | **ADAPTER candidate** |
| `/output/speak` | POST | Quarantined | **QUARANTINED** |
| `/output/evidence`, `/output/evidence/:workflow_id` | GET | Quarantined per manifest, read-only | **LEGACY** (voice-approval-workflow evidence, a different concept than Phase 6D Evidence Service — not reused) |
| `/output/daily-brief`, `/output/send` | POST | Explicitly call `denyAuthorityMutation()` directly in the route body (Phase 6A comment: "Legacy outbound voice send is quarantined... no WhatsApp/audio send authority is expanded") | **QUARANTINED**, intentionally, by design |

**Auth finding (verified live, not assumed from reading the route file
alone)**: `voice.ts` itself imports no auth middleware. However every
request to `/api/voice/*` is gated by the same `MI_CORE_API_KEY` as every
other bare-`/api`-mounted route — not via anything in `voice.ts`, but
because `server/src/index.ts` mounts many bare-`/api`-prefixed routers
(`personalOsRouter`, `evidenceRouter`, `jarvisGatewayRouter`, etc., lines
~254–268) each wrapped in `requireTaskRuntimeAuth` *before* `/api/voice` is
reached (line 336+). Since Express's `app.use('/api', requireTaskRuntimeAuth,
someRouter)` runs `requireTaskRuntimeAuth` for **any** path with prefix
`/api`, not just paths `someRouter` recognizes, an unauthenticated request
short-circuits with `401` at the very first such mount, before ever
reaching `voice.ts`. Confirmed live: `GET /api/voice/health` → `401
{"error":"Unauthorized"}` with no key, `200` with the correct
`MI_CORE_API_KEY`. This is real but implicit protection, not a route-level
guarantee `voice.ts` itself provides — worth calling out because it means
Phase 7F's own new routes must not assume this cascade continues to work
by accident; the new voice route is mounted explicitly with the same
dual-auth pattern every other Gateway route uses (see
`PHASE7F_VOICE_ARCHITECTURE.md`).

**Supporting libraries**, all reachable only via the routes above:
`server/src/voice/transcription-service.ts` (faster-whisper wrapper, runs
fully local), `tts-service.ts` (shells out to a local Python script,
`scripts/vietts_synthesize.py`, which itself calls the `edge-tts` library
— that library talks to a free Microsoft cloud TTS endpoint, not a local
model; corrected here after independent review of PR #109 flagged the
original wording as inaccurately describing this as fully local/no
external network call), `vietnamese-intent-parser.ts`,
`voice-evidence-store.ts`, `voice-personality.ts`, `audio-store.ts`.
Classification: **CANONICAL_REUSE** for the STT/TTS technical primitives
(`transcription-service.ts`/`tts-service.ts` themselves have no mutation
capability — they read audio in, write text/audio out; STT is local
inference, TTS makes an outbound call to Microsoft's free edge-tts
endpoint but performs no mutation of any kind) — Phase 7F reuses these
two files directly rather than reimplementing STT/TTS.

### Stack B — `server/src/engineering/voice/voice-engine.ts`, mounted at `/api/ai/voice/*` via `routes/ai-platform.ts`

A **second, fully independent** STT/TTS implementation using OpenAI Whisper
(`whisper-1`) and OpenAI TTS (`tts-1`) via raw HTTPS calls. All three
routes (`/api/ai/voice/stt`, `/tts`, `/classify`) are POST and
manifest-classified `LEGACY_QUARANTINED` — confirmed by the same live-409
pattern as Stack A's POST routes (not independently re-verified live for
this specific stack, since it duplicates Stack A's blocked status and
carries no different auth wiring). Classification: **DO_NOT_USE** — this
duplicates Stack A with a different (paid, external, OpenAI-hosted)
provider and zero approval-gate/evidence integration of its own. Phase 7F
does not adopt this stack; it remains quarantined and untouched. Its
existence as an unresolved duplication is noted here for a future phase's
consideration (out of scope for 7F, which must not expand authority or
consolidate legacy systems beyond what voice work itself requires).

### Dead modules

- **`server/src/voice/whatsapp-voice-handler.ts`** (`handleVoiceMessage`) —
  a complete "voice message → transcribe → route through pipeline" handler.
  Grepped repository-wide: **zero callers**. `routes/whatsapp.ts` has no
  audio/voice handling at all. Classification: **DEAD**. Left untouched —
  Phase 7F does not delete or resurrect it (deletion is a separate,
  unrelated cleanup; resurrection would require re-running the exact
  Phase 6A quarantine analysis this phase is not scoped to redo).
- **`server/src/voice/voice-output-orchestrator.ts`**
  (`orchestrateVoiceOutput`, `approveVoiceNote`) — a full
  TTS→approval-gate→WhatsApp-send→evidence pipeline, importing
  `services/whatsapp-sender.ts` (`sendWhatsAppAudio`) and
  `approval/gate.ts`. Grepped: **zero callers** outside its own file (only
  referenced in archived docs). The one HTTP route that could have called
  it (`/api/voice/output/send`) instead calls `denyAuthorityMutation()`
  directly and never invokes this module. Classification: **DEAD**, but
  explicitly **DO_NOT_USE** if ever reconnected — it is exactly the
  mutation-capable (real WhatsApp audio send) path Phase 6A intentionally
  quarantined at the route layer. Phase 7F's own architecture must never
  call this module, directly or transitively.

## Phase 7F's canonical choice

**Reuse**: `transcription-service.ts` (STT) and `tts-service.ts` (TTS) from
Stack A, called directly as libraries — not through `routes/voice.ts`'s
quarantined `/ask` route, which routes through the legacy pipeline rather
than the Phase 7C Jarvis Gateway.

**Build new**: a canonical voice entrypoint under the Jarvis Gateway's own
module (`server/src/jarvis-gateway/voice/`), mounted via the same
dual-auth pattern (`requireRemoteAuth` at `/api/command-center`,
`requireTaskRuntimeAuth` at bare `/api`) every other Gateway route uses,
that accepts a transcript (or audio, transcribed via the reused STT
library) and calls `handleGatewayRequest()` exactly as the Command Center
Jarvis page already does — voice becomes a second input modality over the
existing Gateway, never a second Gateway.

**Never touch**: Stack B (`/api/ai/voice/*`), either dead module, or
`routes/voice.ts`'s quarantined POST routes. All four remain exactly as
quarantined/dead as they are today; Phase 7F's new code has no import
relationship to any of them beyond the two reused library files named
above.

## Threat model

| Threat | Mitigation in this design |
|---|---|
| **Replayed recording** | Voice identity is never trusted as authentication; a replayed transcript produces the same Gateway response a typed replay would — no additional authority from audio specifically. Caller identity comes from the same `requireRemoteAuth`/`requireTaskRuntimeAuth` session/key check every other Gateway request uses, never from the audio itself. |
| **Speaker spoofing** | No speaker-identification/biometric matching exists or is added (§28 explicitly forbids a speaker-identity database). Any voice request carries exactly the authority of its authenticated HTTP caller, nothing more. |
| **TV/video/audio injection, background speech, accidental wake** | Push-to-talk is the default and recommended mode (§8) — no always-listening/wake-word loop is added in this phase, eliminating this class of accidental-trigger risk entirely for v1. |
| **Malicious nearby speaker / remote microphone feed** | Same as replay/spoofing — no authority is derived from voice presence; a malicious utterance is just untrusted transcript text, subject to the same Gateway-level intent classification, project resolution, and clarification rules every text request already goes through. |
| **Transcript prompt injection / hidden command inside long speech** | Transcript is passed to `handleGatewayRequest()` as plain `text`, exactly like a Command Center text request — the Gateway has no separate "voice mode" that trusts embedded instructions differently. `ACTION_PROPOSAL` still never guesses fields; `CODING` still never mutates; no code path re-interprets transcript content as a system instruction. |
| **Multilingual misrecognition / homophone ambiguity / target ambiguity** | If ASR confidence is low or the transcript is ambiguous for a target-bearing request (project name, recipient), the Gateway's existing `NEEDS_CLARIFICATION` path is used — never a best-guess resolution (§7). |
| **Approval spoofing (spoken "yes"/"approve"/"send it")** | Structurally impossible to approve anything via this surface: the voice entrypoint only ever calls `handleGatewayRequest()`, which — unchanged since Phase 7C — never calls `.approve()`/`.execute()` on any service. A transcript containing an approval-shaped phrase is just text; §13's hard rule is enforced by construction, not by a keyword blocklist alone (see `PHASE7F_VOICE_SECURITY.md`). |
| **Transcript tampering** | The transcript is generated server-side from uploaded audio (or supplied directly as already-transcribed text from the CC UI) and passed through unmodified to the Gateway aside from safe whitespace/punctuation normalization (§6) — no client-suppliable "trust this transcript as ground truth for a different, riskier action" field exists. |
| **Stale session context / cross-project context** | Voice reuses Phase 7D's `SessionStore` exactly — same TTL, same explicit-always-wins rule, same prefix-based caller isolation. No separate voice session store (§17). |
| **Cross-project context leakage** | Same project-resolution rules as text: an ambiguous or unresolvable project reference yields `NEEDS_CLARIFICATION`, never a silent switch. |
| **Secret readout through TTS** | TTS only ever synthesizes the same `answer`/fact text a Command Center text response would show — which already passes through the Phase 7C `scrubReply()` pipeline. No new field of the response is spoken that isn't already screen-rendered; secrets are never present in the text handed to `tts-service.ts` in the first place (see `PHASE7F_VOICE_SECURITY.md` for the redaction proof). |

**Voice is never treated as strong identity evidence** — this is the single
governing principle behind every mitigation above: the entrypoint's own
HTTP authentication (unchanged from every other Gateway route) is the only
identity signal that matters; the presence, content, or confidence of the
transcript itself never grants, upgrades, or bypasses authority.
