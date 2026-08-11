# Phase 5I Delegation Security

**Delegation cannot override Phase 5G DENY. Delegation cannot override a kill switch.
Delegation cannot increase a budget. Delegation expires. Delegation is
project/action/target scoped. Mi cannot approve its own delegation. Phase 5I
introduces no new external action type. Gmail SEND remains unavailable.**

## Approval Boundary

`DelegationService` has exactly one call that can turn a `WAITING_APPROVAL`
Controlled Action proposal into `APPROVED`: `ControlledActionService.approve()` — the
same pre-existing surface a human uses, called only after the full 18-point
eligibility check passes. No other code path in Phase 5I can produce an approval.

`approve(delegationId, ...)` (the delegation's *own* strong approval) is a completely
separate operation from an individual action's authorization, enforced structurally:
`DelegationService.approve()` only ever transitions a `DelegatedAuthority` row; it
never touches `action_proposals`/`action_approvals`. The two only connect through
`tryAuthorize()`, which requires the delegation to already be `ACTIVE` (i.e. already
strongly approved) before it will even attempt anything.

## Self-Approval Rejected

`approve(delegationId, { approver, strongConfirmation })` throws if `approver` is
empty or matches `/^(mi|system|automation|delegation|ai)$/i` (case-insensitive) —
before checking anything else. There is no way to construct a call that bypasses this
check; it runs first, unconditionally.

## Strong Confirmation Required

`strongConfirmation` must literally contain `AUTHORIZE:<delegationId>`. No `--yes`,
`--force`, `--skip-policy`, `--unlimited`, `--forever`, or `--ignore-budget` flag
exists anywhere in the CLI, API, or Command Center — confirmed by direct code
inspection of `cli.ts` and `router.ts` (grep-verified in CI hygiene scans).

## Effective Permission Is a Minimum

For every check, delegation only ever *narrows*:

- **Risk**: `RISK_RANK[proposal.riskClass] <= RISK_RANK[delegation.riskCeiling]` — a
  delegation cannot raise the risk Phase 5G already computed for the action.
- **Budget**: Phase 5G's `BudgetManager.state()` is checked independently of, and in
  addition to, the delegation's own `maxExecutions`/`maxTargets`/`actionBudgets` — the
  effective ceiling is always the minimum of both, never a sum.
- **Policy**: the live `ActionPolicyEngine.evaluate()` decision is checked fresh, per
  attempt; a `DENY` (or `BLOCK_BUDGET`/`BLOCK_KILL_SWITCH`/`BLOCK_CONTEXT`) always wins
  regardless of delegation state.
- **Kill switch**: checked both before proposal creation (orchestration layer, reused
  from Phase 5H) and again inside `ControlledActionService.execute()` itself
  (Phase 5F, unmodified) — two independent enforcement points, neither bypassable by a
  delegation.

## Target Scoping Is Deny-by-Default

A delegation with no `allowedDomains`, no `allowedContactIds`, and no
`projectLinkedContactsOnly: true` is rejected as *unscoped* by the eligibility
evaluator (`eligibility.ts`'s `checkTargetScope`) — "all Gmail"/"any contact" can
never pass. BCC is unconditionally rejected. Calendar recurrence is unconditionally
rejected (and independently, Phase 5F's own `normalizePayload()` for calendar actions
already strips any `recurrence` field before a proposal can even be created — two
independent layers, not reliance on one).

## Payload Binding

`evaluateDelegationEligibility()` recomputes `payloadHash(proposal.normalizedPayload)`
and compares it against `proposal.payloadHash` on every single evaluation — a payload
mutated after the proposal was created is detected and rejected, every time, with no
caching of a stale "already checked" result.

## Quota Is Atomic

`reserveQuota()` uses a single conditional `UPDATE ... WHERE usedExecutions <
maxExecutions AND (maxTargets IS NULL OR usedTargets + ? <= maxTargets)` — the same
optimistic-concurrency pattern `claimStep()` (Phase 5H) and `BudgetManager` (Phase 5G)
already use. Under a race for the last slot, exactly one caller's `UPDATE` affects a
row; every other caller observes `changes === 0` and is denied — proven under a real
concurrent `Promise.all` race in `delegation-concurrency.test.ts`.

## Replay Safety

`alreadyExecuted` (checked via `action_executions` row existence for the exact
proposal id) is part of the 18-point eligibility check — a proposal that already has
an execution record is never re-authorized, and `reserveQuota()` is never called
twice for it.

## No Child Delegations

No method, field, or CLI/API surface accepts an "on behalf of delegation X" parameter
anywhere in this codebase. A delegation creating another delegation is not merely
forbidden by a runtime check — the code path does not exist.

## Security Tests

- `npm run test:delegated-authority-security` — forged/unapproved, expired,
  not-yet-active, revoked, wrong project, wrong action type, wrong target, domain
  bypass, excessive recipients, risk above ceiling, payload mutation, kill switch,
  exhausted Phase 5G budget, exhausted delegation quota, replay, Gmail SEND rejection,
  arbitrary new action type rejection, STRONG-ceiling requirement for
  `CALENDAR_CREATE_EVENT`, no-child-delegation (structural). Required and achieved:
  `unauthorizedExternalExecution = 0`.
- `npm run test:delegated-authority-concurrency` — final-quota-slot race,
  revoke race, expiry race, kill-switch race, concurrent orchestration `advance()`.
- `npm run test:delegated-authority-evaluation` — 200/200 scenarios correct, every
  bypass metric zero.
