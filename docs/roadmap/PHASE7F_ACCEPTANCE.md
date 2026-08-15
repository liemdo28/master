# Phase 7F — Acceptance

Date: 2026-08-15

This is the acceptance record for Phase 7F (Voice Experience, read/propose
only). Like Phase 7E, there is no dedicated N-point `phase7f:acceptance`
script — voice adds no new backend contract shaped like 7B/7C's canonical-
subsystem introduction; acceptance here is the union of the dedicated test
suites below, each independently runnable, plus the full regression chain.
All results in this document are measured, not planned.

## Core test suite (`test:jarvis-voice`)

11/11 scenarios, all passing: read question, project question, knowledge
(honest no-answer), plan (advisory), simulation, proposal preparation
(always asks for exact fields), clarification (unresolvable project), low-
confidence action-shaped request (never reaches the Gateway), low-
confidence benign read (proceeds normally), unsupported-language hint
(processed, never a routing input), system health via voice.

## Dedicated security suite (`test:jarvis-voice-security`, server)

44/44 scenarios (28 pure-function + 16 HTTP-level), all passing:

- **Replay** — identical transcript twice, deterministic, no accumulating
  authority.
- **Spoofed speaker** — no speaker-identity field exists in the contract;
  a forged extra field never elevates behavior.
- **Malicious transcript / prompt injection** — 3 scenarios, all correctly
  blocked or answered as inert text.
- **Approval-by-voice** — 8 canonical confirmation phrases, all produce
  the fixed "still required" message, never reach the Gateway.
- **Forbidden actions** — 7 categories (Gmail SEND, financial, shell,
  deploy, browser-write, desktop-control, autonomous-approval), all
  correctly labeled and blocked before the Gateway.
- **Secret extraction** — direct request to read out an API key never
  leaks a secret-shaped string.
- **Cross-project / cross-session isolation** — re-proven through the
  voice path specifically.
- **Arbitrary audio URL** — structurally confirmed absent from the
  contract (no URL-typed field, no `fetch`/`http.get` in the voice
  module).
- **Oversized payload** — HTTP-level 400 confirmed.
- **Path traversal** — confirmed the audio-upload route never uses a
  client-suppliable filename.
- **TTS secret readout** — `synthesize.ts` structurally scanned for any
  unredacted source; none found.
- **HTTP-level**: auth bypass (401 with no/wrong key), missing/invalid
  fields (400), oversized transcript (400), malformed JSON (400),
  confidence out of range (400), field-smuggling (extra fields ignored),
  a real authenticated request succeeds cleanly with no `EXECUTED` string
  anywhere in the response, a forbidden intent is blocked at `200` with a
  `BLOCKED`-shaped body (not silently succeeding).

## 1000+ scenario evaluation (`jarvis-voice:evaluation`)

**1255 genuine, combinatorial scenarios** (target was ≥1000, not padded):
`classifyVoiceSafety` forbidden-category sweep (70) and safe-transcript
negative controls (4 politeness prefixes × 14 verbs × 15 topics = 840),
`evaluateConfidence` across 11 request types × 16 confidence values (176),
`isBareConfirmationPhrase` sweep + negative controls (30),
`normalizeTranscript` noise/target-preservation sweep (15), real
`handleVoiceRequest()` routing correctness across 9 intent categories × 3
reps (27) plus 9 dedicated determinism checks (each fixture run twice,
byte-identical after stripping volatile ids/timestamps/the per-call-unique
`simulationId` — same class of exclusion `phase7c-evaluation.ts`'s own
`normalize()` already established), replay (10), field-smuggling/spoof
(5), prompt injection (10), cross-project isolation (10), cross-session
isolation (10), secret-extraction attempts (10), TTS privacy-class
validity (9), multilingual language-hint neutrality (7), homophone/
target-ambiguity clarification (2), stale/never-used-session isolation
(5).

Results — every hard target from the directive met exactly:

```json
{
  "totalScenarios": 1255,
  "determinismChecks": 9,
  "determinismFailures": 0,
  "routingCorrectness": 1,
  "crossProjectLeakage": 0,
  "crossSessionLeakage": 0,
  "authorityBypass": 0,
  "approvalByVoice": 0,
  "externalSideEffects": 0,
  "secretLeakage": 0,
  "falseExecutedClaims": 0
}
```

