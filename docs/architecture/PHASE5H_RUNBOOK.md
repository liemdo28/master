# Phase 5H Operator Runbook

## Creating and running a plan

```bash
npm run personal-os -- plan-action create < plan.json
npm run personal-os -- plan-action validate <planId>
npm run personal-os -- plan-action start <planId>
npm run personal-os -- plan-action advance <planId>
```

`advance()` only moves plan/step *structure* forward. A `CONTROLLED_ACTION` step that
reaches `WAITING_APPROVAL` stays there — call `advance()` again as many times as you
like, it is a safe no-op — until the underlying proposal is approved through the
existing Controlled Actions surface:

```bash
npm run personal-os -- action approve <proposalId>
```

Then call `plan-action advance <planId>` once more to let orchestration observe the
approval and execute.

## Inspecting a plan

```bash
npm run personal-os -- plan-action show <planId>
npm run personal-os -- plan-action evidence <planId>
```

`show` lists every step's status, dependencies, and `proposalId` (if any). It never
shows an "approve" affordance — that only exists on the Controlled Actions surface. The
Command Center Plans page (`/plans`, `/plans/:id`) mirrors this: it links to `/actions`
for anything `WAITING_APPROVAL` rather than approving inline.

## Pausing, resuming, cancelling

```bash
npm run personal-os -- plan-action pause <planId> "<reason>"
npm run personal-os -- plan-action resume <planId>
npm run personal-os -- plan-action cancel <planId> "<reason>"
```

`cancel` rejects any still-open proposal belonging to the plan before marking it
`CANCELLED`. `resume` never auto-approves a `WAITING_APPROVAL` step — it only makes the
plan eligible for `advance()` again.

## Changing a running plan

Plans do not mutate silently. To change steps or dependencies after `start()`:

```bash
npm run personal-os -- plan-action create < plan-v2.json  # via createNewVersion in code
```

The new version starts every step's `proposalId` at `null`. Re-run `validate` / `start`
/ `advance` on the new version; the old version's approvals do not carry over.

## Idempotent advance under retry

`advance()` accepts `--idempotency-key <key>`. Retrying the same call with the same key
after a timeout is safe — it returns the already-completed run rather than
re-processing steps.

## Diagnosing a stuck plan

1. `plan-action show <planId>` — check step statuses and `proposalId`s.
2. If a step is `WAITING_APPROVAL`, check `action get <proposalId>` for why it isn't
   approved yet (missing approval, expired, budget/kill-switch blocked).
3. If a step is `BLOCKED`, check its `dependsOnKeys` — a failed or cancelled dependency
   blocks permanently; the child step must move to a new plan version to retry.
4. `plan-action evidence <planId>` gives a full append-only timeline of what the
   orchestration layer observed and did, in order.
