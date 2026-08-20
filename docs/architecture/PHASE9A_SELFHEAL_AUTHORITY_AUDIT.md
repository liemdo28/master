# Phase 9A — SelfHeal / Background-Worker Authority Audit and Remediation

**Authority delta: NONE.** This phase adds zero external authority, zero new `ActionType`, zero new mutation surface. It closes a manifest-vs-enforcement mismatch found in Phase 9 discovery and makes the already-existing PM2-restart capability provably narrower and more honest than before.

## 1. Fresh audit — exact SelfHeal timer path (before any change)

`setInterval` (`index.ts:550`, `startSelfHealingMonitor(60_000)`, unconditional at process boot, no HTTP request involved) → `runHealthScan()` iterates the fixed, compile-time `SERVICES_TO_MONITOR` array (`self-healing-monitor.ts:105-126`) → `dispatchCheck(svc)` routes by `svc.type` (`pm2`/`http`/`internal`) → for `pm2`-type services reporting unhealthy, `if (count < MAX_AUTO_RESTART) restartPm2Service(svc)` → `execAsync(\`pm2 restart ${svc.pm2_name}\`)`.

**Confirmed by direct code reading and cross-referencing, before any fix:**
- **Exact restartable services**: 5 — `mi-core`, `mi-whatsapp-gateway`, `mi-accounting`, `mi-ceo-observer`, `qb-ops-agent` (the `pm2`-type entries in `SERVICES_TO_MONITOR`; `mi-core-http`/`accounting-http`/`ollama` are `http`-type and `evidence-db`/`knowledge-db` are `internal`-type — never restarted, only alerted).
- **Fixed or caller-controlled**: 100% fixed, compile-time hardcoded array literal. Zero caller influence, zero request-body input, zero dynamic dispatch.
- **Intentionally-disabled services**: **`mi-whatsapp-gateway` and `mi-ceo-observer` — 2 of the 3 services in `runtime-preflight/validator.ts`'s canonical `INTENTIONALLY_STOPPED` set — were also 2 of the 5 services this monitor was eligible to restart.** The two lists shared no code-level relationship. Currently masked only by both services not being registered under PM2 at all in production today (confirmed via `pm2 jlist`); if either were ever re-registered (e.g. a `pm2 resurrect` picking up a stale dump), the monitor would have actively tried to bring them back online, directly contradicting their intentional-stop designation.
- **Restart attempt limits**: `MAX_AUTO_RESTART = 2` per service, in-memory only (`restartCounts` module variable — resets on `mi-core`'s own process restart, since that's where this code runs).
- **Restart-storm handling**: none in this file. A separate module (`operations/self-healing.ts`, `detectRestartStorm()`) independently detects storms via 24h PM2-restart-count delta and raises an incident, but never intervenes in `self-healing-monitor.ts`'s own restart loop.
- **Project/user scope**: not applicable — infrastructure-level, global to the deployment.
- **Kill-switch/policy relationship**: none. Zero calls to `ActionPolicyEngine`, `KillSwitchService`, `BudgetManager`, or `ControlledActionService`. A global governance kill switch had zero effect on this capability.
- **Evidence/audit**: `console.log`/`console.error` only, plus in-memory `_lastScanResults`/`restartCounts` — no persisted, queryable record of any restart decision.

**Manifest claim vs. enforcement (the core finding)**: `authority-manifest.json`'s `background:self-healing-monitor` entry declared `authorityClass: "LEGACY_QUARANTINED"`, `status: "QUARANTINED"`, `approvalRequired: true`, `governanceRequired: true`, `quarantineHandler: "legacyAuthorityAdapter.quarantine"`. Independently verified (direct grep, both before and after this fix): `self-healing-monitor.ts` contained zero references to `legacy-adapter`/`quarantine`/any governance module, and `index.ts`'s only authority-plane call (`validateLegacyAuthorityRuntime`) is a manifest self-consistency checker, not a runtime gate — it has no code path that can intercept a `setInterval` callback, because `legacyAuthorityAdapter.quarantine()` is Express middleware, architecturally scoped to an HTTP request/response cycle that a background timer never has.

