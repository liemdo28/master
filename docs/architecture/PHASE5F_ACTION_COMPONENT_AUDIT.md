# Phase 5F Action Component Audit

Source baseline: `6f277ef03498018c2ec106c513706a484c0c5a52`

## Canonical Choices

| Concern | Canonical component |
| --- | --- |
| ActionProposal store | `server/src/personal-os/actions/store.ts` |
| Approval path | `ControlledActionService.approve()` via `/api/actions/:id/approve` and `/api/command-center/actions/:id/approve` |
| Execution service | `ControlledActionService.execute()` |
| Evidence/audit trail | `action_evidence` append-only events in Personal OS DB v7 |
| Rollback/compensation | `action_compensations`, one honest compensation policy per action type |

No second task runtime was created. Phase 5F is an additive Personal OS action layer.

## Mutation-Capable Components

| Component | Existing capability | Classification | Phase 5F decision |
| --- | --- | --- | --- |
| `server/src/routes/actions.ts` | Legacy Gmail/Drive/file/Excel/Word action router | DEPRECATE | Not mounted for Phase 5F controlled paths. Replaced by controlled-action router for `/api/actions`. |
| `server/src/actions/action-router` and adapters | Generic provider action dispatch | DEPRECATE | Not used by Phase 5F first slice because it can hide provider writes behind generic routing. |
| Gmail intelligence Phase 5C | Read/search/thread context | KEEP | Read-only context remains source evidence. Draft write goes through `GMAIL_CREATE_DRAFT` only. |
| Google Calendar Phase 5C | Read-only calendar/agenda/free-busy context | KEEP | Calendar proposals use this as evidence; writes stay behind `CALENDAR_CREATE_EVENT`. |
| `server/src/personal-os/operating/*` | Daily plan status mutation only | KEEP | Plan approvals remain local and do not execute tasks. |
| `server/src/task-runtime/*` | Approval-bounded task state machine | KEEP | Phase 5F does not bypass it; coding approval remains local R1 only. |
| `server/src/routes/coding.ts` | Coding task proposal/approval/execution surface | ADAPT | May propose `CODING_TASK_APPROVAL`; push/merge/deploy remain forbidden. |
| `server/src/ceo-command-center/index.ts` | Objective approve can execute plan | DEPRECATE | Not a Phase 5F external-write path; should be migrated to ActionProposal before any external side effect. |
| `server/src/gstack/skills/skill-registry.ts` | Skills include pm2 restart, GitHub write, Gmail send, calendar write, SEO publish | DEPRECATE | Not wired into Phase 5F. Future migration must wrap each side effect as a proposal. |
| WhatsApp review approval routes | Review-command approval callbacks | ADAPT | Not in first slice. Any send/approval commands must bind payload hash before external write. |
| Notification senders | WhatsApp/briefing notification candidates | IGNORE | No Phase 5F notification send capability implemented. |
| Deployment helpers | deploy scripts, n8n, SEO publish, GitHub push/merge | DEPRECATE | R4/broad deployment remains forbidden. |
| Local file writes in document/knowledge tests | Local fixture and approved workspace writes | KEEP | R1 only, scoped to approved workspace/test fixtures. |
| Shell execution helpers | maintenance/test execution | DEPRECATE for user actions | Shell execution is not exposed as a controlled external action in Phase 5F. |
| External HTTP action adapters | connector/proxy calls | DEPRECATE | External writes require a typed ActionProposal and connector capability check. |

## First Slice Implemented

- `GMAIL_CREATE_DRAFT` as R2, fixture provider by default, no send.
- `CALENDAR_EVENT_PROPOSAL` as R1, local only.
- `CALENDAR_CREATE_EVENT` as R3, fixture/sandbox gated and conflict-checked.
- Local action contracts are represented, but no broad file/shell/deploy capabilities are exposed.

## Explicitly Not Implemented

- Gmail send.
- Calendar update/delete.
- Money, legal, credential, account, broad delete, merge, deploy, destructive infrastructure, bulk messaging.
- Autonomous chains.
- Voice or desktop operator.
