# Phase 9 — Discovery / Reality Audit

**Status: read-only discovery. No code, schema, config, or authority changed. This document and its siblings are the entire output of this phase.**

## Methodology

Independently re-verified the stated Phase 8 baseline (Section 4 of the master directive) directly against git, production, and the DB/authority state — not trusted from the directive text. Then ran four parallel, independent research passes (governance core; task/knowledge/recovery/coding; external integrations; duplication/security/test-quality) covering the ~26 subsystems named in the directive, each required to cite `file:line` evidence and use VERIFIED/NOT_VERIFIED/PARTIALLY_VERIFIED/NOT_APPLICABLE labels rather than impressions. The four most consequential claims that surfaced — delegation disconnected from the live orchestration singleton, `GMAIL_SEND_DRAFT` structurally unreachable, the self-healing background worker's quarantine label not runtime-enforced, and the social/review-posting connector's no-approval-gate live write — were independently re-verified in this pass by direct `grep`/file reads before being written into any document, not taken on the research passes' word alone.

## Section 4 — Fresh reality audit

**Git**: branch `master`, local HEAD `c3c0debbc1986db8eb122e522db0d54e7c3cdc9b`, `origin/master` identical, working tree clean. Matches the directive's stated baseline exactly.

**Production**: `.env` → `MI_DEPLOYED_SOURCE_SHA=aab506bc818c1c4cf6ac5b0c2f2e45d4b4b8624a`; `server/snapshot-manifest.json` → same SHA, `fileCount: 825`. Matches.

**Runtime**: `mi-core` PID `15792`, sole `LISTENING` owner of port 4001, restart counter stable at `781` (unchanged since the Phase 8 incident remediation). `GET /api/health` → `{"server":"ok","python_ai_service":"ok","ollama":"down","overall":"DEGRADED"}` — Ollama remains down and untouched, as instructed; not started during this audit.

**Databases**: all 3 canonical DBs (`personal-os.db`, `tasks.db`, `projects.db`) — `integrity_check=ok`, 0 FK violations. Schema v10.

**Authority**: `npm run authority:manifest -- --check` → PASS. `unknownMutations=0`, `unresolvedLegacyMutations=0`, `total=1065` (unchanged from the Phase 8 closure record).

**No discrepancies found. No STOP condition triggered by this section.**

## Section 29 — Discovery regression gates

All run against the unmodified clean master (no source touched by this phase):

- `rm -rf dist && npx tsc` — zero errors.
- `test:tracked-credential-scan` — PASS.
- `test:ssrf-policy` (506 cases) — PASS, `unsafeTargetAllowed=0`.
- `test:phase8a-security` — PASS, `unsafeTargetAllowed=0`, `browserWriteReachable=0`, `financialExecutionReachable=0`, `legacyMutationBypass=0`, `unknownMutations=0`, `unresolvedLegacyMutations=0`.
- `phase8a:acceptance`, `phase8b:acceptance`, `phase7a:acceptance`, `phase7b:acceptance`, `phase7c:acceptance`, `phase7g:acceptance` — all exit 0.
- `test:ci` (full suite) — exit 0, zero real failures. Run twice across this session; the known timing-sensitive `cancel-race-regression.test.ts` self-check passed cleanly both times in this phase (see Section 20 below for its general classification, independent of this specific clean run).
- `authority:manifest -- --check` — PASS (re-run post-research, unchanged).

No `git diff --check`/conflict-marker/secret-pattern scan was needed at this point since no files were modified yet; these are re-run against the actual PR diff before it's opened (Section 30).

## Section 19 — Security review summary

Full per-file inventory is in `PHASE9_CAPABILITY_AND_AUTHORITY_MAP.md`. Headline findings, each independently verified in this pass:

1. **No live git push/PR-create/merge/deploy capability exists anywhere in `server/src`.** Confirmed by two independent research passes plus a direct repo-wide grep for `git push`, `octokit`, `createPullRequest`, `gh pr create/merge` — the only matches are inside tests asserting the *absence* of these capabilities (`coding/__tests__/agentic-coding.test.ts:429-441`, `jarvis-gateway/__tests__/phase7g-legacy-authority-scan.test.ts:99-124`). VERIFIED.

2. **`GMAIL_SEND_DRAFT` is structurally unreachable, not merely policy-denied.** `personal-os/actions/service.ts:641-643` throws unconditionally inside `normalizePayload()`, before a proposal object can exist — independently confirmed by direct read in this pass. A default policy rule additionally DENYs it (`governance/schema.ts:154-157`) as defense-in-depth. Three legacy send-capable functions exist (`actions/google-executor.ts`, `actions/gmail-action-adapter.ts`) but have zero callers and their only importer (`routes/actions.ts`) is never mounted in `index.ts`.

3. **No Drive `ActionType` exists at all** (independently confirmed: `grep -n DRIVE server/src/personal-os/actions/types.ts` → no match). All Drive code (`actions/drive-action-adapter.ts`, parts of `actions/google-executor.ts`) is dead — zero callers, same unmounted-route situation as Gmail send. Drive has zero live capability, read or write, from `server/src`.

