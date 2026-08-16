# Phase 7F — Closure

Date: 2026-08-15

**PHASE 7F — VOICE EXPERIENCE, READ / PROPOSE ONLY — COMPLETE AND FROZEN.**

## Summary

Phase 7F gave Jarvis a voice interface as a thin input/output modality over
the unchanged Phase 7C Gateway — never a new engine, planner, approval
path, execution engine, or identity proof. Spoken "yes"/"approved"/etc.
(including compound phrasing like "yes, approve it") is intercepted before
the Gateway ever runs and can never be treated as approval; approval still
requires the canonical Command Center UI. Seven categories of high-risk
phrasing (Gmail send, financial actions, shell commands, deploy/merge,
browser writes, desktop control, autonomous approval) are safety-labeled
and blocked before reaching the Gateway. See
[`PHASE7F_VOICE_ARCHITECTURE.md`](../architecture/PHASE7F_VOICE_ARCHITECTURE.md)
for the full design and
[`PHASE7F_VOICE_SECURITY.md`](../security/PHASE7F_VOICE_SECURITY.md) for
the security invariants, structurally proven, not just documented.

## Merge

- PR: [#109](https://github.com/liemdo28/master/pull/109)
- Independent review: fresh agent, no prior context. Verdict: **SAFE TO
  MERGE**, with 2 real findings and 2 nitpicks, all fixed before merge:
  - `safety-label.ts`'s regex patterns had false-negative gaps across all
    7 forbidden categories on natural phrasing (10 example phrases given,
    e.g. "deploy the app to production", "press the login button", "run
    npm install"). Broadened all 7 pattern groups and added a permanent
    10-phrase regression-lock test block with the reviewer's exact
    phrases.
  - The evaluation script's own `FORBIDDEN_DEPLOY` test templates used
    unnatural doubled-word phrasing that was effectively reverse-
    engineered to satisfy the buggy regex rather than testing realistic
    speech — explaining why the 1255-scenario evaluation's clean pass rate
    hadn't caught the gap above. Fixed to natural phrasing.
  - `synthesize.ts`'s docstring (and `PHASE7F_VOICE_SECURITY.md`'s
    "Secret leakage" section) overstated text-origin enforcement as a
    hard, server-enforced boundary when it is actually a frontend
    convention. Corrected both, with the reasoning for why this is still
    not a leakage vector (no secret is read to fulfill a synthesis
    request).
  - The Play button only worked for blocked responses, not successful
    Gateway answers, contradicting the architecture doc's claim — this was
    an actual functional gap, fixed by wiring a shared `lastSpokenText`
    state for both paths.
  - One review-fix pass itself missed a case ("press the login button" —
    an intervening descriptive word between "the" and "button") — caught
    by the new regression-lock test failing on the fresh checkout,
    patched with an optional `\w+` token in the same PR before merge.
  - Full writeup in the PR's review-response comment and
    [`PHASE7F_ACCEPTANCE.md`](../roadmap/PHASE7F_ACCEPTANCE.md).
- CI: green.
- Merge commit: `83784fcdec86f2118d895297a60fbd391ab653e3`

## Clean final-master build + gate re-run

Performed from a fresh detached worktree at the merge SHA:

- `npm ci` (server, command-center): clean.
- `npx tsc --noEmit` / `npx tsc -b` (server, command-center): clean.
- `npm run build` (both): clean.
- `npm run authority:manifest:check`: **the same transient
  `AUTHORITY_MANIFEST_STALE` finding documented in `PHASE7E_CLOSURE.md`**
  reproduced on this fresh checkout (Windows `core.autocrlf=true` converts
  the committed LF-only manifest to CRLF on checkout; the generator always
  writes LF). Regenerating restored a clean, byte-identical `--check`
  pass. Not a Phase 7F regression — a known, pre-existing environment
  quirk on this machine, now hit on three consecutive phases' fresh
  checkouts.
- `npm run phase7c:acceptance` (20 proof points, extended in this phase to
  enumerate the 3 new POST routes by name): all 20 pass, `mutations=408`.
- `npm run test:legacy-authority-adapters`: `legacyMutations=190`,
  `unresolved=0`.
- `npm run test:jarvis-voice` / `test:jarvis-voice-security`: 11/11, 38/38,
  16/16.
- `npm run jarvis-voice:evaluation`: 1255 scenarios, `routingCorrectness=1`,
  all leakage/bypass/secret/executed metrics = 0.
- `test:phase7c-legacy-mutation-scan` (extended to cover `voice/*.ts`):
  40/40 (37 adapters).

## Deploy-owned source snapshot

```
deployedSha: 83784fcdec86f2118d895297a60fbd391ab653e3
sourceSnapshotRoot: F:\Projects\D-root-mi-snapshots\mi-core-deployed-source\83784fcdec86f2118d895297a60fbd391ab653e3
fileCount: 809
treeChecksum: 22a57cc1faccf1cee352ba163a35f0895f0333c56af9b279e8a089d86cc40542
```

(797 files at Phase 7E; +12 for the new `jarvis-gateway/voice/` module and
its test files.)

## Predeploy backup

Online, verified SQLite backups, written to
`F:\Projects\mi-core-predeploy-backups\phase7f-2026-08-15T10-39-30-706Z\`:

| DB | integrity_check |
|---|---|
| tasks.db | ok |
| personal-os.db | ok |
| projects.db | ok |

**Rollback target**: the previous deployed SHA
`d4696755e9850a95835c32009d5c76b657e7bbbb` (Phase 7E) — its snapshot
remains intact at
`F:\Projects\D-root-mi-snapshots\mi-core-deployed-source\d4696755e9850a95835c32009d5c76b657e7bbbb\`.
No DB schema changed in Phase 7F — a code-only rollback needs no DB
restore.

## Deploy

`server/dist`/`command-center/dist` copied via `fs.cpSync` with file-count
verification: 682/682 (server), 5/5 (command-center). `.env`'s
`MI_DEPLOYED_SOURCE_SHA`/`_ROOT` updated to the new SHA/snapshot root.
Both `snapshot-manifest.json` and `authority-manifest.json` copied into
the production checkout's `server/` directory (the local copies
`probeProvenance()` actually reads, distinct from `.env`'s pointers) —
learned the hard way during Phase 7E's deploy, applied correctly on the
first pass this time, no provenance mismatch occurred.

## Restart

Only `mi-core` restarted, via `pm2 restart mi-core --update-env`.
`mi-accounting`, `mi-ai-service`, `mi-node-agent`, `qb-ops-agent`,
`pm2-logrotate` untouched (confirmed via `pm2 list` before/after — same
PIDs/uptimes for every other app). Boot log clean: no errors related to
this phase's new code; the only alerts are the same pre-existing SelfHeal
WhatsApp-Gateway/CEO-Observer/Ollama restart-and-alert cycle documented in
every prior phase's closure.

## Production-safe acceptance — real requests, real project data, zero side effects

Live `GET /api/health/detail` post-restart: `overall: DEGRADED` (the
standing baseline — `LOCAL_MODEL` unavailable, matching every prior
closure) — `CORE`, `DATABASE`, `AUTHORITY` all `HEALTHY` (provenance
folded into `AUTHORITY`; no `PROVENANCE_MISMATCH`). The two new
dependencies report correctly and do not affect `overall` beyond the
existing `DEGRADED` baseline:

```
VOICE_INPUT:  UNAVAILABLE, OPTIONAL_DEGRADED, reasonCode=MODEL_UNAVAILABLE
              ("Speech-to-text is not available in this runtime")
VOICE_OUTPUT: UNAVAILABLE, OPTIONAL_DEGRADED, reasonCode=MODEL_UNAVAILABLE
              ("set VOICE_TTS_ENABLED=1 to enable")
```

This is the expected, honest state for this runtime (no faster-whisper/
edge-tts environment configured here) and is exactly the acceptance
criterion for §25-28: new voice dependencies never force `UNAVAILABLE`/
`BLOCKED` — confirmed live, not just in tests.

Live `POST /api/jarvis/voice/transcript` (`"yes, approve it"`): returned
`safetyLabel: "SAFE"`, `gatewayResponse: null`,
`spokenText: "Approval is still required in Command Center. Voice
confirmation is never treated as canonical approval — please review and
approve in the Actions page."` — confirms the confirmation-boundary is
live and correct in production, including the directive's own example
phrase.

Live `POST /api/jarvis/voice/transcript` (`"press the login button"`):
returned `safetyLabel: "FORBIDDEN_BROWSER_WRITE"`, `gatewayResponse: null`
— confirms the exact regex gap found by independent review and fixed
before merge is live and correct in production, not just passing in
tests.

### Real counts, before vs. after the entire deploy + verification flow

| Metric | Before | After |
|---|---|---|
| `task-runtime/tasks` count | 27 | 27 |
| Authority `mutations` | 402 | 408 (+6 = 3 new POST routes × 2 dual-mount points each) |
| Authority `unknownMutations` | 0 | 0 |
| Authority `unresolvedLegacyMutations` | 0 | 0 |

The `mutations` increase is expected and documented — the 3 new voice
routes are classified `CANONICAL_LOCAL_MUTATION`/`LOCAL_REVERSIBLE`, the
same classification Phase 7C's own `POST /jarvis/request` established for
an analogous local-only, non-external-authority route. Zero real external
side effects from the entire deploy/restart/verification sequence — the
`tasks` count (the one runtime data table exercised by the acceptance
checks) is unchanged.

## DB / log / provenance audit

- Post-deploy DB integrity (online, non-disruptive), all three production
  databases: `integrity_check=ok`.
- Logs since restart scanned for new errors: only the same pre-existing,
  already-documented (Phase 7B–7E closures) SelfHeal WhatsApp-Gateway/
  CEO-Observer/Ollama restart-and-alert cycle and config warnings (`MI_PIN`
  unset, `CEO_WHATSAPP_ALLOWED_NUMBERS` not configured, MinIO
  unavailable) — none introduced or worsened by this phase. **Zero Phase
  7F-related errors found** in the logs.
- Provenance chain verified consistent end to end: `.env`'s
  `MI_DEPLOYED_SOURCE_SHA` = deploy-owned snapshot's `deployedSha` =
  production's local `server/snapshot-manifest.json` `deployedSha` = the
  actual PR #109 merge commit = the authority manifest copied into
  production = the live server's own `AUTHORITY:HEALTHY` (no
  `PROVENANCE_MISMATCH`).

