# Phase 5D-1 — rollback

## The short version

Phase 5D-1 is **additive**. Deploying the previous build against a v4 database works:
Phases 5A/5B/5C read only their own tables and ignore the four new ones. Reverting the
code is therefore sufficient and the database needs no downgrade.

## Reverting the code

Restore the timestamped `dist` backup taken before deployment from
`D:\mi-core-pm2-backups\`, replace `server/dist`, and restart only `mi-core`. No other
PM2 process is involved.

## If the database must also be restored

Only necessary if a migration is suspected of damage — which the production-copy proof
did not observe.

1. Stop `mi-core`.
2. Move the current database file aside; keep it, do not delete it.
3. Copy the pre-migration backup into place, including any `-wal` and `-shm` files.
4. Start `mi-core`.
5. Verify `GET /api/personal/integrity` reports `integrityCheck: ok` and the expected
   schema version.

## Removing Phase 5D tables without a restore

Supported, because nothing in Phases 5A–5C references them. Take a backup first, then
drop `knowledge_chunks`, `knowledge_document_projects`, `knowledge_ingestion_jobs` and
`knowledge_documents`, and delete the row for version 4 from `schema_migrations`. Drop
the chunk and link tables before the document table, since both reference it.

Documents would need re-ingesting afterwards; no other data is lost.

## What rollback does not undo

Nothing outside the database. Phase 5D-1 reads source files and never writes to them,
never contacts an external service, and never sends anything.
