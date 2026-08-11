# Phase 5H Threat Model

**Plan approval is not external-action approval. Phase 5H cannot authorize an action
that Phase 5G would deny. Phase 5H introduces no new external action type.** Every
threat below is evaluated against those three invariants.

## Threats and Mitigations

| Threat | Mitigation |
|---|---|
| Plan approval treated as action approval | No `approve()` method exists on the orchestration service for Controlled Action steps; only `ControlledActionService.approve()` can approve, unchanged from Phase 5F. |
| Approval crossing steps | Each Controlled Action step gets its own proposal with its own payload hash; approving one never marks another approved. |
| Approval crossing plan versions | `createNewVersion()` resets every step's `proposalId` to `null`; the old version's open proposals are rejected. |
| Bypassing `ActionPolicyEngine` | Orchestration calls the same `ControlledActionService.propose/approve/execute` path as any other caller; no parallel policy check exists. |
| Bypassing the kill switch | Checked both before proposal creation and inside `execute()`, reused unmodified from Phase 5G. |
| Bypassing budgets | Budget reservation happens inside `execute()`'s existing transactional path; orchestration never reserves or bypasses budget itself. |
| Duplicate external execution | `execute()`'s pre-existing idempotency-key check (`action_executions.idempotencyKey` unique index) returns the existing execution on replay; proven under concurrent `Promise.all` calls. |
| Restart auto-executing a `WAITING_APPROVAL` step | Restart only re-reads persisted state; `advance()` re-polls the underlying proposal's real status and never assumes approval. |
| New external action type introduced | `ORCHESTRATION_ALLOWED_ACTION_TYPES` is a closed set of 3 pre-existing Phase 5F types; `createPlan`/`createNewVersion` reject anything else before a step can exist. |
| Gmail SEND reachable via a plan | Rejected twice over: `GMAIL_SEND_DRAFT` is outside `ORCHESTRATION_ALLOWED_ACTION_TYPES`, and independently hard-blocked at execution by pre-existing Phase 5F code. |
| Financial/legal/credential/merge/deploy action reachable | No such action type exists anywhere in the Controlled Actions type system; unreachable from orchestration by construction. |
| Secret leakage via plan evidence | Evidence detail JSON is scanned for API-key/PEM-header patterns in `orchestration-security.test.ts`; same discipline as Phase 5F/5G evidence. |
| Silent plan mutation after execution starts | Any structural change requires a new plan version (§9); the running version's steps/dependencies are immutable once saved. |

## Security Tests

- `npm run test:orchestration-security`
- `npm run test:orchestration-migration`
- `npm run test:orchestration-restart`
- `npm run test:orchestration-concurrency`
- `npm run test:orchestration-evaluation`
