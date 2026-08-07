# Phase 5D-3 — rollback

## The short version

Additive, same as every prior phase in this database. Deploying the previous build
against a v6 database works: Phases 5A–5D-2 read only their own tables and ignore the six
new ones. Reverting the code is sufficient; the database needs no downgrade.

## Reverting the code

Restore the timestamped `dist` backup taken before deployment from
`D:\mi-core-pm2-backups\`, replace `server/dist`, and restart only `mi-core`. No other PM2
process is involved — this phase adds no new PM2 process and no new cron/scheduler
registration.

## If the database must also be restored

Only necessary if a migration is suspected of damage — which the production-copy proof
(this document's companion, referenced from `PHASE5D3_DAILY_OPERATING_LOOP.md`) did not
observe.

1. Stop `mi-core`.
2. Move the current database file aside; keep it, do not delete it.
3. Restore the pre-migration backup using `documents/backup.ts::restoreFromBackup`, which
   copies the backup into place and removes any stale `-wal`/`-shm` files.
4. Start `mi-core`.
5. Verify `GET /api/personal/integrity` reports `integrityCheck: ok` and the expected
   schema version.

## Removing Phase 5D-3 tables without a restore

Supported, because nothing in Phases 5A–5D-2 references them. Take a backup first
(`backupDatabase`), then drop, in any order: `daily_operating_briefs`, `daily_plans`,
`daily_refreshes`, `end_of_day_reviews`, `weekly_operating_reviews`,
`operating_loop_runs`. Delete the row for version 6 from `schema_migrations`.

Nothing else is lost: every table from Phase 5A through 5D-2 is untouched by any of the
above. The operating loop's API/CLI surface would start failing on its next call (the
tables it reads no longer exist) until Phase 5D-3 code is redeployed and the migration
re-runs, which recreates them empty — nothing is backfilled, because nothing here is
derived from another table; a brief, plan, refresh, or review that existed before the
tables were dropped is gone for good once this path is taken.

## What rollback does not undo

Nothing outside the database. Every `DailyOperatingBrief`/`DailyPlan`/`DailyRefresh`/
`EndOfDayReview`/`WeeklyOperatingReview`/`operating_loop_runs` row is a disposable,
regenerable read model — none of it is a system of record for anything outside this
phase. A `DailyPlan.status` of `APPROVED` is a local status column only; it never
transitioned a Task Runtime task, so rolling back this phase leaves Task Runtime's own
state (which is a system of record) completely unaffected. Phase 5D-3 never writes to
Gmail, Calendar, the filesystem outside its own database, or any external service, so
there is nothing external to undo.

## What was never enabled, and remains never enabled after any rollback

Voice, desktop control, email sending, calendar writes, autonomous push/merge/deploy,
autonomous browsing, and multi-agent orchestration were not implemented in Phase 5D-3 and
are not touched by rolling it back — there is no flag to flip either direction, because
the code paths that would perform any of them do not exist in this phase.