## 2. Broadened audit — every other non-HTTP mutation-capable background surface

`authority-manifest.json` has exactly 8 `BACKGROUND_WORKER`-kind entries, all wired unconditionally at boot (`index.ts:545-586`). Independently traced each:

| Surface | Real mutation capability | Manifest claim (before) | Enforcement (before) |
|---|---|---|---|
| `background:scheduler` | Read-only connector syncs + local cache | `CANONICAL_READ` | N/A — accurate |
| `background:burn-in` | Local DB + file writes only | `ADAPTER_TO_CANONICAL` | N/A — accurate, low-risk |
| `background:self-healing-scheduler` | `execSync` read-only `pm2 jlist` + local `curl POST` metrics-reset | `LEGACY_QUARANTINED`, approval+governance required | **Same mismatch as #1 — verified absent** |
| **`background:self-healing-monitor`** | `pm2 restart` (5 svcs) + proactive WhatsApp alert | `LEGACY_QUARANTINED`, approval+governance required | **Verified absent — priority #1, fixed this phase** |
| `background:jarvis-proactive-monitor` | Proactive WhatsApp send | `LEGACY_QUARANTINED`, approval+governance required | **Same mismatch — verified absent** |
| `background:daily-briefing-scheduler` | Proactive WhatsApp send | `LEGACY_QUARANTINED`, approval+governance required | **Same mismatch — verified absent** |
| `background:leader-heartbeat` | Local lock file only (heartbeat); failover branch sends a proactive WhatsApp notification | `ADAPTER_TO_CANONICAL`, no approval required | Low-risk; scope-description gap noted, not a governance-required-and-ignored case |
| `background:qb-online-watcher` | DB command insert that drives a remote machine + proactive WhatsApp send | `LEGACY_QUARANTINED`, approval+governance required | **Same mismatch — verified absent** |

**5 of 8 background workers shared the identical structural bug**: the `worker()` helper in `scanner.ts` mechanically derived `approvalRequired`/`quarantineHandler` purely from `authorityClass === 'LEGACY_QUARANTINED'`, for every `BACKGROUND_WORKER`-kind surface uniformly, regardless of whether any real enforcement existed. This was a root-cause bug in the manifest generator itself, not five independent mistakes.

## 3. Design decision — smallest correct model

Per the hard design boundary (no general Controlled Action authority; prefer the smallest correct model: `OBSERVE_ONLY` / `ALERT_ONLY` / narrowly-constrained `SAFE_REMEDIATION` / complete quarantine):

**`background:self-healing-monitor` → narrowly-constrained `SAFE_REMEDIATION`, now code-verified.** The restart capability was already narrow (fixed 5-service allowlist, capped retries) — the missing piece was never "add authority," it was "add the two real constraints the manifest falsely implied already existed" (respect intentional-stop, respect a kill switch) plus durable evidence. Complete quarantine was rejected as disproportionate: this capability has kept `mi-core` itself recoverable across this entire multi-week engagement, confirmed by direct observation (including the Phase 8 post-closure PM2 incident); removing it would be a real reliability regression, not risk reduction, once the two actual gaps are closed.

**The other 4 (`self-healing-scheduler`, `jarvis-proactive-monitor`, `daily-briefing-scheduler`, `qb-online-watcher`) → honest reclassification, no behavioral change.** Per the directive's second acceptable path ("reclassified honestly and constrained so its real authority is explicit"). Their `authorityClass` remains `LEGACY_QUARANTINED` (still accurately flagged as needing future adaptation — not silently resolved or hidden) and `phase6bDisposition` remains `QUARANTINE_ONLY` (still correctly tracked in `quarantinedLegacy`, not `unresolvedLegacyMutations`), but `approvalRequired`/`quarantineHandler` no longer make the false claim that HTTP-only enforcement applies to them. Deeper behavioral hardening for these 4 (e.g., a kill-switch gate on the WhatsApp-sending workers) is explicitly out of scope for this PR and flagged as follow-up work — not silently expanded into this change.

## 4. Implementation — exact new enforcement model

