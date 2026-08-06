# Phase 5D-2 — conflict and staleness policy

## Staleness

Unchanged from Phase 5D-1's detection (`KnowledgeDocumentService.refreshStaleness`:
missing file, changed size, changed checksum, or a newer parser version marks a document
`STALE`), extended in Phase 5D-2 with a retrieval-time policy:

- **Excluded by default.** `DocumentStore.searchChunks` only returns chunks whose owning
  document is `ACTIVE` unless the caller passes `includeStale: true`.
- **`includeStale` is explicit, per-query, never a default.** `KnowledgeQuery.includeStale`
  defaults to `false`; there is no global setting that changes this.
- **Live state outranks stale content, even when both are shown.** `scoreCandidate`
  applies a `−4` penalty to a `STALE` document's chunks — large enough that an `ACTIVE`
  document on the same topic always ranks above it, while a `STALE` document that is the
  *only* match is still returned (the top-ranked candidate is never dropped by the
  relevance floor), with `isStale: true` on its `KnowledgePackItem`.
- **Reindexing a changed source marks the old version `SUPERSEDED`**, not `STALE` — this
  is Phase 5D-1 behaviour, unchanged: `KnowledgeDocumentService.reindex` /
  `ingestApprovedDocument` calls `DocumentStore.supersede`, which sets the old document's
  status to `SUPERSEDED`, deletes its chunks (and their FTS rows), and activates the new
  version in the same transaction.
- **`SUPERSEDED` and `DELETED` are never retrievable, `includeStale` or not.** Both
  states already have their chunks physically removed by Phase 5D-1's own lifecycle
  methods, so there is nothing left in `knowledge_chunks_fts` to exclude at query time —
  the leakage suites (`test:knowledge-index`, `test:knowledge-retrieval-evaluation`)
  assert `deletedSupersededLeaks=0`.

## Conflicts

A conflict is raised only by an explicit scan (`scanForConflicts`, via
`POST /knowledge-documents/conflicts/scan` or `docs scan-conflicts`), never automatically
on ingestion. Detection (`conflicts.ts::detectConflicts`) is narrow and explainable: two
`ACTIVE` chunks from *different* documents asserting a different value for what looks
like the same labelled fact (`key: value`, `key = value`, `key is value`). Same-document
repetition and full agreement across documents are not conflicts.

```
ConflictStatus = OPEN | NEEDS_CONFIRMATION | RESOLVED | DISMISSED
```

- New candidates are created `OPEN`.
- `updateConflictStatus` moves a conflict to `NEEDS_CONFIRMATION`, `RESOLVED` or
  `DISMISSED`, optionally with a `resolutionNote`; `resolvedAt` is set only for
  `RESOLVED`/`DISMISSED`.
- **Nothing in this phase resolves a conflict automatically.** Retrieval attaches an
  unresolved conflict to any `KnowledgePack` that returns a chunk named in it
  (`KnowledgePack.conflicts`) rather than silently preferring one side — this is checked
  directly in `phase5d2:acceptance` and `test:knowledge-conflicts`.
- **Conflict identity is the exact chunk-id set involved**, and chunk ids are
  content-hash-derived. Rescanning never duplicates an already-raised conflict, in *any*
  status — a human who resolved "30s is correct" is not asked again every scan — but a
  genuine content change (which mints new chunk ids) is free to raise a fresh conflict.

## Relations

`KnowledgeRelation` is a lightweight edge table, not a graph database — one row per
`(fromChunkId, toChunkId, relationType)`, written `INSERT OR IGNORE` so rescanning is
idempotent. Ten types, each derived deterministically:

| Type | Derivation | Confidence |
|---|---|---|
| `SUPERSEDES` / `SUPERSEDED_BY` | Version history (`document.supersedesId`), anchored on each document's first chunk | 1 (exact) |
| `PART_OF` / `CONTAINS` | Heading-path nesting within one document | 1 (exact) |
| `DUPLICATES` | Identical normalised text across two different documents | 1 (exact) |
| `REFERENCES` / `REFERENCED_BY` | A chunk's text literally names another active document's title | 0.7 (heuristic) |
| `RELATED_TO` | Same project, shared tag or section title, different documents | 0.5 (heuristic) |
| `CONTRADICTS` / `CONTRADICTED_BY` | Minted alongside a detected conflict, one pair per conflicting chunk pair | 1 (exact, by construction) |

Relation scans (`scanForRelations`) respect the same project scope as everything else in
this phase — a relation is never derived across a project boundary the caller did not
name.
