# Phase 5D-2 — retrieval architecture

Schema **v5**, additive over Phase 5D-1's document/chunk layer. Adds one structural
index, one retrieval service, one KnowledgePack builder, one citation formatter, a
lightweight conflict engine and a lightweight relation table — no embeddings, no vector
database, no second database.

## Data flow

```
KnowledgeQuery (validated)
    ↓ query-validation.ts — rejects any query without a bounded projectIds scope
KnowledgeRetrievalService.search()
    ↓ DocumentStore.searchChunks() — FTS5 MATCH joined live to knowledge_documents.status
    ↓ scoreCandidate() — layered structural ranking (see below)
    ↓ RELEVANCE_MARGIN — drop padding, never drop the single best match
KnowledgeRetrievalService.buildKnowledgePack()
    ↓ citations.ts::buildCitation() — one Citation per surfaced chunk
    ↓ citations.ts::validateKnowledgePackItem() — enforces the fact-typing policy
    ↓ DocumentStore.openConflictsForChunks() — attaches unresolved conflicts, never picks a winner
KnowledgePack
```

## The structural index

`knowledge_chunks_fts` (schema v5, `store.ts`) is a standalone FTS5 virtual table —
`tokenize='unicode61 remove_diacritics 2'`, the same tokenizer Phase 5D-1's audit found
already in production use, in a brand-new table dedicated to Phase 5D chunks. It is kept
in sync by explicit, transactional add/remove calls inside `DocumentStore.activateDocument`
/ `supersede` / `deleteDocument` / `recoverInterruptedJobs` — never a full rebuild, and
never SQL triggers spanning two tables.

Because superseded and deleted chunks are already physically removed from
`knowledge_chunks` by Phase 5D-1's own lifecycle methods, `knowledge_chunks_fts` never
needs to track SUPERSEDED/DELETED itself — by construction it only ever contains chunks
for documents currently ACTIVE or STALE. **STALE exclusion by default is a query-time
join filter** (`DocumentStore.searchChunks` joins to `knowledge_documents.status`), not a
physical removal from the index — that is what lets `includeStale` bring a document back
into results without a rebuild or a second index.

See `PHASE5D2_RETRIEVAL_AUDIT.md` for why the existing `knowledge/knowledge-db.ts` FTS5
table and `knowledge-federation/index.ts` were not reused.

## Layered ranking

`retrieval.ts::scoreCandidate()` combines FTS5's own bm25 score (the base structural
signal) with deterministic boosts and penalties — nothing here is a learned model:

| Tier | Signal | Weight |
|---|---|---|
| Base | FTS5 bm25 (inverted, larger = more relevant) | 1 |
| High | The literal query text appears verbatim in the chunk | 3 |
| High | A query term appears in the chunk's heading path / section title | 2 |
| Medium | A query term matches an explicit chunk tag | 0.5 |
| Low | Recency (`updatedAt`, decayed over ~30 days) | 0.3 |
| Penalty | Document is STALE (only reachable via `includeStale`) | −4 |
| Penalty | Chunk is named in an unresolved conflict | −0.4 |

The conflict penalty is deliberately small — a nudge, not a suppression. A conflicted
chunk that is genuinely the best match for a query must still be returned, with the
conflict attached in `KnowledgePack.conflicts`, rather than hidden. Hiding it would be
its own way of silently picking a winner.

Relevance filtering compares each candidate's *raw* score against the top raw score in
the same pool: `RELEVANCE_MARGIN` (1.0 score-units) drops anything more than that gap
below the top candidate — the single best match always survives, even alone. Scores are
min-max normalised to `[0, 1]` only afterward, for the `score` field a caller sees; the
filtering decision itself deliberately does not use the normalised value. An earlier
version filtered on the normalised score, which stretches a negligible real gap between
two near-tied raw scores into a full 0..1 spread — with only two or three candidates in
the pool (a small document set, or two documents in direct conflict) that incorrectly
dropped a candidate that was in fact just as relevant as the one that survived, most
visibly when a conflict penalty pushed the whole pool's raw scores negative. The fix and
its regression are in `server/src/personal-os/documents/__tests__/conflicts-relations.test.ts`.

## KnowledgePack and the fact-typing policy

