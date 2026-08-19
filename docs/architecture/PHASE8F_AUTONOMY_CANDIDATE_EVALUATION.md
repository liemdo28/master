# Phase 8F — Autonomy Candidate Evaluation — Project Planning

Per `docs/architecture/PHASE8_DISCOVERY_AND_ROADMAP.md` Section 23 and the Phase 8E finding that "Project planning" is more deeply governed than the original Section 20 scorecard credited, this phase performs an evidence-driven, prerequisite-by-prerequisite evaluation of that single candidate against the full Section 21 checklist. This is a read-only evaluation. No code changed as part of this phase, and no autonomy was enabled.

**Classification is one of four labels: `READY`, `READY_FOR_PROPOSAL_ONLY`, `NOT_READY`, `PROHIBITED`. A `READY` or `READY_FOR_PROPOSAL_ONLY` classification is a factual finding about the current codebase, not an authorization to change behavior — enabling anything beyond what already runs in production today requires its own separate, explicit authorization and its own dedicated implementation phase.**

Scope reviewed: `server/src/personal-os/actions/governance/*`, `server/src/personal-os/actions/service.ts`, `server/src/personal-os/orchestration/{service,router,store,types,dag}.ts`, `server/src/jarvis-gateway/handlers/planning.ts`, `server/src/personal-os/orchestration/__tests__/*`, `server/src/personal-os/orchestration/phase5h-acceptance.ts`, `server/src/personal-os/automation-simulation/service.ts`, `command-center/src/routes/{PlansPage,PlanDetailPage}.tsx`. Two of the most consequential findings below were independently re-verified by direct grep against `orchestration/service.ts` before being written into this doc.

## Prerequisite-by-prerequisite findings

### 1. Deterministic target/scope — MET
`ORCHESTRATION_ALLOWED_ACTION_TYPES` is a closed, enumerable set of exactly 3 action types (`orchestration/types.ts:14-18`: `GMAIL_CREATE_DRAFT`, `CALENDAR_EVENT_PROPOSAL`, `CALENDAR_CREATE_EVENT`). `createPlanVersion` rejects any step type outside `{READ_ONLY, LOCAL_COMPUTE, CONTROLLED_ACTION}` and any `actionType` outside that set, both at creation (`orchestration/service.ts:79-91`) and again at execution as defense-in-depth (`orchestration/service.ts:432-438`). Payloads must pass `assertPlainPayload` — no free-text guessing of security-sensitive fields. Verified rejected in tests: unknown action type, `GMAIL_SEND_DRAFT`, `SLACK_POST_MESSAGE`, and a fictitious `SHELL_EXECUTE` step type all throw (`orchestration-security.test.ts:20-39`).

### 2. Canonical policy — PARTIALLY MET
Real policy rules exist and apply to every action a plan step can create (`governance/schema.ts:152-164`), and `matchesRule` (`governance/engine.ts:178-196`) is genuinely evaluated per proposal. But there is no policy rule specific to orchestration/planning itself — nothing keyed off `sourcePlanId` or multi-step aggregate risk. Planning inherits the same generic per-action-type policy set as any standalone proposal; it has no canonical policy of its own.

### 3. Risk evaluation — MET
`RiskEvaluator.assess()` (`governance/risk.ts:6-38`) is a real, non-stub scorer factoring external impact, external-target count, reversibility, payload sensitivity (regex-detected secrets bump to R4), and per-action-type floors. The resulting `riskClass` is persisted onto the plan step (`orchestration/service.ts:460`) and surfaced in the Command Center (`PlanDetailPage.tsx:121`).

### 4. Budget — MET
`BudgetManager` (`governance/budget.ts`) enforces a real per-action-type, per-period count limit (`schema.ts:242-250`). Invoked on the real execution path via `prepareExecution()` → `reserveExecution()` (`actions/service.ts:327`); orchestration explicitly catches `BLOCK_BUDGET` and keeps the step `WAITING_APPROVAL` rather than failing silently (`orchestration/service.ts:517-521`). Budgets are scoped by action type only, not by plan — no plan-level budget exists.

