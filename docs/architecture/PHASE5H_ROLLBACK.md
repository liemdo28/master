# Phase 5H Rollback

**Plan approval is not external-action approval. Phase 5H cannot authorize an action
that Phase 5G would deny. Phase 5H introduces no new external action type.** Rollback
never has to unwind an authorization that shouldn't have existed — only orchestration
bookkeeping.

## If deployment needs to be reverted before v9 migration runs

Revert to the pre-Phase-5H build (`36c77fa945337f1f4dcf8afd24a3dd66dbe6762b` or later
Phase 5G master) and restart `mi-core`. The database is still schema v8; nothing to
undo.

## If the v9 migration has already run

The migration is additive only — six new tables, no altered or dropped column on any
Phase 5F/5G table, no altered row. Rolling back application code to a pre-Phase-5H
build is safe with the v9 schema still present: the old code never queries the new
`action_plan*` tables, so their existence is inert.

If a clean schema rollback is specifically required (not merely a code rollback):

1. Stop `mi-core`.
2. Take a fresh backup of `personal-os.db`.
3. Drop the six `action_plan*` tables and the `version = 9` row from
   `schema_migrations`.
4. Restart on the pre-Phase-5H build.

This is a manual, explicit step — no code path in this repository does it
automatically, by design, matching the same posture as every prior phase's schema
rollback (see `PHASE5G_ACTION_GOVERNANCE.md`'s "no downgrade" migration proof).

## If a plan or proposal needs to be stopped mid-flight

- `plan-action cancel <planId> "<reason>"` rejects every still-open Controlled Action
  proposal sourced from that plan and marks the plan `CANCELLED`. This uses the
  pre-existing `ControlledActionService.reject()` path — no new rejection mechanism.
- Cancelling a plan never reverses an already-`COMPLETED` step's external side effect.
  Compensation (e.g. deleting a created Gmail draft) is its own separate,
  separately-approved Controlled Action, exactly as in Phase 5F — orchestration does not
  add or shortcut compensation.

## What rollback never needs to touch

- The kill switch, budgets, and policy engine are Phase 5G state, untouched by Phase 5H
  code or migration.
- No OAuth scope was added or changed.
- No new external action type was introduced, so there is nothing external-system-side
  to unregister.
