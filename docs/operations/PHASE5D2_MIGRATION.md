# Phase 5D-2 — migration v4 → v5

## What changes

Additive only. Two columns are added to the existing `knowledge_chunks` table
(`lineStart`, `lineEnd`, both nullable — existing v4 rows get `NULL`, meaning "cite by
heading path instead," never a false zero), and three tables are created:
`knowledge_chunks_fts` (an FTS5 virtual table), `knowledge_conflicts`,
`knowledge_relations`. No v3 or v4 table is altered, renamed or dropped.

`applyPhase5d2Migration` calls `applyPhase5dMigration` first if the database is still at
v3, so a v3 database migrates straight to v5 in one call — there is no way to open a
Phase 5D-2 store against a v3 database without passing through v4's own checks first.

The migration runs inside a transaction and is idempotent: a second run applies nothing.
It also **backfills** any chunk that predates the FTS table (i.e. was written under v4)
into `knowledge_chunks_fts`, in the same transaction — a targeted backfill of missing FTS
rows, not a full rebuild of the index or a rewrite of unrelated tables.

## Production-copy proof

Run against a copy of the live database, never the original:

```
source      .local-agent-global/personal-os/personal-os.db   schema v4
copy        SQLite online backup API (consistent, no process stopped)
migration   from 4 -> to 5, applied true; second run applied false
integrity   integrity_check = ok, foreign_key_check = 0, journal_mode = wal
```

Row counts preserved exactly across every v4 table:

| table | rows |
|---|---|
| connector_sync_state | 2 |
| daily_agendas | 1 |
| daily_briefs | 1 |
| follow_up_candidates | 1 |
| goal_events | 6 |
| goals | 2 |
| knowledge_chunks | 0 |
| knowledge_document_projects | 0 |
| knowledge_documents | 3 |
| knowledge_ingestion_jobs | 6 |
| knowledge_records | 7 |
| plan_operations | 2 |
| preferences | 2 |
| priority_items | 10 |
| weekly_reviews | 1 |
| schema_migrations | 4 → 5 |

`schema_migrations` is the one table that grows: it gains exactly the v5 row. Specific
row ids in `knowledge_documents` and `goals` were compared before/after and are
byte-identical, not just equal in count. A second migration run against the same copy
reported `applied: false` and changed no row count. The live database's own
`schema_migrations` was re-read after the proof and still reported v4 —
**production was not modified.**

## Applying it

Automatic the first time any Phase 5D store opens the database — there is no separate
migration command. Take a backup first using `server/src/personal-os/documents/backup.ts`
(`backupDatabase`), which wraps the same SQLite online backup API used for this proof.

## Rollback

See `PHASE5D2_ROLLBACK.md`.