### 5. Kill switch — MET (independently re-verified)
`policyEngine.killSwitch.state(...)` is called directly inside `advance()` before any Controlled Action proposal is created for a step, confirmed at `orchestration/service.ts:197` and `orchestration/service.ts:368`. A triggered kill switch keeps the step `READY`, records `KILL_SWITCH_BLOCKED` evidence (`orchestration/service.ts:371`), and pauses the whole plan. Exercised by dedicated tests including persistence across a simulated restart and a race-condition test (`orchestration-restart.test.ts:108-151`).

### 6. Idempotency — MET
Three real, distinct layers: plan-level run idempotency via a DB-unique key (`orchestration/service.ts:301-306`, `store.ts:247-266`); per-step-attempt idempotency key (`orchestration/service.ts:496-502`, `store.ts:268-284`); and the underlying `ControlledActionService` proposal-level idempotency key (`actions/service.ts:140`), which `prepareExecution` looks up before calling any provider (`actions/service.ts:308-314`). Explicitly tested: duplicate `advance()` calls before and after approval do not duplicate a proposal or re-execute (`orchestration.test.ts:57-73`).

### 7. Reconciliation — PARTIALLY MET (independently re-verified)
The real "never blind-retry a possibly-completed write" protection is the idempotency-key lookup in `prepareExecution` (`actions/service.ts:308-314`), which does apply to planning steps via the same call path. However, the purpose-built `RECONCILIATION_REQUIRED` step status is declared in the type/transition table (`orchestration/types.ts:59,65,73`) and has a dedicated evidence event (`STEP_RECONCILIATION_REQUIRED`, `types.ts:197`), but **a direct grep of `orchestration/service.ts` for `RECONCILIATION_REQUIRED` and `killSwitch` confirms zero call sites ever set a step to that status** — it is declared but unreached. The status name is also referenced by an unrelated module (`operator-control/service.ts`, a natural-language incident classifier — different subsystem entirely) and by `evidence/normalize.ts` (a display-mapping table), neither of which is orchestration's own execution path. So planning has no exercised "step interrupted mid-write" recovery mechanism — only proposal-level dedup.

### 8. Evidence recording — MET
`recordEvidence` is called at every meaningful transition: plan created/versioned/validated/started/paused/resumed/cancelled, and per-step ready/waiting-approval/approval-bound/executed/failed/kill-switch-blocked/budget-blocked/policy-denied (`orchestration/service.ts`, over a dozen call sites). Exposed via `GET /orchestration/plans/:id/evidence` (`orchestration/router.ts:111-113`). A dedicated test confirms secrets never leak into evidence output (`orchestration-security.test.ts:190-199`).

### 9. Operator visibility — MET
Real, wired API surface (`GET /orchestration/plans`, `GET /orchestration/plans/:id`, `GET /orchestration/plans/:id/evidence`, mounted in `server/src/index.ts`) with a genuine Command Center UI (`PlansPage.tsx` list, `PlanDetailPage.tsx` steps/risk/approval/evidence timeline). `jarvis-gateway/handlers/planning.ts` additionally surfaces active plans conversationally, advisory only.

### 10. Rollback/cancel semantics — PARTIALLY MET
Pre-execution/mid-flight cancellation is real: `cancel()` (`orchestration/service.ts:247-288`) rejects still-waiting proposals and separately cancels already-approved-but-unexecuted ones (a regression test exists for exactly this case, `orchestration-security.test.ts:102-117`), with live Pause/Resume/Cancel buttons in the Command Center. But there is no automated rollback of an already-completed external side effect — `rollbackPlanFor()`/`compensationFor()` (`actions/service.ts:716-737`) only produce descriptive text and an availability flag; no code path executes a compensating action. This is cancel-before-effect, not rollback-after-effect.

### 11. Negative tests — MET, with two identified gaps
Genuinely thorough coverage in `orchestration-security.test.ts`: forbidden action types, execution-without-approval, cross-step/cross-plan-version/cross-project approval leakage, payload-mutation invalidating approval, expired approval, cancelled-plan no-op, failed-dependency blocking, secret redaction. Kill-switch tested at both direct-block and race/restart level. Gaps: (a) no orchestration-level test exercises the `BLOCK_BUDGET` path inside plan advancement itself — budget exhaustion is only tested at the underlying `ControlledActionService` layer, not through a plan; (b) the `jarvis-gateway` `planning.ts` handler has exactly one test, and it is happy/empty-path only (`phase7c-jarvis-gateway.test.ts:90-98`) — no negative-path test for the advisory handler.

