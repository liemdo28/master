# Phase 5I Rollback

**Delegation cannot override Phase 5G DENY. Delegation cannot override a kill switch.
Delegation cannot increase a budget. Delegation expires.** Rollback never has to
unwind an authorization that shouldn't have existed — every delegated execution that
ever occurred was already independently valid under Phase 5F/5G at the moment it ran.

## If deployment needs to be reverted before v10 migration runs

Revert to the pre-Phase-5I build (deployed Phase 5H SHA `206ca71279574574d70b7708ea4eaaec652cd5ac`
or later) and restart `mi-core`. The database is still schema v9; nothing to undo.

## If the v10 migration has already run

Additive only — five new tables, no altered column on any pre-existing table, no
altered row. Rolling back application code to a pre-Phase-5I build is safe with the
v10 schema still present: the old code never queries `delegated_authorities` or its
sibling tables, so their existence is inert.

If a clean schema rollback is specifically required (not merely a code rollback):

1. Stop `mi-core`.
2. Take a fresh backup of `personal-os.db`.
3. Drop the five `delegation_*`/`delegated_authorities` tables and the `version = 10`
   row from `schema_migrations`.
4. Restart on the pre-Phase-5I build.

Manual, explicit, matches the same posture as every prior phase's schema rollback.

## If an active delegation needs to stop immediately during an incident

Prefer `delegation revoke <id>` (see
[`PHASE5I_EMERGENCY_REVOKE.md`](PHASE5I_EMERGENCY_REVOKE.md)) over a code rollback —
it takes effect immediately, is durable, and does not require restarting anything.

## What rollback never needs to touch

- The kill switch, budgets, and policy engine are Phase 5G state, untouched by Phase
  5I code or migration.
- No OAuth scope was added or changed.
- No new external action type was introduced, so there is nothing external-system-side
  to unregister.
- Any Controlled Action a delegation ever authorized used the exact same execution
  path, ledger, and idempotency guarantees as a human-approved one — there is no
  separate "delegated execution" record type to reconcile or reverse.
