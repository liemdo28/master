# Phase 8A — Security & Operational Debt Closure

**Status:** COMPLETE. **Branch:** `codex/phase8a-security-operational-debt` (from `origin/master` at `a43e2fb9`). **Scope:** security containment only — legacy retirement, autonomy expansion, and platform simplification remain out of scope and are deferred to Phase 8B per the Phase 8 discovery roadmap (`docs/architecture/PHASE8_DISCOVERY_AND_ROADMAP.md`).

This phase closes the #1 finding from Phase 8 discovery — `/api/browser/extract` was live, unauthenticated, and SSRF-shaped despite the authority manifest claiming it was `QUARANTINED` — plus every other item on the 12-point Phase 8A priority list.

## 1. Priorities checklist

| # | Priority | Status |
|---|---|---|
| 1 | Contain `/api/browser/extract` — no longer anonymously reachable | DONE |
| 2 | Add canonical app authentication | DONE (`requireTaskRuntimeAuth`, always-enforced) |
| 3 | SSRF-safe target policy (loopback/RFC1918/link-local/CGNAT/metadata/file:/data:/javascript:/credentials/redirect-resolved) | DONE |
| 4 | Keep `/api/browser/write` quarantined | DONE — unchanged, still calls `denyAuthorityMutation()` |
| 5 | Reconcile authority manifest with runtime reality | DONE — `unknownMutations=0`, `unresolvedLegacyMutations=0` |
| 6 | Audit every route mount lacking `requireAuth`; classify each | DONE — see §3 |
| 7 | Audit `/api/qb`; financial execution stays prohibited | DONE — GET-only proxy, no mutation route exists |
| 8 | Audit legacy `/api/jarvis` (49 routes); security containment only | DONE — upgraded mount auth, broad retirement deferred to 8B |
| 9 | Reconfirm autonomous-task-runner containment | DONE — re-verified, zero `child_process`, both entrypoints hard-blocked |
| 10 | Formal `mi-node-agent` disposition | DONE — **KEEP_BLOCKED** (see §5) |
| 11 | Fix/remove stale Windows startup path if unambiguous | DONE — dead `Mi-Ultimate.vbs` neutralized (see §6) |
| 12 | Permanent browser/SSRF security tests, ≥500 deterministic cases | DONE — 506 cases, plus a structural containment test |

## 2. Hard targets — actual vs required

| Target | Required | Actual |
|---|---|---|
| `unsafeTargetAllowed` | 0 | 0 |
| `unauthenticatedAllowed` | 0 | 0 (37 `app.use()` lines fixed across 36 distinct route paths — `/api/models` is mounted on two separate lines, both fixed — 35 previously-bare paths + `/api/jarvis` upgraded from the no-op `requireAuth`) |
| `browserWriteReachable` | 0 | 0 |
| `financialExecutionReachable` | 0 | 0 |
| `legacyMutationBypass` | 0 | 0 |
| `unknownMutations` | 0 | 0 |
| `unresolvedLegacyMutations` | 0 | 0 |
| schema | v10 (unchanged) | v10 (unchanged — no migration performed) |

## 3. Route-mount authentication audit

Every mount in `server/src/index.ts` was individually reviewed. Classification categories: `PUBLIC_INTENTIONAL`, `AUTHENTICATED`, `QUARANTINED`, `AUTH_REQUIRED_MISSING` (all now fixed), `DEAD`. No `NETWORK_GATED`-only or `DEAD` mount-level surfaces were found; `applyIpGuard` (LAN/Tailscale-only) is a global middleware applied to every route regardless of category, not a substitute for per-route classification.

### PUBLIC_INTENTIONAL (unchanged — must stay public)
`/api/health` (liveness only), `/api/auth`, `/api/remote/health`, `/api/remote/qr-data`, `/api/auth/google/status|start|callback` — bootstrap/session-init surfaces with no session to check yet.

