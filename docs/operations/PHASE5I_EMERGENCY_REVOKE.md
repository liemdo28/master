# Phase 5I Emergency Revoke

There is no separate Phase 5I emergency system. **Two independent, pre-existing
controls already stop any delegated execution — use whichever fits the situation.**

## 1. Revoke the specific delegation (targeted, immediate)

```bash
npm run personal-os -- delegation revoke <id> "emergency revoke" --actor <your name>
```

Or from Command Center: open the delegation's detail page → **REVOKE DELEGATION**
(single button, no confirmation maze). Effective before the next authorization
attempt observes it — durable, restart-safe, and the delegation can never be
reactivated afterward (a brand new delegation with a fresh strong approval is
required to grant authority again).

Use this when: one specific delegation is misbehaving or was granted in error, and
everything else (other delegations, ordinary Controlled Actions, the rest of the
system) should keep working normally.

## 2. Kill switch (broad, immediate, reused from Phase 5G)

```bash
npm run personal-os -- actions lockdown
```

Or the existing Phase 5G kill-switch API/UI. This blocks **every** Controlled
Action — delegated or human-approved, for every delegation and every project — at two
independent enforcement points: before any new proposal is created, and again inside
`ControlledActionService.execute()` itself. **No delegation, however broadly scoped,
can ever bypass this.**

Use this when: the concern is systemic (e.g. suspected policy misconfiguration,
suspected compromise, or any doubt about whether a *specific* delegation is the sole
cause) rather than isolated to one delegation.

## After either action

1. Confirm no further `delegation.execution.authorized` events appear in
   `delegation evidence <id>` (or, for the kill switch, in any delegation's evidence)
   after the timestamp you took action.
2. Confirm `action_executions` row count for the affected proposal(s) did not increase
   further (`SELECT COUNT(*) FROM action_executions WHERE proposalId = ?`).
3. Investigate root cause using `delegation evidence <id>` — every decision, including
   denials, is recorded with its exact reasons.
4. Do not re-enable the kill switch or reactivate a revoked delegation until root
   cause is understood. A revoked delegation cannot be reactivated by design; a
   kill-switch disable is an explicit, separate Phase 5G action, never automatic.
