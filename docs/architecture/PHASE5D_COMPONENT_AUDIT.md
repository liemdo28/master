# Phase 5D — component audit

**Audited at:** master `8628975c7af7b6cb57387c0a7f3a62f370025ddf`
**Production:** deployed marker matches master · Personal OS schema **v3** · 9/9 PM2 online
**Phase 5D on master:** absent (0 files)

The point of this audit is to stop Phase 5D becoming a fourth knowledge system. The
repository already contains **three** overlapping document/knowledge stacks plus an
unused vector client. Every decision below is based on what is actually wired at
runtime, not on what the file names suggest.

## Runtime wiring — the decisive evidence

| Component | Mounted in `index.ts` | Imported by live code | Verdict basis |
|---|---|---|---|
| `knowledge/knowledge-db.ts` | **yes** | `cron/sync-scheduler`, `enterprise-v6/enterprise-brain-v4`, `gstack/skills/skill-registry`, `index.ts` | live, SQLite **FTS5** |
| `knowledge/pack-manager.ts` | **yes** | `index.ts` | live |
| `routes/knowledge`, `routes/memory` | **yes** | `index.ts` | live |
| `knowledge-federation/index.ts` | no | `company-os/departments`, `company-os/execution-pipeline`, `pipeline/response-pipeline` | live indirectly; already emits citations |
| `jarvis/phase21-knowledge/knowledge-indexer.ts` | no | `jarvis/phase30-jarvis/jarvis-core`, `routes/jarvis` | live indirectly; in-memory + JSON |
| `data-analyst/file-ingestion-service.ts` | no | — | dormant, but owns real parsers |
| `bigdata/search-service.ts`, `bigdata/memory-indexer.ts` | no | — | dormant |
| `memory/qdrant-client.ts` | no | **no importers at all** | dead |
| `intelligence/context-memory.ts`, `memory2/store-context.ts` | no | — | dormant |
| `personal-os/store.ts` (PersonalOsStore) | **yes** | Phase 5A/5B/5C | canonical Personal OS store, schema v3 |
| `intelligence/store.ts` (IntelligenceStore) | **yes** | Phase 5C | canonical derived-record store |

## Classification

| Component | Decision | Reason |
|---|---|---|
| `personal-os/store.ts` | **KEEP** | Canonical Personal OS DB at schema v3. Phase 5D extends it; no second database. |
| `intelligence/store.ts` | **KEEP** | Canonical derived-record store (agenda, review, follow-ups). Operating loop extends it. |
| `knowledge/knowledge-db.ts` | **ADAPT** | The only live SQLite **FTS5** index. Reuse the FTS5 mechanism; do **not** reuse its ingestion entry points (see conflict below). |
| `knowledge-federation/index.ts` | **MERGE** | Already federates sources *with citations*. Its citation shape informs the Phase 5D `Citation` contract; its federation role is superseded by one canonical retrieval entry point. |
| `data-analyst/{pdf-extractor,word-extractor,csv-reader,excel-reader}.ts` | **ADAPT** | Working extractors already exist. §5 says use existing PDF text extraction — reuse these rather than adding parser dependencies. |
| `data-analyst/file-ingestion-service.ts` | **ADAPT** | Useful extractor orchestration; dataset-catalog side effects are out of scope for Phase 5D. |
| `jarvis/phase21-knowledge/knowledge-indexer.ts` | **DEPRECATE** | Second document index, in-memory with JSON persistence, no provenance or chunking. Still referenced by Jarvis routes, so leave in place and do not extend. |
| `bigdata/search-service.ts`, `bigdata/memory-indexer.ts`, `bigdata/ingestion-service.ts` | **IGNORE** | Not wired; belongs to the BigData/MinIO stack, unrelated to Personal OS. |
| `memory/qdrant-client.ts` | **DEPRECATE** | **Zero importers.** Confirms §8 — no vector database is in use, and none will be added by default. |
| `intelligence/context-memory.ts`, `memory2/store-context.ts` | **IGNORE** | Dormant; unrelated to the Phase 5C intelligence module that shares the directory name. |
| `operational-memory/*`, `executive-intelligence/*`, `memory/executive-memory.ts` | **IGNORE** | Live but serving the CEO/ops layer. Not made canonical for personal knowledge. |
| `coding/retrieval`, `coding/ast-edit`, project maps, resume context | **KEEP, untouched** | Frozen coding engine. Code knowledge continues to come from Project Registry + symbol context, per §5. |
| `actions/file-search.ts` | **IGNORE** | Ad-hoc filesystem search with no approval boundary. |

## Canonical selections

- **Document ingestion entry point:** new `personal-os/documents/ingest.ts` — the single gate. Existing bulk entry points are not reused.
- **Knowledge index:** SQLite FTS5 inside the **Personal OS database** (schema v4), reusing the FTS5 approach proven by `knowledge/knowledge-db.ts`.
- **Retrieval entry point:** new `buildKnowledgePack()`, alongside Phase 5B `searchKnowledge`/`buildMemoryPack`.
- **Daily operating-loop service:** extends the Phase 5C `IntelligenceService`.

## The blocking conflict this audit found

`knowledge/knowledge-db.ts` exports:

```ts
ingestDirectory(rootDir, source?, maxFiles = 2000)
fullIngest()
clearAndRebuild()
```

These are exactly the **"ingest everything" patterns §2 and §13 forbid**. The existing
live index has:

- no approval gate — a directory root is ingested wholesale up to 2,000 files
- no secret scanning before persistence
- no project scoping or per-record sensitivity
- no chunking, so no chunk-level provenance
- a `docs` table only, so **no citation can name a section, page or line range**

Phase 5D's citation contract (§10) and privacy rules (§6, §25) cannot be satisfied by
extending those entry points. The FTS5 *mechanism* is sound and worth reusing; the
*ingestion surface* is not. Phase 5D therefore adds a new gated ingestion path and a
chunk table with provenance, and leaves `knowledge-db.ts` untouched for its existing
consumers rather than rewriting a live dependency of the cron scheduler, enterprise
brain and skill registry.

## Constraints carried into implementation

- Extend Personal OS DB **v3 → v4**; migration from production v3 must be proven before merge.
- No vector database. Qdrant is dead code and stays dead unless structural retrieval is *measured* to fail (§8).
- No second Personal OS database.
- Phase 5C read-only capability boundary, OAuth scopes and the frozen coding engine are untouched.
- Ingestion only inside registered project roots, configured document roots, or explicitly approved single files (§14).
