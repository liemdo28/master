# Phase 5D-2 — Retrieval Architecture Audit

Performed before any Phase 5D-2 code was written, against `origin/master` at
`5d3417022d2f7bfcd2ef864f3fbc1585c0ba2d94` (the merged Phase 5D-1 foundation), in a clean
worktree at `codex/phase5d2-index-retrieval`. Scope: locate every existing search, ranking,
FTS5 and citation mechanism in the repository and decide, for each, whether Phase 5D-2 reuses
it, adapts it, or ignores it — then name the one canonical implementation for each of the four
required components.

## Candidates examined

### 1. `server/src/knowledge/knowledge-db.ts` — Executive Knowledge DB

A single global SQLite FTS5 index (`.local-agent-global/knowledge-db/knowledge.db`, table
`docs` + `docs_fts`) built for whole-workspace search: `fullIngest()` walks `MASTER_ROOT` and
`knowledge/packs/`, `ingestDirectory()` recurses up to 2,000 files with no approval gate, no
secret scan, and no project scoping. Rows are whole-file snapshots (first 2KB stored), keyed by
a non-cryptographic `simpleChecksum`. `search()` runs a single FTS5 `MATCH` and returns `rank`
from SQLite's built-in bm25-derived ordering — no layered signals, no ACTIVE/STALE concept, no
per-project isolation, and `file_path` can appear in results verbatim.

**Classification: IGNORE for Phase 5D-2's index, retrieval, and citation contracts.** It
structurally cannot satisfy this phase's requirements — chunk-level citation with exact source
ranges, project isolation, ACTIVE-only default retrieval — because its unit of storage is a
whole file, not a heading-addressed chunk, and it has no security gate at all. Phase 5D-1 already
classified it **ADAPT** for its FTS5 *technique* (virtual table + `unicode61 remove_diacritics 2`
tokenizer); Phase 5D-2 reuses that same technique in a brand-new table, never this one. Its
`ingestDirectory`/`fullIngest`/`clearAndRebuild`/`search` entry points are not called from any
Phase 5D-2 code, exactly as Phase 5D-1 left them for their existing consumers (cron scheduler,
enterprise brain, skill registry).

### 2. `server/src/knowledge-federation/index.ts` — Knowledge Federation

Fans a query out to seven sources (`knowledge-db`, executive memory, project registry,
connector caches, reports, workflows, US compliance) and merges them by a crude term-overlap
`scoreMatch()` (word-hit ratio + exact-phrase bonus — not the layered high/medium/low signal
model §5 requires). `retrieveWithCitations()` produces a **display string**
(`[1] Title — source (date)`), not a structured, checksum-bearing `Citation`. It has no concept
of `DocumentStatus`, no ACTIVE-only filtering, and several of its sources
(`searchReports`, `searchProjectRegistry`) read arbitrarily from `MASTER_ROOT`, i.e. the whole
workspace — the opposite of Phase 5D-1's approved-root containment.

**Classification: IGNORE for Phase 5D-2's retrieval and citation code.** This module remains
the correct federation surface for its *existing* callers, which need a fast, approximate,
cross-domain nudge, not certified citations. Phase 5D-2's `Citation` and `KnowledgePack` types
are new and are never constructed by this file. Its "always return a display citation" habit is
noted as the wrong shape and deliberately not repeated.

### 3. `server/src/knowledge/compliance-retrieval.ts` — US Compliance DB retrieval

Keyword-scored search over a separate legal/compliance markdown corpus
(`reference-brain/us-business-compliance/`), jurisdiction- and domain-keyed. Entirely different
data domain (public US regulatory text, not personal/project documents); its scoring
(`scoreDocument`) is again flat term-frequency, no chunk/citation contract.

**Classification: IGNORE.** No overlap with Phase 5D document knowledge; not a retrieval or
citation candidate.

### 4. Other `rank`/`score`/`fts`/`bm25` matches across `server/src`

A repo-wide grep for those terms surfaces ~70 files (SEO backlink scoring, financial
store-ranking, executive council voting, skill-trust scoring, keyword clustering, etc.). All are
domain-specific ranking for unrelated subsystems (SEO, accounting, council consensus) and share
no code, table, or contract with document retrieval.

**Classification: IGNORE**, not further enumerated — none are knowledge-retrieval candidates.

## Canonical selections for Phase 5D-2

| Component | Canonical implementation | Location |
|---|---|---|
| Structural index | `knowledge_chunks_fts` — a new, standalone FTS5 virtual table (own storage, not external-content) over chunk text/heading/tags, tokenizer `unicode61 remove_diacritics 2` (same technique as `knowledge-db.ts`, new table). Kept in sync by explicit add/remove calls inside the *same* transaction as document activation/supersession/status-change in `store.ts` — never a full rebuild. | `server/src/personal-os/documents/store.ts` (schema v5) |
| Retrieval service | `KnowledgeRetrievalService` | `server/src/personal-os/documents/retrieval.ts` (new) |
| KnowledgePack builder | `buildKnowledgePack()` — the only code path allowed to assemble a `KnowledgePack` | `server/src/personal-os/documents/retrieval.ts` (new) |
| Citation formatter | `buildCitation()` — the only code path allowed to construct a `Citation` | `server/src/personal-os/documents/citations.ts` (new) |

Rationale for a *new* FTS5 table rather than external-content-over-`knowledge_chunks`: chunk
rows persist on disk even while their document is `STALE`/`SUPERSEDED` (superseded chunks are
deleted, but stale ones are not), so index membership cannot be derived from `knowledge_chunks`
existence alone — it must track `knowledge_documents.status`. A standalone FTS5 table populated
by explicit, transactional add/remove calls (not SQL triggers spanning two tables) makes that
membership rule an explicit, testable operation instead of implicit trigger logic, and keeps
indexing "incremental, never a full rebuild" per §2's requirement.

## Reconciling with Phase 5B `KnowledgeRecord`

Phase 5B's `KnowledgeRecord`/`MemoryPack` (`server/src/personal-os/store.ts`) is the
personal-preference/decision memory layer — short structured facts the owner has stated, not
parsed document chunks. It is a distinct system from Phase 5D's `DocumentRecord`/`DocumentChunk`
and remains so in Phase 5D-2. `KnowledgeQuery`/`KnowledgePack` (new in this phase) are named
independently of Phase 5B's `MemoryPack` and query only the Phase 5D document/chunk tables;
Phase 5D-2 does not merge, query, or cite Phase 5B records.

## §27 real-project acceptance — access path confirmed

Both real projects the directive names besides Mi Core exist on this machine:
`D:\Project\Mi-Academy-System\mi-academy` and `D:\Project\Mi-core-system\Master\healthy-ld`.
Neither is registered in the Personal OS Project Registry (`GET /api/projects` currently returns
only `mi-core`), so `path-policy.ts`'s `projectRoots` branch (sourced from
`ProjectRegistryService.listProjects()`) does not cover them and no registry change is planned
for this phase. Instead, per-project real-project acceptance uses the same mechanism already
exercised in Phase 5D-1 live acceptance: `MI_DOCUMENT_ROOTS` (env-configured `documentRoots`,
read-only, reversible, unregistered) pointed at each project's approved documentation
subdirectory (README/architecture/deployment/ADRs/runbooks only), combined with
`IngestRequest.projectIds` — which is caller-supplied and merged with the resolved root's project
id in `service.ts::ingestApprovedDocument` — to explicitly tag ingested chunks with
`mi-academy` / `healthy-ld` project ids for isolation testing. This requires no Project Registry
mutation and no change to the dirty live checkout.
