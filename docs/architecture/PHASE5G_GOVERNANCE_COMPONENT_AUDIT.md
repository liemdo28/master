# Phase 5G Governance Component Audit

Baseline: `1ba25063997f166c20a015017ccdd35e278509cf`

## Canonical Selections

Phase 5G uses the existing Phase 5F Controlled Actions stack as the single execution boundary. No parallel governance stack is introduced.

| Canonical component | Implementation home | Selection |
| --- | --- | --- |
| `ActionPolicyEngine` | `server/src/personal-os/actions/governance/engine.ts` | New deterministic evaluator integrated into `ControlledActionService` |
| `RiskEvaluator` | `server/src/personal-os/actions/governance/risk.ts` | New deterministic risk scorer replacing fixed action-only risk as the execution authority |
| `BudgetManager` | `server/src/personal-os/actions/governance/budget.ts` | New transactional budget reservation/finalization over Personal OS DB |
| `KillSwitch` | `server/src/personal-os/actions/governance/kill-switch.ts` | New DB-backed global/project/action kill switch checked at proposal, approval, and execution |
| `GovernanceAuditService` | `server/src/personal-os/actions/governance/audit.ts` | New append-only event service using Personal OS DB |

## Existing Components

| Component | Classification | Decision |
| --- | --- | --- |
| `ControlledActionService` | ADAPT | Keep as the only provider execution path; add policy evaluation, strong approval validation, budget reservation, kill-switch checks, and governance audit events. |
| `ControlledActionStore` | ADAPT | Extend the same `personal-os.db` from schema v7 to v8. Existing v7 action tables and evidence are preserved. |
| `ActionProposal`, `ActionApproval`, `ActionExecution` | ADAPT | Preserve Phase 5F invariants. Add governance read-model fields via detail responses and v8 tables instead of mutating old evidence. |
| Phase 5F audit evidence | MERGE | Keep `action_evidence` for action lifecycle. Add `governance_events` for governance lifecycle and cross-reference proposal/decision IDs. |
| Phase 5F policy helpers | ADAPT | Keep canonical JSON/hash/sanitizers. Replace fixed risk-only execution allow with policy decisions. |
| Command Center Actions UI | ADAPT | Keep as the action execution surface. Add governance detail and strong approval confirmation. Add separate Governance section. |
| Project Registry | ADAPT | Use as a context guard for registered/archived project checks. Do not move project ownership or map architecture. |
| Personal OS preferences | ADAPT | Use confirmed timezone for time-policy context where available. Do not make preferences the policy store. |
| Task Runtime approval semantics | IGNORE | Separate approval queue for coding/task runtime; do not merge into controlled external action approvals. |
| `server/src/approval/gate.ts` | IGNORE | Legacy approval queue for older runtime. It is not the Phase 5F/5G controlled action authority. |
| `server/src/autonomous/*` policies | IGNORE | Existing autonomy classification is broader and not bound to Phase 5F provider execution. No reuse for controlled external actions. |
| Express `rateLimiter` | ADAPT | Keep HTTP protection. Add governance burst detection for action semantics. |
| SelfHeal / health routes | ADAPT | Use service health context as an execution guard. Do not let SelfHeal remediate governance events. |
| Security policy files and secret redactors | ADAPT | Reuse sanitization patterns. Add payload sensitivity classification before policy evaluation. |
| Owner/identity configuration | ADAPT | Use existing explicit actor strings and session/API auth. Do not hardcode personal addresses. |
| Environment flags | ADAPT | Preserve `MI_CONTROLLED_ACTION_PROVIDER_MODE`, `SAFE_GOOGLE_SANDBOX`, and `GOOGLE_SANDBOX_ACCOUNT`. Add optional governance knobs only as fail-closed guards. |
| Emergency stop mechanisms | MERGE | Add DB-backed kill switch and CLI lockdown/unlock. PM2/service-level stops remain operational, not governance policy. |
| Existing policy/rules engines outside Personal OS | IGNORE | They are domain-specific and not bound to Phase 5F action payload hashes, approvals, budgets, or executions. |

## Non-Goals Confirmed

- No new external action types.
- No Gmail SEND implementation.
- No financial actions.
- No autonomous approvals.
- No autonomous action chains.
- No merge/deploy actions.
- No voice or desktop control.
- No changes to Coding Engine or retrieval architecture.

## Integration Boundary

All external side effects remain behind:

`proposal -> policy decision -> explicit approval -> execution revalidation -> provider`

Provider execution may only occur through `ControlledActionService.execute`. The policy layer fails closed for missing policy, corrupted policy, unknown action, stale decision, kill switch, budget exhaustion, and context mismatch.