`server/src/company-os/self-healing-monitor.ts`:
- `RESTART_ALLOWLIST` — a frozen `Set` derived from `SERVICES_TO_MONITOR`'s own `pm2`-type entries (not a separately-maintained list — cannot drift from what's actually configured). Re-checked both by the new eligibility function and, defense-in-depth, inside `restartPm2Service` itself.
- `evaluateRestartEligibility(svc, restartCount)` — the single, pure, independently-testable decision point. Order: not-pm2-type → not-allowlisted → **intentionally-stopped (new)** → restart-limit-reached → **global-kill-switch-blocked (new)** → eligible.
- `intentionallyStoppedServices()` (imported from `runtime-preflight/validator.ts` — the existing single source of truth, not a new duplicate list) excludes `mi-whatsapp-gateway`/`mi-ceo-observer` from both restart *and* DOWN-alert eligibility — being down is their expected state.
- A lazily-constructed, read-only `KillSwitchService` (reusing the exact same `GovernanceStore`/`ControlledActionStore` the rest of the governance system uses — no new database, no new schema) checks for an active **`GLOBAL`**-scope kill switch before any restart. Only `GLOBAL` scope can ever match: this capability has no real `ActionType`, and Phase 9 explicitly must not add one, so a `PROJECT`/`ACTION_TYPE`-scope switch can never be created against it — a deliberate, honest constraint.
- `self_heal_restart_log` (new table in the existing `ops.db`, `operations/ops-db.ts`) — durable evidence for every restart decision (attempted, skipped-intentionally-stopped, skipped-kill-switch, skipped-not-allowlisted), replacing the previous console-only/in-memory-only trail.
- Alert semantics unchanged for every path except the new intentional-stop exclusion: critical PM2 services still get 2 quiet retry attempts before a CEO alert (verified no regression — see the mutual-exclusivity fix applied during implementation).

`server/src/authority-control-plane/scanner.ts` (the root-cause fix): `worker()` no longer derives `approvalRequired`/`quarantineHandler` from `authorityClass` alone. No `BACKGROUND_WORKER`-kind surface may claim `approvalRequired: true` or the string `'legacyAuthorityAdapter.quarantine'` by default — only an explicit, per-surface `overrides.quarantineHandler` naming a real, code-verified guard function may set it (used exactly once, for `self-healing-monitor`, naming `selfHealingMonitor.evaluateRestartEligibility`). This is a systemic fix: it also automatically corrects all 4 other affected surfaces, and prevents any future background worker from re-introducing the same false claim.

`server/src/authority-control-plane/legacy-adapter.ts` and `scanner.ts`'s own `assertAuthorityManifest`: both consistency checkers updated in parallel (there are two independent copies of this validation logic in the codebase) to (a) stop requiring a `quarantineHandler` from `BACKGROUND_WORKER`-kind quarantined surfaces (structurally impossible for them to have one that means anything), and (b) add a new, permanent guardrail — `LEGACY_AUTHORITY_BACKGROUND_FALSE_ENFORCEMENT_CLAIM` — that throws if any `BACKGROUND_WORKER` surface, present or future, ever claims `approvalRequired: true` or the HTTP-only handler again.

## 5. Manifest before/after

| Field | `background:self-healing-monitor` before | after |
|---|---|---|
| `authorityClass` | `LEGACY_QUARANTINED` | `CANONICAL_LOCAL_MUTATION` |
| `status` | `QUARANTINED` | `ACTIVE` |
| `approvalRequired` | `true` (false claim) | `false` (honest) |
| `governanceRequired` | `true` | `false` |
| `quarantineHandler` | `legacyAuthorityAdapter.quarantine` (false claim — never called) | `selfHealingMonitor.evaluateRestartEligibility` (real, code-verified) |
| `legacyReason` | non-null | `null` — resolved, no longer tracked as an unresolved legacy mutation |
| `phase6bDisposition` | `QUARANTINE_ONLY` | `null` — exits legacy tracking, matching every other canonical surface |

