# Phase 7G — Acceptance

Date: 2026-08-17

`npm run phase7g:acceptance` — `server/src/jarvis-gateway/phase7g-acceptance.ts` —
proves the directive's 25 required points (§35). All 25 `PASS`.

| # | Point | Evidence |
|---|---|---|
| 1 | Final canonical owner map | `docs/architecture/PHASE7G_PROGRAM_AUDIT.md` |
| 2 | Zero unknown authority | `unknownMutations=0` |
| 3 | Zero unresolved legacy authority | `unresolvedLegacyMutations=0` |
| 4 | Knowledge path canonical | `handlers/knowledge-search.ts`, real citations (journey A) |
| 5 | Project isolation | red-team `crossProjectLeakage=0` (15 scenarios) + Phase 7E E2E |
| 6 | Session isolation | red-team `crossSessionLeakage=0` + Phase 7D suites (19/19, 36/36) |
| 7 | Restart persistence | `controlled-actions-restart.test.ts` (Phase 5F, re-run clean) |
| 8 | Ephemeral session reset | `phase7d-jarvis-session.test.ts` restart block |
| 9 | Simulation/live separation | `handlers/simulation.ts` never imports `ControlledActionService` |
| 10 | Approval/execution separation | `handlers/action-proposal.ts` never calls `.propose()`/`.approve()`/`.execute()` |
| 11 | Voice/approval separation | `voice/confirmation-boundary.ts`; red-team `approvalByVoice=0` (150 scenarios) |
| 12 | Health truth | `health-truth/aggregate.ts` single canonical model, live-verified |
| 13 | Dependency degradation | `OPTIONAL_DEGRADED` deps never force `UNAVAILABLE`/`BLOCKED` |
| 14 | Provenance | `phase7g-manifest-crlf.test.ts` (4/4); fail-closed when markers absent |
| 15 | DB integrity | 3 production DBs `integrity_check=ok`, 0 FK violations; disposable-copy corruption test |
| 16 | Legacy containment | `legacyMutations=190`, `unresolvedLegacyMutations=0`; broadened scan 50/50 |
| 17 | Gmail SEND absent | zero live callers to `executeGmailSend()`/`sendEmail()`; `routes/actions.ts` unmounted; no `gmail_send` case arm |
| 18 | Financial authority absent | zero money-movement function names in source; zero "accounting" references in Gateway/voice |
| 19 | Coding read-only boundary | `handlers/coding.ts` never imports `CodingWorkflow`/calls `planTask()` |
| 20 | 1500-case red team | 1500 scenarios, all 9 required metrics = 0, determinism=100% |
| 21 | E2E certification | full 8-test suite run twice, 8/8 both times, including the new "Phase 7G §21" chained journey |
| 22 | Resource-bound test | `test:phase7g-session-bounds` — 1500 sessions vs `MAX_SESSIONS=1000`, bound held |
| 23 | Failure injection | `test:phase7g-failure-semantics` (3/3) + `test:phase7g-boot-preflight` (4/4) |
| 24 | Performance recorded | `docs/operations/PHASE7G_PRODUCTION_RUNBOOK.md` — 11 endpoint categories + concurrency + leak proxy |
| 25 | Full regression | `test:ci` (30 suites), 18 phase acceptance scripts, all Gateway/session/voice suites, CC vitest (866/866), E2E (8/8 ×2) |

## New test/tooling files this phase

- `server/src/jarvis-gateway/__tests__/phase7g-legacy-authority-scan.test.ts` (50/50)
- `server/src/jarvis-gateway/__tests__/phase7g-failure-semantics.test.ts` (3/3)
- `server/src/jarvis-gateway/__tests__/phase7g-session-bounds.test.ts` (1/1)
- `server/src/operations/boot-preflight.ts` + `__tests__/phase7g-boot-preflight.test.ts` (4/4)
- `server/src/authority-control-plane/__tests__/phase7g-manifest-crlf.test.ts` (4/4)
- `server/src/jarvis-gateway/phase7g-certification-evaluation.ts` (18/18 — journeys A-H)
- `server/src/jarvis-gateway/phase7g-red-team-evaluation.ts` (1500 scenarios)
- `server/src/jarvis-gateway/phase7g-acceptance.ts` (this doc's 25 points)
- `command-center/e2e/command-center.spec.ts` — new "Phase 7G §21" test
- `command-center/e2e/phase7g-performance.cjs`

## One safe production code change this phase

`server/src/authority-control-plane/generate-manifest.ts` — CRLF
canonicalization fix for the recurring `AUTHORITY_MANIFEST_STALE` false
positive (§16), regression-locked, does not weaken real content-drift
detection.

## Deliberately not fixed (documented, not silently patched)

- Windows Startup-folder `Mi-Ultimate.vbs` stale `D:` path (dead but
  harmless — the working `pm2 resurrect` boot path is independent).
- SelfHeal's alert classification not wired to canonical health-truth
  (observability quality gap, not a security issue).
- SelfHeal's unconditional "Restarted" log line (misleading-log issue).

Both are real findings from this phase's own audit, recorded in
`docs/operations/PHASE7G_PRODUCTION_RUNBOOK.md` rather than fixed inline —
each is a behavior change to a live monitoring/boot system with its own
blast radius, out of proportion to a certification phase's scope per the
directive's own no-opportunistic-fix boundary.