(`routingCorrectness: 1` = 100%, target was ≥99%.)

## Accessibility (`test:jarvis-voice-a11y`, Command Center)

11/11 scenarios: landmark `aria-label` on the Voice input region,
keyboard-activatable real `<button>` elements, recording state announced
via `role="status"`, permission-denied/not-supported/TTS-unavailable
fallbacks all shown as visible text (never silent), the transcript
textarea has an accessible label and is directly editable/typeable, the
Submit button is always present (disabled until real content exists,
matching the "no hidden action" principle with better discoverability than
a conditionally-absent control), and a dedicated end-to-end test proves a
keyboard-only user can type a transcript and submit it with zero
microphone/speech-recognition involvement.

## Frontend security (`test:jarvis-voice-security`, Command Center)

13/13 scenarios: structural scans (only the two authorized voice routes
ever called via `api.post`, no `api.patch`/`api.del`, no chain-of-thought
terminology, no hardcoded secrets, no `.approve()`/`.execute()` calls, no
shell/process access, no externally-suppliable URL fetched, no raw
`device_id`/auth-header rendering) plus live-rendering proof (a malicious
spoken-response payload with `<img onerror>`/`<script>` renders as inert
text, zero DOM elements created, no hidden auto-submit — exactly one
`api.post` call per Submit click, never more — and a bare "yes approve it"
response is shown, never treated as approval).

## E2E, run against the real compiled server