## Freeze

**PHASE 7F GRANTS VOICE NO NEW AUTHORITY.** Voice is proven — by 65
core+security scenarios, 1255 evaluation scenarios (`routingCorrectness=1`,
all leakage/bypass/secret/executed metrics = 0), 40 legacy-mutation-scan
scenarios, 66 Command Center unit/a11y/security scenarios, and 2 full E2E
runs against the real compiled server — to never let a spoken phrase stand
in for canonical approval, never reach a forbidden action, never leak
across projects/sessions, never leak a secret via TTS, and never mark the
system down when the optional STT/TTS environment is absent. The governed
external action set, Phase 7A's containment, Phase 7B's health-truth
model, Phase 7C's legacy-mutation-scan gate, and Phase 7D's SessionStore
boundary all remain fully intact — re-verified clean in this exact closure
run, both pre-merge (fresh worktree) and live in production post-deploy.

Per the governing master program: Phase 7F is merged, deployed,
production-verified against real (not forced) reality — including two
genuine review-found regex gaps fixed before merge, one of which was only
fully caught by re-running the new regression-lock test on the fresh
merge-SHA checkout — documented, and frozen. Do not start Phase 7G until
this freeze is acknowledged; a fresh reality audit is required before
defining 7G's scope, per the standing master program.
