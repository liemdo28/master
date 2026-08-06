# Phase 5D-1 — migration v3 → v4

## What changes

Additive only. Four tables are created inside the **existing** Personal OS database:
`knowledge_documents`, `knowledge_document_projects`, `knowledge_chunks`,
`knowledge_ingestion_jobs`. No v3 table is altered, renamed or dropped.

WAL and foreign keys are enforced on open. Indexes cover document status, checksum,
canonical path, supersession, source modified time, chunk `(documentId, ordinal)`, chunk
content hash, job status and job document. A unique index keeps one live document per
canonical path (`ACTIVE`/`INDEXING`/`STALE`), and `(documentId, contentHash)` is unique
so a chunk cannot be stored twice.

The migration runs inside a transaction and is idempotent: a second run applies nothing.

## Production-copy proof

Run against a copy of the live database, never the original:

```
source      .local-agent-global/personal-os/personal-os.db   200,704 bytes, schema v3
copy        SQLite online backup API (consistent, no process stopped)
migration   from 3 -> to 4, applied true; second run applied false
integrity   integrity_check = ok, foreign_key_check = 0, journal_mode = wal
```

Row counts preserved exactly across all 12 v3 tables:

| table | rows | table | rows |
|---|---|---|---|
| connector_sync_state | 2 | plan_operations | 2 |
| daily_agendas | 1 | preferences | 2 |
| daily_briefs | 1 | priority_items | 10 |
| follow_up_candidates | 1 | weekly_reviews | 1 |
| goal_events | 6 | knowledge_records | 7 |
| goals | 2 | schema_migrations | 3 -> 4 |

`schema_migrations` is the one table that grows: it gains exactly the v4 row.

The migrated copy was then read back through the original APIs — `PersonalOsStore`
returned its goals and knowledge records, `IntelligenceStore` returned the stored agenda,
follow-up and connector sync state. `listPreferences()` returns 0 because both production
preferences already carry status `DELETED`; the rows are present and untouched.

**Production was not modified**: the live database remained schema v3 with no
`knowledge_documents` table, and the live API continued to report `schemaVersion: 3`.

## Applying it

The migration runs automatically the first time any Phase 5D store opens the database —
there is no separate migration command. Take a backup first, using the SQLite online
backup API so the copy is consistent without stopping the process.

## Rollback

See `PHASE5D_ROLLBACK.md`.
