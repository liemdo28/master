# Phase 7G — Program Audit: Canonical Owner Map

Date: 2026-08-17 (fresh reality audit, read-only, no production mutation)

This is a certification document, not a rediscovery. It consolidates the
canonical-ownership decisions each of Phase 7A–7F already made and reasoned
about at length, cross-checks them against the current merged source tree
at `f096e5ca34599a8798ac7ab5c2dca699e8124413`, and explicitly classifies
every duplicate mutation-capable path found along the way rather than
silently ignoring or removing it.

## Baseline verified fresh (Section 1)

| Check | Result |
|---|---|
| `origin/master` | `f096e5ca34599a8798ac7ab5c2dca699e8124413` (matches directive) |
| Working tree | clean, up to date with origin |
| PR #109 (7F functional) | MERGED at `83784fcdec86f2118d895297a60fbd391ab653e3` |
| PR #110 (7F closure) | MERGED at `f096e5ca34599a8798ac7ab5c2dca699e8124413` |
| `.env` `MI_DEPLOYED_SOURCE_SHA` | `83784fcdec86f2118d895297a60fbd391ab653e3` |
| `server/snapshot-manifest.json` (local, production) | `deployedSha: 83784fcd...`, `fileCount: 809` — matches `.env` |
| PM2 fleet | `mi-core`, `mi-ai-service`, `mi-accounting`, `qb-ops-agent`, `mi-node-agent`, `pm2-logrotate` — all `online`, no crash loops |
| Ports | `4001` → `mi-core` (sole owner), `4002` → `mi-ai-service` (sole owner) — no collision |
| `GET /api/health/detail` | `overall: DEGRADED` — `CORE`/`DATABASE`/`AUTHORITY` all `HEALTHY`; `VOICE_INPUT`/`VOICE_OUTPUT`/`LOCAL_MODEL` `UNAVAILABLE`/`OPTIONAL_DEGRADED` (matches directive's stated baseline exactly) |
| `GET /api/authority/status` | `mutations: 408`, `unknownMutations: 0`, `unresolvedLegacyMutations: 0` (matches directive exactly) |
| `personal-os.db` / `tasks.db` / `projects.db` | `integrity_check: ok`, `foreign_key_check: 0` violations, all three |
| Personal OS schema | max applied `schema_migrations.version = 10` — no v11 |

## Canonical owner map

One row per responsibility area from the directive. "Owner" is the single
file/module that may perform or authorize the real effect; everything else
in that row either reads from the owner or is explicitly classified as
non-authoritative.

| Responsibility | Canonical owner | Notes |
|---|---|---|
| AUTH | `server/src/index.ts` (`requireRemoteAuth`/`requireTaskRuntimeAuth` gate functions) + `server/src/routes/auth.ts` (PIN login, Google OAuth) | Every mutating/detailed route is dual-mounted through one of these two gates; no route bypasses both. |
| JARVIS ENTRYPOINT | `server/src/jarvis-gateway/gateway.ts` (`handleGatewayRequest()`) | The **sole** function that turns a request into a classified, routed response. Voice (`voice-gateway.ts`) and every handler call into this one function — none re-implement routing. |
| SESSION | `server/src/jarvis-gateway/session-store.ts` + `session-resolver.ts` | Phase 7D `SessionStore` — in-memory, TTL-bound, explicit-always-wins. No second session store exists anywhere in the Gateway path. |
| PROJECT RESOLUTION | `server/src/jarvis-gateway/project-resolver.ts` | Single resolution order (explicit → session → ambiguous-clarify) reused by every handler and by voice. |
| KNOWLEDGE | `server/src/jarvis-gateway/handlers/knowledge-search.ts` (read path) over `server/src/personal-os/documents/*` (the underlying document/citation store) | Read-only from the Gateway's perspective; the documents store's own write paths are Command-Center-authenticated, not Gateway-reachable. |
| TASKS | `server/src/routes/task-runtime.ts` (`taskRuntimeRouter`, canonical CRUD) — `jarvis-gateway/handlers/task-query.ts` is a read-only view over the same store | One task store, one writer surface. |
| PROJECTS | `server/src/routes/projects.ts` (`projectsRouter`) — `jarvis-gateway/handlers/project-query.ts` is read-only | Same pattern as TASKS. |
| GOALS | `server/src/jarvis-gateway/handlers/goal-query.ts` | Read-only query over the existing goal store; no Gateway-reachable goal-mutation path. |
| PLANNING | `server/src/jarvis-gateway/handlers/planning.ts` | Produces a plan **preview** only — never calls an execution method. |
| SIMULATION | `server/src/jarvis-gateway/handlers/simulation.ts` over the Phase 6F digital-twin simulator (`automationSimulationRouter`) | Simulation-only; structurally cannot reach live execution (verified in 6F/7C/7E acceptance). |
| CONTROLLED ACTION | `server/src/personal-os/actions/service.ts` (`ControlledActionService`) + `server/src/personal-os/actions/router.ts` (`controlledActionsRouter`) | The **only** subsystem in the codebase that can perform `GMAIL_CREATE_DRAFT`/`CALENDAR_EVENT_PROPOSAL`/`CALENDAR_CREATE_EVENT`. |
| APPROVAL | `ControlledActionService.approve()` (`personal-os/actions/service.ts:198`) | Binds approval to an exact proposal ID, payload hash, action type, target, and expiry — this is the **only authoritative** approval path in the codebase. See "Duplicate owners" below for `approval/gate.ts`, which is NOT this. |
| POLICY | `server/src/personal-os/actions/policy.ts` + `server/src/personal-os/actions/governance/engine.ts` (`ActionPolicyEngine`) | Evaluated on every proposal and again on every approval (`service.ts:202`, `stage: 'approval'`) — policy is re-checked at approval time, not just at proposal time. |
| RISK | `server/src/personal-os/actions/governance/risk.ts` (`RiskEvaluator`) | Feeds the policy engine's decision; not a separate bypassable gate. |
| BUDGET | `server/src/personal-os/actions/governance/budget.ts` | Enforced inside the same governance engine call path as POLICY/RISK — no separate budget-check-optional path exists. |
| KILL SWITCH | `server/src/personal-os/actions/governance/kill-switch.ts` | Same governance engine call path; a tripped kill switch blocks at the policy-evaluation step shared by proposal and approval. |
| DELEGATION | `server/src/personal-os/delegation/service.ts` + `store.ts` + `eligibility.ts` | Delegated authority still resolves through `ControlledActionService` for the actual proposal/approval/execution — delegation only widens *who* may approve, never *what* can be approved outside the governed action set. |
| EVIDENCE | `server/src/evidence/router.ts` + `evidence/service.ts` | Every real action lifecycle event (`service.ts`'s `recordEvidence()` calls) writes here — this is the truth source the Operator Workspace's Evidence Inspector reads, never a separate log. |
| HEALTH | `server/src/health-truth/aggregate.ts` (`getSystemHealth()`) + `probes.ts` | Phase 7B's single canonical health model; `public-router.ts` and `detail-router.ts` are two views over the same function, never two competing health computations. |
| VOICE | `server/src/jarvis-gateway/voice/voice-gateway.ts` (`handleVoiceRequest()`) | A thin modality wrapper that calls `handleGatewayRequest()` — not a second entrypoint, not a second router, not a second identity/authority path. |
| CODING | `server/src/coding/*` (`CodingWorkflow`, the real, git-worktree-mutating engine) | The Gateway's own `jarvis-gateway/handlers/coding.ts` is explicitly advisory-only — never calls `planTask()`/`.run()` (re-verified, Section 28 below). |
| OPERATOR UI | `command-center/src/routes/JarvisPage.tsx` + `command-center/src/components/jarvis/*` (Phase 7E Operator Workspace, Phase 7F `VoiceControls.tsx`) | A read-model composition layer over the routers above — introduces zero backend routes of its own beyond what 7C/7D/7F already added. |
| DEPLOYMENT PROVENANCE | `server/src/authority-control-plane/source-provenance.ts` + `build-snapshot-cli.ts` + `generate-manifest.ts` | Produces the deploy-owned snapshot and the two manifests (`snapshot-manifest.json`, `authority-manifest.json`) that `probeProvenance()` compares against `.env`'s pointer. |

## Duplicate owners still capable of mutation — explicit classification

Per the directive: do not remove blindly, classify.

### `server/src/approval/gate.ts` — Level 1/2/3 approval queue

**Classification: LEGACY AUDIT/NOTIFICATION RECORD, NOT AUTHORITATIVE,
CONTAINED.**

This module predates the Phase 7 Gateway/Controlled-Action architecture.
Its own header docstring (present before this phase, re-verified unchanged
here) states the invariant explicitly: `approve()` only flips a row's
`status` column and emits an in-process event consumed solely by the
WebSocket broadcaster in `index.ts` for UI notification. It does not call
any provider, does not spawn a process, and does not send anything. The
one external caller that could reach `approve()` (`mi-whatsapp-gateway`)
was intentionally stopped as part of Phase 7A.3's containment and remains
stopped (re-verified live: `WHATSAPP: INTENTIONALLY_DISABLED` in the
current health snapshot above).

This module is **not** wired to `ControlledActionService`, does not gate
`GMAIL_CREATE_DRAFT`/`CALENDAR_EVENT_PROPOSAL`/`CALENDAR_CREATE_EVENT`, and
has no live HTTP-reachable path from any Gateway, voice, or Command Center
surface that results in a real external write. It is retained (not
deleted) because removing a working, harmless, pre-existing audit/status
queue is out of scope for a hardening phase per the directive's own
no-feature-work / no-opportunistic-fix boundary — it is fully contained,
not fully removed.

### 190 legacy mutation-shaped adapters (`legacyMutations: 190` in the authority manifest)

**Classification: already resolved by Phase 7A/7C's own scan —
`adaptedLegacy: 4`, `quarantinedLegacy: 186`, `unresolvedLegacyMutations: 0`.**

No new legacy mutation surface was introduced by 7D/7E/7F (re-verified:
`test:legacy-authority-adapters` — see Section 3 of this phase for the
broadened live-reachability re-scan, not just the manifest classification
count).

## Conclusion

Every responsibility area in the directive's list has exactly one
canonical, mutation-capable owner. The one duplicate found
(`approval/gate.ts`) is a pre-existing, already-contained,
non-authoritative audit record — not a live bypass of the real
`ControlledActionService` approval path. No new duplicate owner was
introduced by Phase 7A–7F.