Run twice (directive item 5's precedent, repeated here per item 32):
**7/7 both times.** The new Phase 7F test covers the full directive-
required flow: login → Jarvis workspace → the always-visible voice
transcript field (no separate "activate" step needed) → submit a safe
question → response rendered through the same path a typed ask uses →
project continuity via session (a follow-up with no explicit project
resolves correctly) → simulation request (mandatory non-live-execution
banner) → proposal-preparation request (always `NEEDS_CLARIFICATION`) →
"yes, approve it" → the fixed confirmation-boundary message, never an
approval → no `EXECUTED` claim or mutation control anywhere on the page →
zero real mutation across actions/plans/governance/tasks and authority
manifest counts, confirmed via direct API snapshots before/after the
entire flow.

### Two real issues found and fixed by actually running this against the real compiled server

1. **Health-check latency regression.** `probeVoiceInput()` called the
   shared `transcription-service.ts`'s `isTranscriptionAvailable()`, which
   spawns a real Python subprocess with its own 10s worst-case timeout.
   `getSystemHealth()` is on the critical path of every health check
   across the whole app — this silently pushed health-check latency from
   the documented ~2.6-4.3s baseline toward 10+ seconds whenever the local
   Whisper environment wasn't available, breaking the existing frozen E2E
   test's 5s Playwright timeout on the Health page. Fixed by racing the
   probe against a local 2s timeout in `probes.ts` specifically — the
   shared library itself is unmodified, so its own direct callers (e.g.
   `GET /api/voice/health`) keep their existing behavior.
2. **Confirmation-boundary gap on realistic phrasing.** The bare-phrase
   detector only matched single-word confirmations, anchored start-to-end
   — "yes, approve it" (this program's own example phrase) fell through
   to intent classification instead of the fixed §13 message. Fixed by
   adding a tightly-anchored compound pattern, confirmed it still rejects
   real questions that merely start with a confirmation word.

No orphan processes/listeners confirmed after either E2E run.

## Performance (`node e2e/phase7f-performance.cjs`, measured, not planned)

See `PHASE7F_VOICE_RUNBOOK.md`'s Performance section for the full table.
Summary: Gateway processing (no external provider) p50=35ms/p95=48ms
(n=10); Gateway processing (external-provider-bound, reported separately)
p50=36ms/p95=41ms (n=5); safety-blocked pre-Gateway path p50=35ms/p95=36ms
(n=10); TTS generation and audio-transcribe both n=0 with honest
unavailable/not-reliably-automatable notes rather than fabricated numbers;
UI interaction latency p50=36-40ms/p95=114-121ms (n=6, real browser).

## Full regression

- `server/`: clean `npx tsc --noEmit`, clean `npm run test:ci` (30+
  suites). All 18 prior phase acceptance chains re-run end-to-end and
  clean: 5A, 5B, 5C, 5D2, 5D3, 5F, 5G, 5H, 5I, 6A, 6B, 6C, 6D, 6E, 6F, 7A,
  7B, 7C. `test:jarvis-gateway` 15/15, `test:jarvis-gateway-security`
  4/4+32/32+23/23, `jarvis-gateway:evaluation` PASS, `test:jarvis-session`
  41/41, `test:jarvis-session-security` 19/19+36/36, `test:jarvis-voice`
  11/11, `test:jarvis-voice-security` 28+16/44, `jarvis-voice:evaluation`
  1255 scenarios PASS. `test:tracked-credential-scan`,
  `test:external-content-security` both clean.
- `command-center/`: clean `tsc -b && vite build`, `oxlint` clean (4
  pre-existing warnings, unrelated to Phase 7F); `test:command-center`
  21/21; `test:command-center-security` 21/21;
  `test:jarvis-workspace-evaluation` 778/778;
  `test:jarvis-workspace-security` 12/12; `test:jarvis-workspace-a11y`
  10/10; `test:jarvis-voice-security` 13/13; `test:jarvis-voice-a11y`
  11/11; E2E 7/7 (two full runs this phase).
- **One real failure found and fixed during this sweep** (not a 7F
  regression, a stale assertion, same class as 7E's own point-14 fix):
  `phase7c:acceptance` point 2 hardcoded `postRouteCount === 1`. Phase 7F
  deliberately added 3 legitimate new POST routes, each properly
  registered and classified. The check hardcoded a literal count, not the
  actual security semantic — amended to enumerate the exact known-good
  POST route set by name, matching 7D's own precedent of loosening the
  analogous GET-route count for the identical reason. Documented inline
  in `phase7c-acceptance.ts` and in `PHASE7F_VOICE_RUNBOOK.md`.

## Legacy voice containment re-audit

Both pre-existing voice stacks (`routes/voice.ts`,
`engineering/voice/voice-engine.ts`) remain fully quarantined — all 14
legacy voice manifest entries unchanged (`LEGACY_QUARANTINED`/
`QUARANTINED`), re-verified live (every mutation-shaped route still
returns `409`). Both dead modules (`whatsapp-voice-handler.ts`,
`voice-output-orchestrator.ts`, containing an unreachable real WhatsApp-
audio-send mutation chain) still have zero callers anywhere in the
codebase, re-grepped after this phase's changes. The new voice module
imports only two non-mutating library files (`transcription-service.ts`,
`tts-service.ts`) — confirmed via direct source inspection, never any of
the above four.

## Authority manifest impact

Before Phase 7F (post-7E): `mutations=402`, `unknownMutations=0`,
`unresolvedLegacyMutations=0`.
After Phase 7F: `total=1104`, **`mutations=408`** (+6 = the 3 new POST
routes × 2 dual-mount points each), `unknownMutations=0` (unchanged),
`unresolvedLegacyMutations=0` (unchanged), `forbidden=0`. Same
classification precedent Phase 7C's own canonical POST route already
established — zero unaccounted-for mutation surface, zero new external
authority. This increase was documented transparently per directive §27's
explicit "if mutation count increases: explain" requirement, not silently
absorbed.

## Schema

`personal-os.db` stays at v10. Phase 7F opens no new database, adds no
migration, and persists no voice data (audio or transcript) beyond a
single request.

## Hygiene scans

`git diff --check` clean (no whitespace errors), no conflict markers in
any new file, no TODO/FIXME/XXX, no Gmail-SEND/financial-action/shell-
process/direct-provider-write code (only the safety-label detector's own
category names/strings, which exist specifically to *block* those
phrasings), no audio fixture files committed anywhere in this branch's
history. `test:tracked-credential-scan` and `test:external-content-security`
both clean.

## Independent review

*To be completed before merge — see task tracking. This section will
record the review's findings and their resolution once run.*

## Production acceptance (post-deploy)

*To be completed after merge/deploy — primarily read/plan/simulate/
propose-preparation verification through the live voice pipeline, no live
Gmail draft/Calendar event/Gmail SEND, no live financial action, real
provider external writes/approval mutations/execution mutations/budget
mutations/delegation mutations all targeted at 0.*