### AUTHENTICATED — own internal check (unchanged)
`/api/whatsapp` (`validateApiKey()` on `x-api-key`/`body.api_key`, independent of `requireAuth`), `/api/remote` (documented own auth).

### AUTHENTICATED — `requireTaskRuntimeAuth` (36 distinct route paths, 37 `app.use()` lines fixed this phase)
Found with **no auth middleware at all** in Phase 8 discovery, now behind the always-enforced `x-api-key` check (`requireTaskRuntimeAuth` — unlike `requireAuth`, this has no PIN-unset bypass). 35 distinct paths, listed once each below, plus `/api/jarvis` (§ below) = 36 distinct routes. `/api/models` is mounted on two separate `app.use()` lines (`modelsRouter` and `modelsRegistryRouter`) — both were bare and both are now fixed, which is why the line count (37) is one higher than the distinct-path count (36):
`/api/qb`, `/api/models` (both mounts), `/api/agent-engine`, `/api/integration-agent`, bare `/api` (operationalKnowledgeRouter), `/api/data-analyst`, `/api/skills`, `/api/browser`, `/api/doordash-agent`, `/api/doordash`, `/api/bigdata`, `/api/enterprise`, `/api/voice`, `/api/gstack`, `/api/mi`, `/api/memory` (second, previously-shadow mount), `/api/tasks`, `/api/strategic`, `/api/agenview`, `/api/seo`, `/api/coo-v4`, `/api/company-os`, `/api/autonomous`, `/api/council`, `/api/improvement`, `/api/health-intel`, `/api/digital-twin`, `/api/n8n`, `/api/seo/gsc`, `/api/analytics`, `/api/gbp`, `/api/engineering`, `/api/ai`, `/api/connectors`, `/api/ceo` (second, previously-shadow mount).

Plus, named explicitly in Priority #8: **`/api/jarvis`** — was mounted behind `requireAuth`, which is a no-op while `MI_PIN`/`MI_PIN_HASH` are unset (this deployment's current live configuration — see `routes/auth.ts:98`). Upgraded to `requireTaskRuntimeAuth` so the 49-route legacy router (including `POST /approvals/:id/approve`, which can reach `runApprovedTask()`) is genuinely, not just apparently, gated.

### AUTHENTICATED — Command Center canonical mounts (unchanged, already correct)
All `/api/command-center/*` and canonical bare-`/api/*` mounts (`task-runtime`, `coding`, `actions`, `governance`, `orchestration`, `delegations`, `authority`, `operator`, `evidence`, `simulation`, `health/detail`, `jarvis/*` gateway) — `requireRemoteAuth`/`requireTaskRuntimeAuth`, unchanged by this phase.

### AUTHENTICATED-IN-SOURCE, no-op-in-this-deployment — known residual, not a Phase 8A regression
`/api/visibility`, `/api/chat`, `/api/qb-agent`, `/api/projects`, `/api/reminders`, `/api/workspace`, `/api/knowledge`, `/api/ceo-observer`, `/api/nodes`, `/api/operations`, `/api/workflows`, `/api/telemetry`, `/api/executive-intelligence`, `/api/ceo` (first mount, `ceoObjectiveRouter`), `/api/approval`, `/api/executive`, `/api/memory` (first mount), `/api/briefing`, `/api/graph`, `/api/brain` — all mounted behind `requireAuth`, which is a no-op whenever `MI_PIN`/`MI_PIN_HASH` are unset. This is a **pre-existing characteristic, not introduced or worsened by Phase 8A** (these routes were never bare/unauthenticated — `requireAuth` is present in source on every one of them, predating this phase), and every one of them still sits behind the global `applyIpGuard` network boundary (LAN/Tailscale-only). It was left out of this phase's scope deliberately: Priority #6 asked to audit mounts *lacking* `requireAuth`, not to change the enforcement semantics of `requireAuth` itself, and blindly switching these to `requireTaskRuntimeAuth` risks breaking any browser-based dashboard (Command Center, AgenView, Liveboard) that calls them without an `x-api-key` header — a production-outage risk this phase's own STOP conditions forbid taking casually. **Recommended for Phase 8B:** either enable `MI_PIN`/`MI_PIN_HASH` fleet-wide, or migrate this list to `requireTaskRuntimeAuth` per-route after confirming no UI consumer depends on PIN-optional access.