### 12. Simulation parity — PARTIALLY MET
Individual proposal policy evaluation supports a `stage: 'simulation'` mode reusing the real policy/risk engine (`governance/router.ts:109`). But `GovernedOrchestrationService` itself has no `simulate()`/dry-run method — a plan can never be dry-run through its own `advance()` logic. The separate `AutomationSimulationService` reuses the DAG helpers and the real policy/risk engine, but reimplements its own `simulateStep()` against a hand-built fake proposal and an ephemeral throwaway governance DB (explicitly documented as a separate implementation, `automation-simulation/service.ts:1-9`) — it never calls `GovernedOrchestrationService.advance()` or `ControlledActionService.propose/approve/execute`. Real and simulated plan advancement are two separate code paths that could drift from each other.

### 13. Safe sandbox/fixture environment — MET
Every orchestration/governance test uses an isolated temp-directory SQLite file per run, cleaned up in a `finally` block. The Jarvis Gateway test sets isolated env vars before requiring any module that constructs singletons, explicitly to avoid touching production data. No test path touches shared/production state.

## Summary

| # | Prerequisite | Verdict |
|---|---|---|
| 1 | Deterministic target/scope | MET |
| 2 | Canonical policy | PARTIALLY MET |
| 3 | Risk evaluation | MET |
| 4 | Budget | MET |
| 5 | Kill switch | MET |
| 6 | Idempotency | MET |
| 7 | Reconciliation | PARTIALLY MET |
| 8 | Evidence recording | MET |
| 9 | Operator visibility | MET |
| 10 | Rollback/cancel semantics | PARTIALLY MET |
| 11 | Negative tests | MET (2 minor gaps noted) |
| 12 | Simulation parity | PARTIALLY MET |
| 13 | Safe sandbox/fixture environment | MET |

**9 MET, 4 PARTIALLY MET, 0 NOT MET.**

## Classification: `READY_FOR_PROPOSAL_ONLY`

The governance stack backing Project planning is real and substantially more mature than a typical candidate: closed action-type enumeration, genuine risk scoring, enforced budgets, a kill switch actually wired into the advance loop (restart/race tested), layered idempotency, rich evidence trails, and a live Command Center surface with pause/resume/cancel. `jarvis-gateway/handlers/planning.ts` is itself deliberately advisory/read-only and never fabricates or executes plan steps from free text.

**This classification describes behavior that already matches current production reality — Controlled Action steps already require explicit human approval before execution (`WAITING_APPROVAL` → approve → execute), the kill switch already blocks, and budgets already block.** Nothing about how the system runs today changes as a result of this finding. No `READY` classification is made, and none would be actionable without a dedicated future implementation phase, its own audit of the four `PARTIALLY MET` gaps closing to `MET`, and its own separate explicit authorization — none of which this phase performs.

The four `PARTIALLY MET` items are the concrete reasons full autonomous-execution readiness (`READY`) is not warranted:
1. Policy is generic-per-action-type, not planning-aware.
2. The declared `RECONCILIATION_REQUIRED` mechanism for interrupted mid-write steps is unimplemented — only proposal-level idempotency exists as a safety net.
3. Rollback is cancel-before-effect only; no automated compensation exists for an already-completed side effect.
4. The simulation/dry-run path is a separate reimplementation rather than the same code path as real `advance()`, so a plan preview is not guaranteed to match real execution.

None of these are architectural blockers — they are closable gaps, not reasons for `PROHIBITED`. But they are real enough that unattended/autonomous execution should not be certified from this finding alone.

## Non-actions this phase

No code changed. No `ActionType` added. No autonomy was enabled, expanded, or silently turned on. No autonomous execution, autonomous approval, merge/deploy, Gmail SEND, financial action, shell access, browser write, or desktop control was introduced. This document and its accompanying closure record are the entire output of Phase 8F.
