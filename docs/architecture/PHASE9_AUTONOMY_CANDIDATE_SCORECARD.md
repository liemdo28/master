# Phase 9 — Autonomy Candidate Scorecard

## Section 6 — Project planning re-evaluation

Phase 8F classified Project planning `READY_FOR_PROPOSAL_ONLY` with 4 known gaps. Re-checked against current `orchestration/service.ts`, `types.ts`, `dag.ts` in full (unchanged since Phase 8F — no commits touched this module between then and now).

**Gap (1) policy is generic, not planning-specific** — RECONFIRMED unchanged. Each step's `CONTROLLED_ACTION` goes through the exact same per-proposal policy evaluation as a standalone action; no plan-aware rule dimension (aggregate risk, max side effects per plan) exists.

**Gap (2) `RECONCILIATION_REQUIRED` never set** — RECONFIRMED, and now known to have a sibling: `RECOVERY_REQUIRED` (the equivalent proposal-level status in `personal-os/actions/types.ts:13`) is *also* declared but never set anywhere in `service.ts` — the reconciliation stage is unimplemented at both the orchestration-step level and the Controlled-Action-proposal level, not just the one previously documented.

**Gap (3) rollback is cancel-before-effect only** — RECONFIRMED. `compensationFor()` writes static descriptive metadata (`available`/`requiresNewApproval` flags) at proposal time; no code path anywhere transitions a compensation to `PROPOSED`/`COMPLETED`. A completed external side effect (a created draft/event) is never auto-reversed.

**Gap (4) simulation reimplements step logic separately** — RECONFIRMED with a new, more precise detail: DAG logic genuinely *is* shared (`automation-simulation/service.ts` imports `validateDag`/`dependencyBlockState` directly from `orchestration/dag.ts`). What's not shared is the per-step decision-interpretation logic, AND — newly found — `buildFakeProposal()` in the simulator does not call `ControlledActionService`'s private `normalizePayload()`, meaning a simulated payload that real `propose()` would reject (malformed email, invalid calendar range) is never caught by simulation and could report an optimistic outcome for input real execution would reject outright.

**New gap (5), most consequential**: delegation is architecturally wired into `GovernedOrchestrationService` but disconnected from every live production caller (Capability Map doc, Section 4) — independently re-verified by direct grep of every construction site in this phase. This alone rules out any `READY_FOR_LIMITED_DELEGATION` classification for the live system today, regardless of how sound `DelegationService`'s own code is in isolation — there is no live evidence of governed delegated execution to certify.

**New gap (6)**: `READ_ONLY`/`LOCAL_COMPUTE` steps always report `COMPLETED` by echoing `inputs` — no real read/compute integration exists at this layer, so non-`CONTROLLED_ACTION` steps carry no genuine completion proof either.

**New gap (7)**: plan cancellation is a deliberate, documented two-phase operation (proposal rejection/cancellation in a separate transaction from plan/step status update, to avoid a cross-connection SQLite deadlock) — correct by design, but a real crash-window exists between the two phases with no compensating recovery logic found.

**Final classification: `READY_FOR_PROPOSAL_ONLY`.** Every step still requires the unmodified `ControlledActionService` for any external side effect, with full policy/risk/budget/kill-switch re-evaluation at each stage, and no step's approval authorizes another. This is safely proposal-only. It does not meet `READY_FOR_HUMAN_APPROVED_EXECUTION`'s bar (gaps 2, 3, 6 leave real state-machine and rollback holes even with a human clicking approve), and does not meet `READY_FOR_LIMITED_DELEGATION` at all (gap 5 — no live delegation path exists to evaluate). This is the *strongest* candidate found in the entire audit but is not being upgraded past what the live system actually does today.

## Section 15 — 24-prerequisite framework, applied in full to Project planning (flagship candidate)