The other 4 (`self-healing-scheduler`, `jarvis-proactive-monitor`, `daily-briefing-scheduler`, `qb-online-watcher`): `authorityClass`/`status`/`phase6bDisposition` unchanged (`LEGACY_QUARANTINED`/`QUARANTINED`/`QUARANTINE_ONLY` — still honestly flagged as unresolved); `approvalRequired` false→false (was already `false` is incorrect — it was previously mechanically `true`; now correctly `false`); `quarantineHandler` `legacyAuthorityAdapter.quarantine`→`null`.

Manifest totals: `total` 1065→1066 (the one new `test:*` script this phase adds, per the established pattern), `canonical` 665→666, `quarantined` 155→154, `legacyMutations` 175→174, `quarantinedLegacy` 168→167 — exactly the expected shift of one surface (`self-healing-monitor`) moving out of the quarantined-legacy bucket into canonical. **`unknownMutations=0`, `unresolvedLegacyMutations=0` — unchanged, both required targets held throughout.**

## 6. Required security invariants — permanent test coverage

`server/src/company-os/__tests__/self-healing-restart-authority.test.ts` (14 assertions, wired into `test:ci`) proves, with real code against a real (isolated, ephemeral) governance database — not mocks, not manifest labels:
1. `RESTART_ALLOWLIST` is exactly the 5 services `SERVICES_TO_MONITOR` declares.
2. Unknown/spoofed service names (including case variations and lookalikes) are never restart-eligible.
3. Non-`pm2`-type services are never restart-eligible.
4. Both intentionally-stopped services in the allowlist are never restart-eligible, at any restart count.
5. The restart limit is enforced before eligibility.
6. A real, allowlisted, non-stopped, under-limit service with no kill switch is correctly eligible.
7. An active `GLOBAL` kill switch withholds restart for an otherwise-eligible service.
8. Disabling that kill switch restores eligibility (proves the check is live, not cached).
9. The `self-healing-monitor` manifest entry's fields actually match its real code (not just internally consistent with each other).
10. No `BACKGROUND_WORKER` surface anywhere in the current manifest claims HTTP-only enforcement.
11. The consistency validator itself actually rejects a fabricated bad surface claiming that enforcement (proves the guardrail works, not just that it's absent from current data).
12. `unknownMutations`/`unresolvedLegacyMutations` remain 0 on the real, regenerated manifest.
13. The `ActionType` enum remains exactly 7 values — no new authority added.
14. No `shell: true` was introduced.

## 7. Deterministic evaluation

`server/src/company-os/self-healing-restart-evaluation.ts` (`npm run phase9a:evaluation`) — **945 cases**, sweeping every monitored service × restart counts 0-9 × kill-switch on/off, a restart-storm sweep (mi-core, counts 0-20), 29 adversarial spoofed/unknown service-name variants × restart counts 0-9 × kill-switch on/off, a 100-call concurrency-determinism probe, and 4 legacy-background bypass attempts fed directly into the real validator. Result:

```
totalCases: 945, failures: 0
unexpectedRestart: 0
disabledServiceRestart: 0
arbitraryTargetReachability: 0
manifestRuntimeMismatch: 0
shellEscalation: 0
authorityExpansion: 0
```

All six hard targets exactly 0, as required.

## 8. Full regression

Clean `rm -rf dist && npx tsc` (zero errors) · full `test:ci` (zero real failures, including the new Phase 9A test) · `phase9a:acceptance` (own test + evaluation + manifest check) · `phase6b:acceptance` (300/300 correct, deterministic) · `phase7a/7b/7c/7g:acceptance` · `phase8a/8b:acceptance` — all exit 0.

## 9. Explicit statement

**NO NEW AUTHORITY.** No `ActionType` added (still exactly 7). No policy rule, risk threshold, approval requirement, budget semantic, kill-switch semantic, or delegation semantic changed — the kill switch is *consulted* by a new caller, its own semantics are untouched. No production DB schema changed (the new `self_heal_restart_log` table lives in the existing internal `ops.db`, not `personal-os.db`, and is purely additive). No external write executed. No Gmail send, Calendar/Drive mutation, financial action, browser write, or desktop-control capability touched. No service was restarted, no process was killed, and no PM2 definition or Windows startup configuration was modified as part of *making* this change — only as part of the normal, separately-authorized deploy step that would follow, if and when this PR is merged and deployment is decided.
