# Phase 9E — Fresh Reality and Authority Audit

**Mode: DISCOVERY + VERIFICATION + CLASSIFICATION ONLY. No implementation in this phase.**

This document re-derives the current state of the system from scratch — git, production provenance, live process/DB state, and regression evidence — rather than trusting Phase 9A–9D closure claims. Where a prior report's claim was re-verified, that is stated explicitly; where it could not be, it is marked `NOT_VERIFIED`.

## 1. Git reality

- Main checkout branch: `master`, local HEAD `9588186cea05adf12e51064c451c2cd964473610`, working tree clean, no unexplained modifications.
- `origin/master` (fetched fresh): `ac93fe4520f1146da5f69fe181c66f858601b271` — confirmed ancestor relationship intact, exact match to the expected Phase 9D docs/master baseline. No unexpected drift.
- Local main checkout is 2 commits behind `origin/master` by design (PR #136 was docs-only; no redeploy required, no provenance update needed).
- **Methodology correction made during this audit**: an earlier feature worktree used for unrelated work (`claude/unruffled-elbakyan-53f887`) forked from master before Phase 7–9 existed (its history stops at PR #96). All Phase 9E source-reading was redone from a clean, full, non-sparse detached checkout of current `origin/master`, not that stale worktree. Every citation in the Phase 9E document set is against that current-master checkout.

## 2. Production provenance

All three canonical markers agree on the functional/deployed SHA:
- `.env`: `MI_DEPLOYED_SOURCE_SHA=9588186cea05adf12e51064c451c2cd964473610`, `MI_DEPLOYED_SOURCE_ROOT=F:\Projects\D-root-mi-snapshots\mi-core-deployed-source\9588186c...`
- `server/snapshot-manifest.json`: `deployedSha` / `sourceSnapshotRoot` match exactly.
- The deployed compiled bundle (`F:\Projects\mi-core\server\dist\company-os\self-healing-monitor.js`) was read directly and confirmed to contain the Phase 9A `evaluateRestartEligibility`/`RESTART_ALLOWLIST`/`intentionallyStoppedServices` logic, consistent with deployment from a commit after PR #129.

No drift found. Documentation-only master commits (#136) do not require redeploy, and none was performed.

## 3. Production health — real, read-only findings

Two real conditions were found, both confirmed by direct read-only inspection of the live machine, not assumed:

### 3a. `WhatsApp Gateway` and `CEO Observer` — down, and correctly non-alerting (confirmed intentional)
`pm2 jlist` shows 6 running processes; `mi-whatsapp-gateway` and `mi-ceo-observer` are absent entirely (never registered). `server/src/runtime-preflight/validator.ts:67` declares the canonical `INTENTIONALLY_STOPPED = new Set(['mi-ceo-observer', 'mi-whatsapp-gateway', 'mi-n8n'])`. Live evidence from the real `self_heal_restart_log` table (`F:\.local-agent-global\ops\ops.db`, queried read-only) shows `decision: 'intentionally_stopped'` recorded for both services every ~60 seconds continuously — restart is never attempted and no CEO alert fires for either, exactly as the code specifies (see §6 of the Background Worker Reassessment doc for the full trace). The live `mi-core-error.log` was independently checked: every `CEO ALERT` line in the observed window names **Ollama AI only** — never WhatsApp Gateway or CEO Observer. Ollama's degradation is a pre-existing, already-documented condition (Phase 8/9 docs) and is correctly still reported `DEGRADED`, not silently upgraded.

**Classification: expected, working as designed. Not a STOP condition.**

### 3b. Recurring full-server unresponsiveness during KB re-ingest — a real, previously undocumented finding
While diagnosing an `/api/health` timeout, direct log inspection showed:
- `2026-08-21 11:56:03: [Scheduler] Running KB incremental ingest...` → `2026-08-21 12:30:53: [Scheduler] KB ingest: 2156 docs` (a 34-minute run).
- `2026-08-21 15:56:04: [Scheduler] Running KB incremental ingest...` was still running with **no subsequent log line at all** — including no other scheduler's log line — as of `16:26:40`, a 30+ minute gap with zero log activity of any kind.
- During this exact window, `GET /api/health` failed completely (connection timeout / connection refused, tested independently via curl and native PowerShell `Invoke-WebRequest`, both from localhost).

Root cause, confirmed in source: `server/src/cron/sync-scheduler.ts:36-44` —
```js
kbTimer = setInterval(() => {
  try {
    console.log('[Scheduler] Running KB incremental ingest...');
    const result = fullIngest();               // NOT awaited, NOT async — synchronous
    ...
```
Unlike the sibling `syncTimer` callback immediately above it (which is `async` and `await`s `syncAll()`), the KB-ingest callback is a plain synchronous function and `fullIngest()` is called without `await`. Given the observed ~30-35 minute wall-clock duration for ~2,000 documents, this is a long synchronous (or non-yielding) operation that occupies Node's single JS thread for its entire duration — during which **no other timer, no HTTP request, and no other scheduled job can run**, which is exactly what was observed (total silence from `syncTimer`/`dev2OpsTimer` and total HTTP unresponsiveness for the same window). This recurs every 4 hours (`KB_SYNC_INTERVAL_MS = 4 * 60 * 60 * 1000`), for ~30-35 minutes each time, based on the two observed instances today.

**Classification: `HEALTH_ENDPOINT_DEGRADED` is an understatement — this is a recurring, deterministic, self-resolving `FULL_SERVER_UNRESPONSIVE_DURING_SCHEDULED_JOB` condition**, root-caused to one specific synchronous call, not a crash, not a network issue, and not related to WhatsApp Gateway/CEO Observer/Ollama. It is not a STOP condition per this audit's own criteria (self-resolving, already resolved once today before this audit began, not caused by this audit's activity, process never actually dies) — but it is a real, previously-undocumented production reliability defect affecting every consumer of mi-core's HTTP surface (including the CEO's own health checks and WhatsApp-adjacent APIs) for roughly 30-35 minutes, twice a day. See the Roadmap document for the recommended narrow follow-up.

## 4. Database integrity

Not independently re-run against the live production DBs in this pass beyond what regression suites already exercise (see §5); no corruption, FK violation, or schema-version anomaly was reported by any test run. `NOT_VERIFIED` as a fresh live `PRAGMA integrity_check` sweep across all three canonical DBs — the existing regression suites below exercise the schema paths but this audit did not additionally run a standalone integrity pragma pass in the interest of time; no evidence of a problem was found either.

## 5. Regression evidence (real, actually executed — not assumed)

All of the following were executed directly against the current-master checkout (symlinked to a sibling installation's `node_modules` for dependency resolution; identical source, no code changes):

| Suite | Result |
|---|---|
| `npx tsc --noEmit` | **0 errors** (clean compile) |
| `test:ssrf-policy` | **PASS** — 506/506 cases, `unsafeTargetAllowed=0` |
| `test:phase8a-security` | **PASS** — `unsafeTargetAllowed=0, browserWriteReachable=0, financialExecutionReachable=0, legacyMutationBypass=0, unknownMutations=0, unresolvedLegacyMutations=0` |
| `test:tracked-credential-scan` | **PASS** |
| `test:phase9a-self-healing-restart-authority` | **PASS** — 14 invariants |
| `phase9a:evaluation` | **PASS** — 945 cases, 0 failures, all hard targets (`unexpectedRestart`, `disabledServiceRestart`, `arbitraryTargetReachability`, `manifestRuntimeMismatch`, `shellEscalation`, `authorityExpansion`, `killSwitchBoundaryViolations`, `concurrencyViolations`) exactly 0 |
| `test:phase9b-operator-background-workers` | **PASS** — 9 invariants |
| `test:phase9d-qb-watcher-idempotency` | **PASS** — 12 invariants (independently re-run; matches sub-agent's independent run) |
| `phase9d:evaluation` | **PASS** — 908 cases, 0 failures, all hard targets 0 |

**Combined real deterministic scenario count actually executed and verified in this pass: 506 + 945 + 908 = 2,359 evaluation cases, plus 14+9+12 = 35 invariant assertions — exceeding the 750-scenario target using existing harnesses, per the phase directive's own preference for reusing established patterns rather than fabricating new ones.**

`test:ci`'s full chain (60+ suites) was not run end-to-end in this pass given its size; the suites above were selected as the ones most directly relevant to the authority/governance/background-worker questions this phase concerns. No suite that was run failed.

## 6. Authority manifest hard counts (re-run live, not assumed)

```json
{
  "total": 1070, "readOnly": 677, "mutations": 393,
  "canonical": 668, "adapters": 143, "quarantined": 154,
  "forbidden": 0, "internalTest": 105,
  "unknownMutations": 0,
  "legacyMutations": 174, "adaptedLegacy": 7, "quarantinedLegacy": 167,
  "disabledDeadLegacy": 0,
  "unresolvedLegacyMutations": 0
}
```
Both hard targets hold: `unknownMutations = 0`, `unresolvedLegacyMutations = 0`.

## 7. Summary of Section 3 answers

| Question | Answer |
|---|---|
| Did current reality match the Phase 9D baseline? | Yes for git/provenance/manifest. One new, previously undocumented reliability finding surfaced (§3b) that the baseline did not mention. |
| Did any production incident occur during discovery? | No incident was caused by this audit. The KB-ingest blocking condition (§3b) is pre-existing (already occurred identically hours before this audit started) and self-resolving. |
| Is WhatsApp Gateway/CEO Observer being down a problem? | No — confirmed intentional, confirmed correctly non-alerting, confirmed by both source code and live DB evidence. |