| # | Prerequisite | Verdict | Evidence |
|---|---|---|---|
| 1 | Canonical owner exists | MET | `personal-os/orchestration/service.ts`, single class |
| 2 | No competing live mutation implementation | MET | Simulation/automation-simulation is ephemeral, never touches prod DB or calls propose/approve/execute |
| 3 | Authenticated entrypoint | MET | Dual mount, `requireRemoteAuth`/`requireTaskRuntimeAuth` |
| 4 | Project/tenant isolation | MET | Cross-project step targeting hard-fails validation |
| 5 | Explicit action semantics | MET | Closed 3-type allowlist, validated twice (creation + execution) |
| 6 | Policy coverage | PARTIALLY_MET | Real, but generic per-action-type, not plan-aware |
| 7 | Risk classification | MET | Deterministic `RiskEvaluator`, shared single instance |
| 8 | Budget enforcement | MET | Fail-closed, 3-stage lifecycle |
| 9 | Kill-switch enforcement | MET | Checked in policy engine + extra standalone orchestration re-check |
| 10 | Approval semantics | MET | Single approval surface, STRONG-level confirmation phrase for high-risk |
| 11 | Idempotency | MET | 3 layered idempotency keys (plan-run, step-attempt, proposal-level) |
| 12 | Authoritative evidence | MET | `recordEvidence()` at every transition |
| 13 | Reconciliation | **NOT_MET** | `RECONCILIATION_REQUIRED`/`RECOVERY_REQUIRED` declared, never set anywhere |
| 14 | Safe simulation | PARTIALLY_MET | DAG logic shared; decision-interpretation and payload validation are not — real drift risk |
| 15 | Rollback/compensation | PARTIALLY_MET | Cancel-before-effect only; no automated compensation for completed side effects |
| 16 | Sandbox/test environment | MET | Real Google API access gated behind `SAFE_GOOGLE_SANDBOX=1` + hard identity match; `fixture` mode is the safe default |
| 17 | Credentials/scopes | MET (for the 3 live-capable types) | OAuth scopes present by name; identity-guarded sandbox |
| 18 | Deterministic failure semantics | MET | `ALLOWED_TRANSITIONS` state machine rejects illegal jumps; explicit failure codes (e.g. `CONFLICT_CHANGED`) |
| 19 | Auditability | MET | Same evidence trail as #12 |
| 20 | Regression coverage | MET | `orchestration-security.test.ts`, `orchestration-restart.test.ts`, `orchestration-concurrency.test.ts` — forbidden-type rejection, cross-plan/cross-project leakage, kill-switch race, restart persistence, DB-level concurrency guard all tested |
| 21 | Operator visibility | MET | Live `GET /orchestration/plans[...]` API + Command Center UI (`PlansPage`, `PlanDetailPage`) |
| 22 | Incident recovery | PARTIALLY_MET | Cancellation works pre-effect; no recovery path for a post-effect failure (ties to #13/#15) |
| 23 | No secret leakage | MET | `sanitizeText()`/`rejectSecret()` strip/reject secret-shaped content before storage; dedicated test confirms no leak through evidence |
| 24 | No hidden shell/browser/deploy bridge | MET | Orchestration touches only the closed 3-type Controlled Action set — no shell/browser/deploy capability reachable from this module |

**19 MET, 5 PARTIALLY_MET, 0 NOT_APPLICABLE, but 1 hard NOT_MET (#13, reconciliation).** Consistent with the `READY_FOR_PROPOSAL_ONLY` classification above — the missing reconciliation stage is precisely why nothing beyond proposal-only is certified.

For the other 18 candidates below, the same 24-point framework was applied at a summary level (not exhaustively itemized per-candidate in this document, to keep it navigable) — see the Blast Radius/Governance Maturity columns in Section 16 as the compressed representation, with the detail available in the Capability & Authority Map doc's per-subsystem rows.

## Section 16 — Candidate scorecard (19 candidates)

| Candidate | Authority delta if enabled | Blast radius | Reversibility | Observability | Governance maturity | Sandbox quality | Credential readiness | Test maturity | Operator UX | Failure containment | **Classification** |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **Project planning** | none today (proposal-only already live) | narrow (3 action types, per-step governed) | partial (cancel pre-effect only) | high | high (but 1 hard gap: reconciliation) | strong (fixture default, identity-guarded sandbox) | present for live-capable types | high | live UI + API | strong except post-effect recovery | **READY_FOR_PROPOSAL_ONLY** |
| Task creation/update | would require new ActionType | narrow (internal only) | high (internal state, no external effect) | moderate | none — `task-runtime`/`task-intelligence` have zero governance imports | N/A (no external effect) | N/A | moderate (state-machine well-tested) | none dedicated | good (hard command allowlist elsewhere in task-runtime) | **NOT_READY** |
| Gmail draft update | would require new capability (update not implemented at all) | N/A — doesn't exist | N/A | N/A | N/A | N/A | present (scope granted) | none | N/A | N/A | **NOT_READY** (capability absent, not just ungoverned) |
| Gmail send | would require reversing a structural block, a policy DENY rule, and building a real executor | wide (irreversible external communication) | **none** — cannot un-send | would be high if built (evidence pipeline exists for drafts) | policy already explicitly DENYs it | N/A — no sandbox exists for send | scope granted but unused | none (structurally unreachable, no coverage needed today) | N/A | N/A | **DEFAULT_DENY** |
| Calendar update | not implemented (legacy path dead) | N/A | N/A | N/A | N/A | N/A | present | none | N/A | N/A | **NOT_READY** |
| Calendar cancel | no ActionType exists for delete/cancel | N/A | N/A | N/A | N/A | N/A | present | none | N/A | N/A | **NOT_READY** |
| Drive write | no ActionType, no live code, dead legacy adapters only | would be wide if built (external file mutation) | N/A | N/A | N/A | N/A | scope granted, unused | none | N/A | N/A | **NOT_READY** |
| Browser write | hard stub (`denyAuthorityMutation`) | would be very wide (arbitrary web interaction) | low if built | N/A | explicitly denied by design | N/A | N/A | regression-locked to stay denied | N/A | N/A | **DEFAULT_DEFER** |
| Desktop control | does not exist in any form | would be maximal (full OS control) | very low | N/A | none | N/A | N/A | none (nothing to test) | N/A | N/A | **DEFAULT_DENY** |
| Shell/process action (general) | already exists but hard-allowlisted (M) or contained (Y) | narrow where it exists (fixed allowlist), would be very wide if the one latent gap (`tool-registry.ts` git tool) were ever fed caller-controlled input | moderate | moderate | mixed — canonical allowlist is excellent, one latent unvalidated path exists | N/A | N/A | good for the allowlisted path | none dedicated | good except the one latent gap | **NOT_READY** to expand; existing narrow form is fine as-is |
| **Service restart** | already live and autonomous today (Q), but under a manifest label that is not runtime-enforced | narrow (fixed 5-service PM2 allowlist, capped 2 retries) | high (services are designed to be restarted) | low (console/in-memory only, not evidence-store-grade) | **label says QUARANTINED, enforcement does not exist for this surface** | N/A | N/A | none dedicated to this restart path specifically | operator sees it only via logs, not the Evidence UI | good in practice (narrow scope, hard cap, human-alert escalation) — but audit-trail-weak | **NOT_READY** (as a *candidate for expansion*) — already-existing scope should not be expanded until reconciled with canonical governance |
| Orphan-process remediation | **would require a genuinely new authority boundary** | would be wide (arbitrary process termination by port ownership, not by known service identity) | none (kill is not reversible) | N/A — no code exists | none — deliberately, by tested design (`phase7g-boot-preflight.test.ts:38`) | N/A | N/A | a test exists that *proves this is absent*, not that it works | N/A | N/A | **DEFAULT_DENY** (as autonomous); the manual remediation performed during the Phase 8 incident remains the correct human-authorized pattern |
| Git push | does not exist anywhere | would be wide (repo state change) | high (git history) | N/A | N/A | N/A | N/A | regression-locked to stay absent | N/A | N/A | **DEFAULT_DEFER** |
| PR creation | does not exist anywhere | moderate | high | N/A | N/A | N/A | N/A | regression-locked to stay absent | N/A | N/A | **DEFAULT_DEFER** |
| PR merge | does not exist anywhere | wide | moderate (revertable but disruptive) | N/A | N/A | N/A | N/A | regression-locked to stay absent | N/A | N/A | **DEFAULT_DENY** |
| Deployment | does not exist anywhere (all deploys in this program have been manual, human-run) | very wide (production runtime) | moderate (rollback exists but is manual) | N/A | N/A | N/A | N/A | none (no code to test) | N/A | N/A | **DEFAULT_DENY** |
| Financial action | no code path anywhere in `server/src` | would be maximal (real money) | very low | N/A | none — entirely outside the governed framework by design | N/A | N/A | none | N/A | N/A | **DEFAULT_DENY** |
| Proactive operational proposal | partially exists today (OBSERVE/ALERT are pull-based; nothing PROPOSEs on its own initiative) | would be narrow if scoped to existing governed action types | high (still requires human approval downstream) | the underlying data already exists (evidence/health endpoints) | would inherit B's governance if built on top of it | N/A | N/A | none for the proactive-trigger layer itself | would improve operator UX, currently pull-only | good if built on top of existing governance | **READY_FOR_SIMULATION** (of the trigger logic only — see roadmap) |
| Proactive operational execution | does not exist; would require autonomous action on top of the above | would be as wide as whatever it's scoped to act on | depends entirely on scope | N/A | N/A — no autonomous-execution proactive path exists today | N/A | N/A | N/A | N/A | N/A | **DEFAULT_DEFER** |

## Section 17 — "No New Authority" as a first-class option

Evaluated on equal footing, not as a fallback. Genuine, valuable work available under this option, grounded in this audit's own findings:

- **Reconcile the self-healing quarantine-label/enforcement gap** (Finding 6) — either wire the background worker through the canonical Authority Control Plane, or correct the manifest's `approvalRequired`/`governanceRequired` fields to honestly reflect that this is an unenforced-for-background-workers label, and reconcile `SERVICES_TO_MONITOR` vs `INTENTIONALLY_STOPPED` into one source of truth. Pure hardening, zero new external authority.
- **Close the delegation-disconnection gap or document it as intentional** — either wire `DelegationService` into the live `GovernedOrchestrationService` singleton (still zero new authority — delegation's own approval semantics are already strict) or explicitly document that delegation is dormant-by-design pending a future decision, so the capability map doesn't silently drift further from reality.
- **Fix the `coo-v4/agents/browser-operator.ts` SSRF gap** — route `navigate()` through `security/ssrf-policy.ts`'s `validateTargetUrl()` like every other outbound-fetch surface. Zero new authority, closes a real containment inconsistency.
- **Implement `RECONCILIATION_REQUIRED`/`RECOVERY_REQUIRED`** for at least one real failure scenario, closing the single hard `NOT_MET` prerequisite blocking Project planning from ever progressing past proposal-only.
- **Improve simulation fidelity** — route `AutomationSimulationService`'s per-step decision interpretation and payload validation through the same code `advance()`/`normalizePayload()` use, closing the drift risk found in Gap 4.
- **Evidence-grade audit trail for SelfHeal's restarts** — persist to the same evidence store the rest of the governance stack uses, instead of console/in-memory only.
- **Operator UX**: surface the currently pull-only proactive signals (budget/kill-switch/policy-drift/approval-waiting/delegation-expiry) as push notifications, without adding any new authority — this directly serves Section 23's finding that visibility should improve before authority does.
- **Test determinism**: address `cancel-race-regression.test.ts`'s single-sample calibration weakness (median-of-N or a retry-once pattern), documentation only in this phase.
- **Latent command-injection hardening**: add explicit input validation to `company-os/tool-registry.ts`'s `git` tool even though no live caller currently exploits it — defense-in-depth for a future caller.

None of this requires a new `ActionType`, a policy/risk/budget/kill-switch change, or any external write capability. This is a genuinely strong, evidence-backed "no new authority" body of work — not a filler option.

## Section 18 — Ollama/model dependency

Checked every candidate above for a genuine local-model dependency. **None of the 19 candidates require Ollama.** `coding/workflow.ts`'s `LlmCodingEngine` is the only subsystem in this audit that touches a local model at all, and it is not itself one of the scored candidates (it's an existing, already-running capability, gated by its own resource-admission controls, unrelated to Ollama specifically — `voice-transcription` uses `faster-whisper` via Python, also not Ollama). Ollama being down does not block any Phase 9 candidate. Classification: **OPTIONAL_MODEL_DEPENDENCY does not apply to any scored candidate; none has a REQUIRED_MODEL_DEPENDENCY on Ollama either.** Ollama was not started, installed, or reconfigured during this discovery.

## Section 26 — Selection

Per the directive's preferred order (observability → proposal → simulation → human-approved execution → limited delegation → autonomous execution), and per the explicit instruction not to skip levels: Project planning is the only candidate that clears even the proposal-only bar with real, tested, live-running governance behind it — every other scored candidate is either `NOT_READY`, `DEFAULT_DEFER`, or `DEFAULT_DENY`. Project planning does not "clearly outperform NO NEW AUTHORITY" in the sense of justifying new implementation work in Phase 9 itself, because **it is already operating at exactly the `READY_FOR_PROPOSAL_ONLY` level in production today** — there is nothing to build to reach that level, only gaps to close to ever justify moving past it, and closing those gaps is itself squarely "no new authority" hardening work.

**Selected: NO NEW AUTHORITY**, with Project planning's four (now seven) documented gaps and the Section 17 hardening list as the concrete, evidence-backed candidates for that work, should a future phase be authorized to pursue it.
