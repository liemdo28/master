# Phase 5D-2 — rollback

## The short version

Phase 5D-2 is **additive**, same as 5D-1. Deploying the previous build against a v5
database works: Phases 5A–5D-1 read only their own tables and columns and ignore the new
ones. Reverting the code is sufficient; the database needs no downgrade.

## Reverting the code

Restore the timestamped `dist` backup taken before deployment from
`D:\mi-core-pm2-backups\`, replace `server/dist`, and restart only `mi-core`. No other PM2
process is involved.

## If the database must also be restored

Only necessary if a migration is suspected of damage — which the production-copy proof
(`PHASE5D2_MIGRATION.md`) did not observe.

1. Stop `mi-core`.
2. Move the current database file aside; keep it, do not delete it.
3. Restore the pre-migration backup — either the timestamped copy taken manually before
   deploying, or one produced by `backup.ts::backupDatabase` — using
   `backup.ts::restoreFromBackup`, which copies the backup into place and removes any
   stale `-wal`/`-shm` files so the restored file starts clean.
4. Start `mi-core`.
5. Verify `GET /api/personal/integrity` reports `integrityCheck: ok` and the expected
   schema version.

## Removing Phase 5D-2 tables without a restore

Supported, because nothing in Phases 5A–5D-1 references them. Take a backup first
(`backupDatabase`), then:

1. Drop `knowledge_relations` and `knowledge_conflicts` — neither is referenced by
   anything else.
2. Drop `knowledge_chunks_fts` (this also drops its shadow tables:
   `knowledge_chunks_fts_data`, `_idx`, `_content`, `_docsize`, `_config`).
3. `ALTER TABLE knowledge_chunks DROP COLUMN lineStart` and `lineEnd` — SQLite ≥ 3.35
   supports `DROP COLUMN` directly; on an older SQLite, recreate the table without those
   columns instead.
4. Delete the row for version 5 from `schema_migrations`.

Nothing else is lost: `knowledge_documents` and `knowledge_chunks` (Phase 5D-1) are
untouched by any of the above. Search would simply stop working until Phase 5D-2 code is
redeployed and the migration re-runs, which backfills the index from the still-intact
chunk rows.

## What rollback does not undo

Nothing outside the database. Conflict resolutions
(`knowledge_conflicts.resolutionNote`) and derived relations
(`knowledge_relations`) are the only genuinely new state Phase 5D-2 writes; both are
disposable and rebuildable from `knowledge_chunks` by rerunning the scan endpoints —
neither is a system of record for anything outside this phase. Phase 5D-2 reads source
files and never writes to them, never contacts an external service, and never sends
anything.