`KnowledgeRetrievalService.buildKnowledgePack` is the *only* code path allowed to
construct a `KnowledgePack`. Every item is typed `FACT`, `SYNTHESIS`, `SUGGESTION` or
`UNKNOWN` (see `PHASE5D2_CITATION_CONTRACT.md`); this service, being purely extractive,
only ever produces `FACT` (a cited, near-verbatim excerpt) or `UNKNOWN` (an explicit "I
don't know" when nothing matched) — `SYNTHESIS`/`SUGGESTION` are real, validated types
reserved for a future answer-composer that combines multiple `FACT`s, not fabricated
here.

## Conflicts and relations

`conflicts.ts::detectConflicts` raises a candidate only when two ACTIVE chunks from
*different* documents assert a different value for the same labelled fact
(`key: value`/`key = value`/`key is value`). `relations.ts` derives `SUPERSEDES`/
`SUPERSEDED_BY` from version history, `PART_OF`/`CONTAINS` from heading nesting,
`DUPLICATES` from identical normalised text across documents, and `RELATED_TO`/
`REFERENCES`/`REFERENCED_BY` from shared tags/section titles/literal title mentions.
`CONTRADICTS`/`CONTRADICTED_BY` are minted alongside a detected conflict. Both scanners
are explicitly triggered (`scanForConflicts`/`scanForRelations`, via API/CLI), never run
automatically on ingestion, and both are idempotent by construction — conflict identity
is the exact chunk-id set (content-hash-derived, so a real content change naturally mints
a fresh conflict), and relation writes are `INSERT OR IGNORE`.

## Measured evaluation and the embedding decision

See `docs/architecture/PHASE5D2_RETRIEVAL_AUDIT.md` for the component selection and
`server/src/personal-os/documents/__tests__/retrieval-evaluation.test.ts` for the 30-query
dataset (15 synthetic across three fixture projects, 15 against real approved
documentation from Mi Core, Mi Academy and Healthy-LD).

Measured results, structural ranking only, no embeddings (closure re-run, after the
relevance-margin and relation-linkage fixes below):

| Target | Required | Synthetic | Real projects |
|---|---|---|---|
| Top-1 accuracy | — (recorded) | 100% | 100% |
| Top-3 recall | ≥ 90% | 100% | 100% |
| MRR | — (recorded) | 1.000 | 1.000 |
| Citation correctness | = 100% | 100% | 100% |
| Citation range accuracy | = 100% | 100% | 100% |
| Project leakage | = 0 | 0 | 0 |
| Deleted/superseded leakage | = 0 | 0 | 0 |
| Stale leakage (default query) | = 0 | 0 | 0 |
| Unrelated result rate | < 10% | 7.7% | 0.0% |
| Deterministic ordering | = 100% | 100% | 100% |
| p50 / p95 retrieval latency | < 500ms | ~0ms / ~1-3ms | ~1ms / ~7-8ms |
| Mean KnowledgePack size | ≤ 64KB budget | ~1.0KB | ~1.5KB |
| UNKNOWN accuracy (no real answer exists) | — (recorded) | 100% | 100% |

A stopword filter (`STOPWORDS` in `store.ts`, shared with the ranking's heading/tag
matching in `retrieval.ts`) was added during closure review: without it, a query sharing
*only* a common function word ("and", "the", "for") with the corpus could still produce a
single FTS candidate that — being the sole result — always survived the relevance filter
and was returned as a FACT instead of falling through to UNKNOWN. Confirmed fixed with a
dedicated probe per project (genuinely unrelated vocabulary — bread hydration ratios,
bike tire pressure, lunar eclipse calendars — queried against project corpora that share
no substantive term with them).

Every target passed on the first structurally-correct ranking, without ever needing the
bounded local embedding experiment the directive describes as the fallback path. Per the
directive's own gate — run the experiment only if structural retrieval measurably misses
targets — **the decision is that embeddings are not required for Phase 5D-2.** No vector
index, embedding model, or embedding cache was added; `memory/qdrant-client.ts` remains
unused, exactly as Phase 5D-1 left it. This decision should be revisited only if a future
phase's own measured evaluation shows structural ranking failing its targets on a larger
or more diverse real corpus than the six projects evaluated here.
