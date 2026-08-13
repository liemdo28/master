# Phase 6F Component Audit — Governed Automation Simulation

Date: 2026-08-12

Before any implementation, this audit inspects every existing component that could be
mistaken for or reused by a simulator, and classifies it. No implementation began
until this document was written.

## Classification

| Component | File | Classification | Why |
|---|---|---|---|
| `RiskEvaluator.assess()` | `actions/governance/risk.ts` | **CANONICAL_REUSE** | Pure function — takes an `ActionProposal`, returns a `RiskAssessment`. No store, no I/O, no side effect. Called directly by the simulator for 100% risk parity (literally the same code, not a re-derivation). |
| `evaluateDelegationEligibility()` | `delegation/eligibility.ts` | **CANONICAL_REUSE** | Pure function — the module's own header comment states "No LLM, no network call, no DB write — a caller supplies every external fact... as `ctx`." Called directly for delegation what-if simulation. |
| `computeDecisionHash()` | `delegation/eligibility.ts` | **CANONICAL_REUSE** | Pure hash function, reused for simulation determinism reporting. |
| `validateDag()`, `dependencyBlockState()` | `orchestration/dag.ts` | **CANONICAL_REUSE** | Pure functions (module comment: "Pure functions only"). Reused directly for Action Plan DAG simulation — not reimplemented. |
| `ActionPolicyEngine.evaluate()` | `actions/governance/engine.ts` | **CANONICAL_REUSE (via ephemeral store)** | Deterministic policy/kill-switch/budget/context decision logic — but `evaluate()` itself calls `this.store.savePolicyDecision()` and `this.audit.recordDecision()`, both real writes. Cannot be called against the production `GovernanceStore` without polluting real governance/audit history. Reused **unmodified**, constructed against a per-run ephemeral `ControlledActionStore` (temp directory, deleted after the run) instead — this is literal code reuse (not a fork; "do not fork policy rules" is honored exactly), while guaranteeing zero production writes. |
| `KillSwitchService.state()`, `BudgetManager.state()` | `actions/governance/kill-switch.ts`, `budget.ts` | **CANONICAL_REUSE** | Both are read-only against whatever store they're constructed with — safe to call against the ephemeral store described above (or, for what-if overrides, against an ephemeral store pre-seeded with the desired override state). |
| `applyPhase5gMigration()` (incl. `seedDefaultPolicySet`/`seedDefaultBudgets`) | `actions/governance/schema.ts` | **CANONICAL_REUSE** | Confirmed: production's live policy version is `phase5g-default-v1` (seen in every Phase 5G/5H/5I/6A–6E acceptance run this program has produced) — i.e. production has never diverged from the auto-seeded default. Constructing a fresh ephemeral store therefore reproduces the exact live policy set by construction, not by copying. |
| `ControlledActionStore` constructor | `actions/store.ts` | **CANONICAL_REUSE (schema bootstrap only)** | `new ControlledActionStore(tmpDir)` is the established, already-proven-safe pattern this entire codebase's test suite already uses to get an isolated, fully-migrated governance schema. The simulator uses this exact constructor for its ephemeral store — never a hand-rolled schema. |
| `ControlledActionService.propose()` / `.approve()` / `.execute()` / `.reject()` / `.cancel()` | `actions/service.ts` | **DO_NOT_USE** | Every one of these mutates the real `action_proposals`/`action_approvals`/`action_executions` tables. The simulator never imports or calls `ControlledActionService` at all — it builds proposal-shaped objects in memory instead. |
| `runSandboxGmailDraft()`, `runSandboxCalendarCreate()`, `runProvider()` (sandbox branch) | `actions/service.ts` | **DO_NOT_USE — the exact real-dispatch boundary** | These are the only functions in the entire repository that import `googleapis` and call a real Google API (`gmail.users.drafts.create`, `calendar.events.insert`). The simulator's fake provider module never imports `googleapis` or `../../visibility/connectors/google/google-auth` — confirmed by the security test in §10/§38 that scans the simulator's dependency graph for these imports. |
| `runProvider()` fixture branch (`fixture` mode, `MI_CONTROLLED_ACTION_PROVIDER_MODE` unset) | `actions/service.ts` | **TEST_ONLY reference, not reused directly** | This is Phase 5F's own deterministic non-network fixture path (used by real proposals in fixture/dev mode) — informative as a response-shape reference (`ProviderResult`'s fields), but it is still *inside* `ControlledActionService`, which the simulator never instantiates. The simulator's fake provider is a **new, standalone module** with the same result shape but zero dependency on `ControlledActionService`/the real DB. |
| `orchestration/service.ts`'s `advance()` (real plan mutation) | `orchestration/service.ts` | **DO_NOT_USE** | Mutates real `action_plans`/`action_plan_steps`/`action_plan_runs` rows and, for `CONTROLLED_ACTION` steps, calls into `ControlledActionService`. The simulator's DAG walk reuses only the pure `dag.ts` functions plus its own step-outcome computation — never `advance()`. |
| `orchestration/types.ts` (`ActionPlan`, `ActionPlanStep`, status enums) | `orchestration/types.ts` | **CANONICAL_REUSE (types only)** | The simulator's `SimulationRun`/`SimulationStepResult` reference these existing types for step shape/status vocabulary rather than inventing a parallel plan format. |
| Phase 6D evidence contract (`EvidenceCategory`: `FACT`/`INFERENCE`/`ASSUMPTION`/`UNKNOWN`/`CONFLICT`) | `evidence/types.ts` | **CANONICAL_REUSE (semantics only)** | Simulation predictions are never labeled as `FACT` — see §26 of the governing directive. The simulator does not write into the Phase 6D evidence stream (it is not one of the 6 in-scope source systems); it borrows the same category vocabulary for its own `SimulationStepResult.evidenceRefs`/labeling so a caller reading both surfaces sees consistent terminology. |
| Phase 6E `KnowledgeRetrievalService` | `personal-os/documents/retrieval.ts` | **ADAPTER (optional, read-only)** | If a simulation step's `inputs` reference project knowledge, the simulator may call `buildKnowledgePack()` (already read-only, already project-scoped) to attach citations — never treated as authorization, per §27. |
| Jarvis planners, n8n test paths, old workflow simulation, company-os preview/dry-run concepts | `jarvis/*`, `n8n/*` (referenced in directive) | **LEGACY / DO_NOT_USE** | Pre-Phase-5 systems with no relationship to the canonical Controlled Actions/Orchestration/Delegation authority model; reusing them would mean simulating against rules that are not the live governance rules — exactly what the directive prohibits ("do not fork policy rules"). |
| Phase 5F `sandbox-acceptance.ts` | `actions/sandbox-acceptance.ts` | **TEST_ONLY reference** | Documents the real `SAFE_GOOGLE_SANDBOX=1` / `GOOGLE_SANDBOX_ACCOUNT` gate the real sandbox provider uses. Useful as a security reference for what the simulator must *never* need or check (the simulator has no sandbox mode at all — only `fixture`-shaped fake responses). |

## Conclusion

No duplicate planning or governance engine is created. The simulator is a thin,
read-mostly orchestration layer over already-canonical pure evaluators
(`RiskEvaluator`, `evaluateDelegationEligibility`, `validateDag`), plus one
deliberate, narrowly-scoped exception: `ActionPolicyEngine.evaluate()` is reused
**unmodified** against a **per-run ephemeral store** rather than forked, so policy
parity is not merely "measured to be close" — it is the same code path, hence
provably identical for any input the ephemeral store's seeded policy set covers.

Real provider dispatch (`googleapis`, Google OAuth) is confined to exactly two
functions in the entire repository, both inside `ControlledActionService`, which the
simulator's module graph never imports. This is the hard boundary §10/§33/§38 require
proof of via automated import-graph and dispatch-count checks.
