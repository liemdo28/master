# Phase 5D — batch plan

Phase 5D is delivered in four batches, each ending with green gates and one reviewable
PR. The boundaries follow the original commit plan.

## 5D-1 — Foundation *(this batch)*

Document and chunk schema at v4, proven migration from a production copy, approved-root
path policy, secret scanner, five working parsers, deterministic chunking, staged
ingestion with recovery, staleness and versioning, minimal API and CLI, three test
suites, docs.

Gates: `test:knowledge-migration`, `test:document-security`, `test:document-ingestion`.

## 5D-2 — Index and retrieval

SQLite FTS5 index inside the Personal OS database, `KnowledgeQuery` and `KnowledgePack`,
the citation contract, incremental re-indexing, relations and the conflict engine, plus
the measured retrieval evaluation (30 queries, 6 projects) against its stated targets.

Gates: `test:knowledge-index`, `test:knowledge-citations`, `test:knowledge-conflicts`.

## 5D-3 — Daily operating loop

`DailyOperatingBrief`, `DailyPlan`, `EndOfDayReview`, extended weekly review,
task-creation policy, operating APIs and CLI.

Gates: `test:daily-operating-loop`, fixture acceptance.

## 5D-4 — Scale, backup, real acceptance

Scale testing to 1,000 documents and 10,000 chunks, backup and restore with manifest and
checksum verification, real acceptance on Mi Core, Mi Academy and Healthy-LD, remaining
documentation.

Gates: `test:knowledge-scale`, `test:knowledge-backup`, `phase5d:acceptance`.

## Deliberately deferred

No embeddings or vector database until structural retrieval is *measured* to fail. The
existing `memory/qdrant-client.ts` has zero importers and stays unused.

## Carried blocker

PDF ingestion is unavailable until `pdf-parse` is installed — the existing
`data-analyst/pdf-extractor` depends on it. Phase 5D-1 returns a controlled
`PARSER_UNAVAILABLE` rather than pretending to support PDFs.