4. **No desktop-control capability exists.** Grep for `robotjs`/`nut.js`/`xdotool`/`SendInput`/input-injection patterns returns only two files, both test/red-team-evaluation files that reference these terms as things to *scan for and forbid*.

5. **`coo-v4/agents/browser-operator.ts`'s `navigate()` is a live, un-SSRF-audited outbound-navigation surface**, distinct from the audited `/api/browser/extract` path — independently confirmed: `grep -n "validateTargetUrl\|page.goto" coo-v4/agents/browser-operator.ts` shows multiple `page.goto()` calls and zero `validateTargetUrl` calls in the file. Reachable via `POST /api/coo-v4` (`requireTaskRuntimeAuth`). Effect is read-only today (returns only `title`/`url`), but the SSRF gate genuinely does not cover it. This is a real containment gap, not a STOP condition (no write capability, no credential exposure demonstrated) — flagged for a future hardening phase.

6. **The self-healing background worker's `QUARANTINED` classification is not runtime-enforced for background workers — independently verified, most significant finding of this audit.** `authority-manifest.json`'s `background:self-healing-monitor` entry declares `authorityClass: LEGACY_QUARANTINED`, `status: QUARANTINED`, `approvalRequired: true`, `governanceRequired: true`, `quarantineHandler: legacyAuthorityAdapter.quarantine`. But:
   - `company-os/self-healing-monitor.ts` contains **zero** references to `legacy-adapter` or `quarantine` anywhere in the file — confirmed by direct grep.
   - `index.ts:549-550` calls `startSelfHealingScheduler(5)` / `startSelfHealingMonitor(60_000)` **unconditionally at boot**, with no authority check gating the call.
   - The only authority-plane function `index.ts` actually calls is `validateLegacyAuthorityRuntime` (`index.ts:144`) — read in full at `authority-control-plane/legacy-adapter.ts:245-257`: it is a **manifest self-consistency check** (throws only if a quarantined surface *lacks a declared handler name*, an adapted surface lacks a target, etc.) — it never inspects or blocks the actual background-worker code path.
   - The real `quarantine()` method (`legacy-adapter.ts:138`, returns a 409 via `respondWithLegacyResult(res: Response, ...)`) is architecturally an Express-route responder — it has no mechanism to intercept a `setInterval` callback, because there is no HTTP request/response cycle to intervene on.
   - **Net effect**: `company-os/self-healing-monitor.ts:196`'s `execAsync(\`pm2 restart ${svc.pm2_name}\`)` — a real, live, autonomous service-restart capability, running every 60 seconds, for any of ~5 monitored PM2 services including `mi-core` itself — runs completely unimpeded by the "QUARANTINED" label. The label is accurate as *documentation of intent* (this surface is meant to be migrated to the canonical Authority Control Plane) but is **not actually enforced** for this specific `BACKGROUND`-kind surface.
   - **This is not new behavior.** This exact code has been running, and has been directly observed restarting `mi-core`, throughout this entire multi-week engagement (most visibly during the Phase 8 post-closure PM2 incident). It predates Phase 9 and predates the frozen Phase 8 program. It does **not** meet the STOP-condition bar for "a new live mutation path bypassing canonical governance" (nothing new was introduced), but it is a genuine manifest-vs-enforcement drift in the security classification itself, worth surfacing prominently rather than passing over.
   - Scope is narrow: only PM2-managed `pm2 restart` on a fixed, hardcoded 5-service allowlist, capped at `MAX_AUTO_RESTART=2` per service before escalating to a human alert. It cannot kill an arbitrary process, cannot restart non-PM2 services, and cannot touch anything outside that fixed list.

7. **Live, real external-write surface with authentication but no approval gate**: `POST /api/connectors/social/post` and `POST /api/connectors/reviews/post` (`routes/connectors.ts`, mounted behind `requireTaskRuntimeAuth` at `index.ts:368`) call `broadcastPost()` (`connectors/social-posting.ts`), which performs real HTTPS POSTs to the Facebook Graph API and Google Business Profile. Independently confirmed via `authority-manifest.json`: both routes are `ADAPTER_TO_CANONICAL`, `approvalRequired: false`, `status: ADAPTED` — this is a deliberate, already-classified design choice in the manifest (not an unclassified gap), but it means a valid API key holder can synchronously publish to the business's live social presence with no human-in-the-loop step. Worth the record explicitly rather than assuming "adapted" implies "approval-gated."

8. **One latent, currently-unreachable command-injection shape**: `company-os/tool-registry.ts`'s `git` tool builds `` `git -C "${repo}" ${cmd}` `` via `execSync` from unsanitized `args.repo`/`args.cmd`. Its only current caller (`company-os/department-runtime.ts:45`) never supplies these fields, so it always falls back to a fixed `git status --short`. No live exploit path exists today; flagged because the function itself has no input validation and would become exploitable the moment any future caller forwards user input into `args.cmd`.

