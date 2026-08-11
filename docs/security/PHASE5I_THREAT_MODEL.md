# Phase 5I Threat Model

**Delegation cannot override Phase 5G DENY. Delegation cannot override a kill switch.
Delegation cannot increase a budget. Delegation expires. Delegation is
project/action/target scoped. Mi cannot approve its own delegation. Phase 5I
introduces no new external action type. Gmail SEND remains unavailable.** Every
threat below is evaluated against those seven invariants.

## Threats and Mitigations

| Threat | Mitigation |
|---|---|
| Forged/unapproved delegation authorizes an action | `tryAuthorize()` filters candidates to `status === 'ACTIVE'` only; a `DRAFT`/`WAITING_APPROVAL` delegation is structurally never eligible. |
| Mi approves its own delegation | `approve()` rejects `approver` matching `mi/system/automation/delegation/ai` unconditionally, before any other check. |
| One-click / scripted approval | `strongConfirmation` must literally contain `AUTHORIZE:<id>`; no shortcut flag exists in CLI/API/UI. |
| Expired delegation still executes | Time-window check is part of the 18-point eligibility evaluation, re-run on every attempt (not cached); `sweepExpired()` also proactively flips status. Proven under a race where expiry lands between eligibility pass and dispatch. |
| Revoked delegation still executes | `tryAuthorize()` re-reads live status immediately before reserving quota; revocation is durable (a DB write) and observed on the very next check. Proven under a race where revoke lands mid-flight. |
| Cross-project reuse | `candidates = listDelegations('ACTIVE').filter(d => d.projectId === proposal.projectId)` — exact string match, no wildcard, no partial match. |
| Wrong action type | `DELEGATION_ELIGIBLE_ACTION_TYPES.has(...)  && delegation.allowedActionTypes.includes(...)` — both checked. |
| Unscoped target ("all Gmail") | Deny-by-default: no domain/contact-id/project-linked restriction present => ineligible. |
| Domain/recipient-count bypass | Checked against the exact recipient list extracted from the real `normalizedPayload`, every attempt. |
| Risk escalation via delegation | `RISK_RANK` comparison narrows only; `CALENDAR_CREATE_EVENT` additionally hard-requires a `STRONG`-ceiling delegation regardless of what `allowedActionTypes` says. |
| Payload mutated after evaluation | `payloadHash` recomputed and compared against the proposal's own stored hash on every evaluation. |
| Policy tightened after approval | `checkPolicyDrift()` compares the delegation's frozen `policyHash` against the live active policy set on every `get()`/`list()`/`evaluate()`/`tryAuthorize()` call; any difference pauses the delegation (`PAUSED_POLICY_CHANGED`) rather than silently continuing. |
| Kill switch bypass | Checked twice, independently: orchestration's pre-proposal check (reused from Phase 5H) and `ControlledActionService.execute()`'s own check (Phase 5F, unmodified). |
| Phase 5G budget bypass | `BudgetManager.state()` read fresh on every eligibility check; actual reservation still happens inside the unmodified `execute()` path. |
| Delegation quota bypass / double-spend | Atomic conditional `UPDATE` (`claimStep`/`BudgetManager` pattern); proven under concurrent races. |
| Replay / duplicate execution | `alreadyExecuted` check (via `action_executions` existence) blocks re-authorization of an already-executed proposal. |
| New external action type introduced | `DELEGATION_ELIGIBLE_ACTION_TYPES` is a closed 3-member set; `createDelegation()` throws for anything outside it, before a `DRAFT` row can even exist. |
| Gmail SEND reachable via delegation | Rejected at `createDelegation()` (not in the eligible set) *and* independently hard-blocked by pre-existing Phase 5F execution code — two layers. |
| Financial/merge/deploy action reachable | No such `ActionType` exists anywhere in the type system; unreachable by construction. |
| Delegation creates a child delegation | No code path accepts an "on behalf of" delegation parameter; structurally absent. |
| Secret-bearing payload delegated | Regex scan (`sk-`, `AIza`, PEM headers, `refresh_token`/`client_secret` key patterns) runs as part of every eligibility check. |
| Production mutation during certification | §30/§39-equivalent acceptance runs only against disposable copies of production-derived state, fixture provider mode, never the live DB — see `PHASE5I_ACCEPTANCE.md`. |

## Security Tests

- `npm run test:delegated-authority-security`
- `npm run test:delegated-authority-concurrency`
- `npm run test:delegated-authority-restart`
- `npm run test:delegated-authority-evaluation`
