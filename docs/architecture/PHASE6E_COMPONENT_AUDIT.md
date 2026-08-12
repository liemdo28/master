# Phase 6E Component Audit — Knowledge Quality & Scale

Date: 2026-08-12

## Canonical system

**`server/src/personal-os/documents/`** is the canonical Knowledge OS. It is the only
component in the repository that: enforces the approved-root path policy, runs secret
scanning before any content is persisted, produces citations with checksum-verified
provenance, enforces mandatory project scoping on every query, and integrates with the
Phase 6D evidence contract. `service.ts`'s own header comment states this explicitly:
the broad functions in `knowledge/knowledge-db.ts` (`ingestDirectory`, `fullIngest`,
`clearAndRebuild`) are deliberately never called from the canonical path.

Files: `store.ts` (SQLite persistence + FTS5 search), `retrieval.ts` (structural
ranking + `KnowledgePack` assembly), `citations.ts` (citation contract), `chunking.ts`,
`parsers.ts`, `conflicts.ts`, `relations.ts`, `secret-scanner.ts`, `path-policy.ts`,
`query-validation.ts`, `service.ts` (gated ingestion), `router.ts`, `cli.ts`,
`backup.ts`. Schema: `knowledge_documents`, `knowledge_chunks`,
`knowledge_chunks_fts` (FTS5), `knowledge_conflicts`, `knowledge_relations`,
`knowledge_ingestion_jobs`, `knowledge_document_projects`, all inside
`personal-os.db` (schema v10).

Already implemented (confirmed by direct source reading, not assumed):

- **Ranking** (`retrieval.ts`): FTS5 bm25 base signal + deterministic boosts (exact
  phrase, heading match, tag match, recency) + penalties (stale, unresolved conflict),
  with a relevance-margin cutoff (not a fixed top-k pad) so an unrelated result is
  dropped rather than used as filler. This already covers most of the ranking signals
  Phase 6E's spec (§24) lists as candidates.
- **Query normalization** (`store.ts:ftsMatchExpression`): stopword filtering,
  per-term quoting for FTS5 safety, OR-joined substantive terms, explicit
  all-stopword → impossible-match fallback (correctly yields UNKNOWN rather than a
  coincidental function-word match).
- **Project scoping** (`query-validation.ts`): `projectIds` is required and bounded
  (1–5) at the validation layer, before retrieval runs — there is no query shape that
  means "search everything."
- **Citations** (`citations.ts`): `buildCitation`/`validateCitation` are the only
  code paths allowed to construct/verify a citation; every citation carries document +
  chunk checksums and is rejected if either has drifted; `canonicalPath` is
  structurally forbidden from ever appearing in one.
- **Fact typing** (`citations.ts:validateKnowledgePackItem`): FACT/SYNTHESIS require
  citations, SUGGESTION/UNKNOWN must carry none — enforced on every item before a pack
  leaves `buildKnowledgePack`.
- **Staleness** (`service.ts:refreshStaleness`): checksum/size/parser-version
  comparison against the live source flags STALE; STALE is excluded from default
  retrieval and penalized (not deleted) when explicitly included.
- **Conflicts** (`conflicts.ts`): narrow, explainable `key: value` disagreement
  detection across ACTIVE chunks from different documents; conflict identity is the
  exact chunk-id set, so a resolved conflict is never re-raised unless the content
  itself changes.
- **Ingestion idempotency** (`service.ts:ingestApprovedDocument`): a repeated
  `operationId` returns the original outcome; unchanged content (same checksum) is a
  documented no-op (`UNCHANGED`), which already satisfies most of §17's "incremental
  reindex" requirement for the unchanged-document case.
- **Backup/restore** (`backup.ts`): online SQLite backup (no writer lockout),
  post-restore integrity + table-count verification.
- **Evidence integration** (`evidence/normalize.ts`): `normalizeDocument` and
  `normalizeConflict` already feed `knowledge_documents`/`knowledge_conflicts` into
  the Phase 6D evidence stream.

## Real gap found (not assumed — traced end to end)

`evidence/service.ts`'s `health()` method reports a `FAILED_INGESTION` dimension whose
`evidenceIds` are built as `` `KNOWLEDGE:${job.id}` `` (job ids are `job-<uuid>`,
confirmed in `store.ts:createJob`). But `EvidenceService.list()` never normalizes
`knowledge_ingestion_jobs` rows into `EvidenceRecord`s — it only normalizes
`knowledge_documents` and `knowledge_conflicts`. So every id in `FAILED_INGESTION`'s
`evidenceIds` array is a dangling reference: `EvidenceService.get(id)` returns `null`
for all of them. This is Phase 6E's concrete, evidence-based target for §15/§27
(ingestion failure evidence, evidence integration) — not a hypothetical improvement.

## Overlapping / legacy / dead systems (none touched by this phase)

A full-repository survey (grep + direct reads) found five other components that touch
"knowledge/document/retrieval/memory" concepts. **None of them read or write any of
the six canonical tables above** — each owns entirely separate storage:

| Component | Storage | Mounted? | Classification |
|---|---|---|---|
| `server/src/knowledge/` (`knowledge-db.ts`, `pack-manager.ts`, `compliance-*.ts`, `reference-brain-path.ts`) | separate SQLite `knowledge.db` (`docs`/`docs_fts`) | yes, `/api/knowledge` | **OVERLAPPING** — duplicates ingest+FTS-search over files, but whole-workstation scope, no path policy/secret scan/citation contract |
| `jarvis/phase21-knowledge/knowledge-indexer.ts` | flat JSON catalog file, no DB | yes, booted at startup + `/api/jarvis` | **EXPERIMENTAL/OVERLAPPING** — third independent full-filesystem indexer |
| `memory/qdrant-client.ts` | external Qdrant (not provisioned) | no importers found | **DEAD** |
| `bigdata/` (`memory-indexer.ts`, `search-service.ts`, `db-client.ts`) | Postgres `mi_bigdata` + Qdrant | yes, `/api/bigdata`, `/api/memory` (via `memory-router.ts`) | **OVERLAPPING** — self-labelled "canonical" for a different tier (big-data/Postgres memory), disjoint from personal-os |
| `memory/executive-memory.ts` | flat JSON files | yes, imported by `knowledge-db.ts:fullIngest` | **LEGACY/ADAPTER** |
| `memory2/store-context.ts` | hardcoded lookup table | yes, chat/voice/whatsapp pipeline | **ADAPTER** (business-context lookup, not a document store) |
| `knowledge-federation/index.ts` | federates the above (not personal-os) | yes, `/api/chat`, `/api/voice`, `/api/whatsapp` | **OVERLAPPING** — orchestration layer on top of the non-canonical stack |
| `operational-memory/` | separate SQLite (`executions`/`incidents`/`owner_actions`) | yes, `/api/memory` (route-order collision with `memory-router.ts`) | **ADAPTER/OVERLAPPING** — incident/ops memory, not document content |

Per the governing directive (§0, "Do NOT create another knowledge system... Do NOT
replace FTS architecture by assumption"), Phase 6E does not touch, migrate, or unify
any of these. They are recorded here for completeness and because at least two
(`knowledge-federation`, `bigdata/memory-router`) mount routes that a future phase
might need this audit to distinguish from the canonical Knowledge OS this document
governs.

## Conclusion

The canonical path is confirmed: `server/src/personal-os/documents/`. Phase 6E's
implementation work targets only this system. No implementation begins until this
document exists — it now does.