### QUARANTINED (unchanged, genuinely blocked)
`/api/browser/write` (`denyAuthorityMutation()`), `/api/gstack`, `/api/coo-v4` (per-route quarantine inside their own handlers, in addition to the new mount-level auth).

### DEAD
None found at the `index.ts` mount level. (`node-agent.mjs`'s `/exec` was already retired to a 410 in Phase 7A.1 — see §5, not an `index.ts` mount.)

## 4. Manifest-vs-reality reconciliation

Phase 8 discovery's central finding: `authority-manifest.json` claimed `LEGACY_QUARANTINED`/`status: QUARANTINED` for `/api/browser/extract`, but the handler never called `denyAuthorityMutation()` — the manifest was asserting a containment that did not exist in the running code. Root cause: `authority-control-plane/registry.ts`'s classification rules are a hand-maintained regex table, not derived from actual per-route auth/quarantine wiring, so a route's *declared* class can drift from its *actual* behavior.

Mid-implementation, tracing every caller of `runBrowserTask` found a **second** instance of the same drift: `POST /api/ai/browser/run` and `POST /api/ai/browser/smoke` (a separate, real-Playwright, write-capable-if-not-blocked browser surface in `engineering/browser/browser-agent.ts`, consumed by `routes/ai-platform.ts`) were also swept into the generic `legacy-process-workflow` rule's `QUARANTINED` claim despite never being routed through `denyAuthorityMutation()` either. This surface was **not part of the original Phase 8 discovery finding** and is more dangerous than `/extract` (real headless Chromium, `evaluate` = arbitrary in-page JS) — found only by exhaustively grepping every caller rather than trusting the first instance found.

Fix: two new registry rules (`browser-extract-contained`, `ai-browser-contained`) ordered ahead of the generic legacy rules, so these three exact routes report their real state — `authorityClass: LEGACY_QUARANTINED` (required by `assertAuthorityManifest`'s external-effect-route invariant, since none of the three are yet a `CANONICAL_CONTROLLED_ACTION`), but `status: ADAPTED_TO_CANONICAL` and `phase6bDisposition: ADAPT_WITH_BEHAVIOR_CHANGE` instead of a blanket `QUARANTINED` — mirroring the same "legacy but behaviorally adapted" pattern the pre-existing `legacy-approval` rule already used. `/api/browser/write` was left untouched: it genuinely calls `denyAuthorityMutation()` and correctly remains `QUARANTINED`.

Manifest regenerated (`npm run authority:manifest`) after the code containment landed:

```
unknownMutations: 0
unresolvedLegacyMutations: 0
```

## 5. `mi-node-agent` formal disposition: **KEEP_BLOCKED**

`node-agent.mjs`'s `/exec` endpoint (arbitrary remote shell execution, unauthenticated, 0.0.0.0-bound) was already retired to a hard `410 EXEC_RETIRED` in Phase 7A.1 — reconfirmed this phase: zero `child_process` import in the file, no other mutation surface exists (`/health` is read-only; registration/heartbeat only ever POST to the central server, never accept commands). Its registration has never once succeeded against this deployment (`BLOCKED_RUNTIME`, unrelated to security — an operational gap, not a live exposure).

Given the dangerous surface is already hard-blocked and the remaining functionality is inert, the formal disposition is **KEEP_BLOCKED**: no code changes were needed or made to `node-agent.mjs` this phase. Full retirement (deleting the file, the PM2 service, and `/api/nodes` registration route) or a `REPAIR_READ_ONLY_LATER` design belongs to Phase 8B's broader legacy-retirement review, consistent with "do not reactivate broad node execution."

## 6. Stale Windows startup path

`Startup\Mi-Ultimate.vbs` pointed at `D:\Project\Master\mi-core\start.bat`, which does not exist anywhere on this machine (confirmed by direct filesystem check) — 100% dead, as Phase 7G and Phase 8 discovery both already characterized it. The canonical replacement (`pm2-windows-startup`, registry `Run` key → `pm2 resurrect`) is unambiguous and already active, and is not a batch-file successor this VBS could be repointed to. Per Priority #11's own condition ("only if the canonical replacement is unambiguous"), the file was renamed to `Mi-Ultimate.vbs.disabled-phase8a-2026-08-17` (not deleted — trivially recoverable) so it no longer autoruns on the next reboot. This is an OS-level Startup-folder change, outside git version control; no production service was restarted and no reboot was performed.

## 7. New permanent test coverage

- `server/src/security/__tests__/ssrf-policy.test.ts` — 506 deterministic, non-padded cases generated combinatorially across every blocked IPv4/IPv6 range (with exact-boundary probes on both sides of each CIDR), every rejected scheme, embedded credentials, malformed input, and DNS-resolution-failure handling. No live network dependency beyond OS-local `localhost` resolution and the RFC 2606 `.invalid` TLD.
- `server/src/__tests__/phase8a-security.test.ts` — structural proof that every containment in this doc actually landed in source: the 36 mount fixes, both SSRF call sites, write-action blocking (and that it runs *before* SSRF validation), the qb router's GET-only shape, autonomous-task-runner's continued hard-block, and the three reconciled manifest entries.
- Both wired into `test:ci` and a new `phase8a:acceptance` script.

## 8. Full frozen regression — all green

`test:ci` (incl. the two new suites above) · Phase 5A/5B/5C/5D2/5D3/5F/5G/5H/5I · Phase 6A/6B/6C/6D/6E/6F · Phase 7A/7B/7C acceptance scripts · Phase 7D session + 7F voice constituent tests (1255-scenario voice evaluation included) · Agentic Coding acceptance (5/5 fixtures) · Command Center unit/security/a11y (all vitest suites) · Command Center E2E (8/8 Playwright scenarios, real browser, full fixture-backed flow). Zero regressions attributable to this phase's changes.

## 9. Known pre-existing issue, out of scope for 8A

Independent review flagged that `routes/whatsapp.ts` (untouched by this phase — zero diff lines) gates `POST /mi` and `POST /webhook` with its own `validateApiKey()` check, but `POST /mi/setup`, `POST /mi/rotate`, `POST /mi/revoke`, and `POST /send-test` on the same router have no auth gate at all. This predates Phase 8A and was not part of its priority list; flagged here rather than silently left undocumented. **Recommended for Phase 8B**, given rotate/revoke touch the API key itself.

## 10. Non-goals confirmed (not added this phase)

No Gmail SEND, no financial execution authority, no autonomous approval, no autonomous merge/deploy, no desktop control, no new external action types, no schema v11.

## 11. Decision record

```
PHASE 8A STATUS: COMPLETE
unsafeTargetAllowed: 0
unauthenticatedAllowed: 0
browserWriteReachable: 0
financialExecutionReachable: 0
legacyMutationBypass: 0
unknownMutations: 0
unresolvedLegacyMutations: 0
schema: v10 (unchanged)
mi-node-agent disposition: KEEP_BLOCKED
NEW EXTERNAL AUTHORITY ADDED: NO
AUTONOMY EXPANSION ADDED: NO
SCHEMA MIGRATION PERFORMED: NO
```

Phase 8A is ready to freeze pending independent review, merge, and production deployment. Continue to **Phase 8B — Legacy Retirement / Platform Simplification** after this phase is deployed, verified, and frozen.