9. **A large legacy orchestration cluster (COO V4, GStack) is genuinely quarantined, not merely documented as such** — confirmed by a dedicated regression test (`__tests__/phase7c-legacy-containment.test.ts`) that monkey-patches `Module._load` to prove no in-process caller can even `require()` these modules, in addition to the HTTP-layer 409 block (`authority-control-plane/guard.ts`'s `legacyAuthorityBoundary`, registered before these routers mount). This is the correct pattern the self-healing worker (finding 6) should eventually be migrated to, per its own `migrationTarget: 'Authority Control Plane'`.

No SQL-injection-shaped construction was found beyond internally-defined schema-migration helpers (spot-checked, not exhaustive — flagged as a follow-up in the capability map doc). `shell: true` usage is limited to 2 CLI-only recovery scripts (`runtime-preflight/boot-cli.ts`, `recovery-cli.ts`), never HTTP-reachable.

## Section 20 — Test/CI quality summary

`server/src/coding/__tests__/cancel-race-regression.test.ts` is classified **TIMING_SENSITIVE**: its per-race safety assertion (every cancel race must end `CANCELLED`, never `COMPLETED`) is deterministic and has never produced a false result. Its separate aggregate self-check (`sequentialHits + concurrentHits > 0`, proving the calibrated delay window actually landed at least one race past the review/commit checkpoint) is a function of a single, un-repeated wall-clock calibration measurement and can fail on a noisy CI runner with zero code regression — exactly the behavior already observed once in the Phase 8 closure PR and not reproduced on immediate re-run, and reproduced with a clean pass in both `test:ci` runs performed in this phase. `coding/__tests__/coding-workflow.test.ts` has a documented history of the same underlying timing sensitivity (cross-referenced in the regression test's own docstring). Other sampled tests (`http-integration.test.ts`, `orchestration-concurrency.test.ts`, `registry-guard.test.ts`) are DETERMINISTIC (ephemeral ports, DB-level compare-and-swap, no sleeps); `async-execution.test.ts`, `self-healing-probe.test.ts`, `phase7g-boot-preflight.test.ts` are ENVIRONMENT_DEPENDENT (real spawns/sockets with generous but not runtime-calibrated margins) — not recommended for a fix in this phase, noted for a future hardening pass.

## Section 21 — Production/development drift

Docs master (`c3c0debbc1986db8eb122e522db0d54e7c3cdc9b` at the start of this phase) and production's functional deployed SHA (`aab506bc818c1c4cf6ac5b0c2f2e45d4b4b8624a`, Phase 8D) remain intentionally different — every phase since 8D (8E, 8F, 8G, and this Phase 9 discovery) has been docs-only, so nothing has required redeployment. `snapshot-manifest.json` and `.env` provenance markers agree with each other and with the PM2/runtime state. No unexplained drift. **This phase does not deploy anything and does not change that gap.**

## Section 22 — Data/privacy boundaries (spot check)

`personal-os/documents/path-policy.ts` enforces an approved-root allowlist with symlink-resolution-before-containment-check and a denylist of credential/session file patterns (`.env`, `*.pem`, `id_rsa*`, `.git`, etc.) — genuinely defense-in-depth, not just documented intent. `personal-os/documents/router.ts` refuses any query without a resolved project scope and caps cross-project queries at 5 project IDs. No project ID, real file content, or credential value is reproduced anywhere in this document or its siblings — only structural evidence (file:line, counts, classification labels).

## Section 23 — Operator experience (spot check)

The `EvidenceService` (`evidence/service.ts`) is read-only (5 `GET` routes, no mutation method exists) and its `health()` computation is honest about what it cannot measure — `AUTHORITY_VIOLATIONS` and `SERVICE_HEALTH` dimensions are explicitly returned as `UNKNOWN` rather than fabricated. Every governance-relevant "proactive" signal found across the whole audit (budget exhaustion, kill-switch state, policy drift, approval-waiting count, delegation expiry, legacy-quarantine count) is **pull-based** — computed fresh on a `GET` request to `/evidence/health` or `/operator/*` — not push/scheduled. The one exception is `DelegationService`'s policy-drift auto-pause, which is a genuine automatic state *change* (pausing a delegation) triggered as a side effect of being read, with no proactive notification to the operator beyond that state becoming visible on the next poll. No code path anywhere in the governance-relevant surfaces reaches an `EXECUTE`-classified proactive action.

## STOP-condition scan — result

None of the listed STOP conditions were triggered: `unknownMutations=0`, `unresolvedLegacyMutations=0`, DB integrity clean, no FK violations, no schema drift, no provenance drift, no active restart storm, single process on port 4001, `mi-core` available, no *new* live mutation path bypassing canonical governance, no unauthenticated external mutation surface, no financial mutation outside governance, no autonomous approval/merge/deploy path, no kill-switch/approval/budget/policy bypass, no tenant/project isolation failure, no `EXECUTED`-without-proof evidence. Finding 6 above (self-healing quarantine label not runtime-enforced) is the closest adjacent concern but is pre-existing, not new, and does not itself constitute an unauthenticated or ungoverned *external* mutation — it is scoped to internal PM2-service restarts on a fixed allowlist. Reported here in full rather than silently normalized; no STOP was declared.
