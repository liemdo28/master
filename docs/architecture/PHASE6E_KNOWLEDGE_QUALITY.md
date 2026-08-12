# Phase 6E — Knowledge Quality & Scale

Date: 2026-08-12

Phase 6E improves the measurable quality, freshness, reliability, and scale
characteristics of the existing canonical Knowledge OS
(`server/src/personal-os/documents/`). It does not create a second knowledge system,
does not replace the FTS5 architecture, and does not introduce vector/semantic search
into production. See [`PHASE6E_COMPONENT_AUDIT.md`](PHASE6E_COMPONENT_AUDIT.md) for the
canonical-vs-overlapping-systems classification performed before any implementation.

## Production knowledge baseline (measured, 2026-08-12)

Read directly from the live `personal-os.db` (`.local-agent-global/personal-os/`),
read-only:

- `knowledge_documents`: 8 total, all `DELETED` (7) or `SUPERSEDED` (1) — **0 ACTIVE
  documents**.
- `knowledge_chunks`: 0.
- `knowledge_chunks_fts`: 0 rows.
- `knowledge_conflicts`: 1, `RESOLVED`.
- `knowledge_ingestion_jobs`: 11 total, 9 `COMPLETED`, 2 `FAILED`
  (`UNSUPPORTED_MIME`, `SECRET_REJECTED`).

MEASURED, not estimated. Production has no substantive live knowledge content at this
time — the 8 rows are leftover fixture-test artifacts, already deleted or superseded.
This means Phase 6E's quality work is necessarily proven against a purpose-built
benchmark corpus rather than production data (see below); production-copy acceptance
(§41) runs the same benchmark methodology against a disposable copy of the live DB and
finds the same empty state, confirmed rather than assumed.

## Benchmark corpus and evaluation

New: `server/src/personal-os/documents/knowledge-quality-fixtures.ts` (shared corpus +
case generator) and `knowledge-quality-evaluation.ts` (deterministic runner).

- 8 synthetic projects (`proj-zeta` … `proj-nu`), each with `architecture.md` (4
  facts: gateway port, language, database, framework), `runbook.md` (1 incident
  fact), `adr-001.md` (1 decision fact), `deployment.md` (2 facts: deploy/rollback
  commands) — 8 facts × 8 projects = 64 base facts.
- 7 deterministic phrasing templates per fact kind → 448 RECALL cases.
- 59 additional edge-case queries across 10 further categories: NO_ANSWER,
  WRONG_PROJECT_DISTRACTOR, EXACT_PATH, SYMBOL, MULTI_HOP, CONFLICT, STALENESS,
  SUPERSEDED_VERSION, DUPLICATE_AMBIGUOUS, GENERATED_VS_CANONICAL.
- **507 total deterministic cases** (target was "500 minimum where practical" — met).
- Every case has a fixed expected source/excerpt/conflict/no-answer expectation
  defined at generation time, before any query runs. No LLM anywhere in the benchmark
  or the retrieval path it exercises.

Run: `npm run knowledge-quality:evaluation`.

## Baseline vs final metrics

The "baseline" here is the very first honest run of the new benchmark against the
**unmodified** Phase 5D-2 retrieval code (before any Phase 6E ranking change):

| Metric | Baseline (first honest run) | Final |
|---|---|---|
| Overall correctness | 79.3% (402/507) | **97.2% (493/507)** |
| RECALL (top-3, 448 cases) | 80.1% | **98.7%** |
| citationCorrectness | 100% | 100% |
| crossProjectLeakage | 0 | 0 |
| unsupportedSynthesis | 0 | 0 |
| conflictSuppression | 0 | 0 |
| secretLeakage | 0 | 0 |
| deterministicResults | 100% | 100% |
| WRONG_PROJECT_DISTRACTOR | 0% (test-design flaw, see below) | 100% |
| EXACT_PATH | 0% (real gap, fixed) | 100% |
| SYMBOL | 100% | 100% |
| MULTI_HOP | 0% (architectural, not fixed — see below) | 0% (unchanged, by design) |
| CONFLICT / STALENESS / SUPERSEDED_VERSION / DUPLICATE_AMBIGUOUS / GENERATED_VS_CANONICAL | 100% each | 100% each |
| p50 / p95 latency (507 cases) | ~1ms / ~1ms | ~1ms / ~1ms |

The gap between the two RECALL numbers breaks down as: ~56 cases were a genuine
fixture bug (single-sentence "Language" sections under the 40-character chunking
minimum, silently dropped — not a retrieval bug); ~20 were a real retrieval gap
(EXACT_PATH queries had no path-aware signal at all); ~7 were an ambiguous query
template that got replaced; the remaining ~6 are honest residual noise from
near-identical command strings and repeated ADR terminology (e.g. `proj-kappa`'s
`./gradlew deployKappa` / `./gradlew rollbackKappa` sharing most of their tokens) —
left as-is rather than further hand-tuned to the fixture.

## Real gaps found and fixed (evidence-based, not speculative)

1. **Explicit path/filename retrieval had no dedicated signal.** A query naming an
   exact file (e.g. `"what is documented in proj-eta/architecture.md"`) relied
   entirely on FTS matching the file's prose content — if the file's own words never
   matched the query's other terms, the file was never found, independent of how
   exactly its name was named. Fixed with `store.findBySourceUriFragment()` (a
   `sourceUri LIKE`-scoped lookup, still project-scoped, never bypassing
   `KnowledgeQuery` validation) plus a new `exactPathMatch` ranking weight (6, the
   highest signal — larger than `exactPhrase`'s 3) in `retrieval.ts`. Verified: 8/8
   EXACT_PATH cases now pass; zero regression on the frozen 30-query Phase 5D-2
   benchmark (`test:knowledge-retrieval-evaluation` — identical metrics before and
   after).
2. **`FAILED_INGESTION` evidence dangled.** `evidence/service.ts`'s `health()` built
   `evidenceIds` as `KNOWLEDGE:<jobId>`, but `EvidenceService.list()` never normalized
   `knowledge_ingestion_jobs` rows — every one of those ids resolved to `null` via
   `get()`. Fixed: `evidence/normalize.ts:normalizeIngestionJob()`, wired into
   `list()`. Verified: `test:knowledge-quality-security` asserts every
   `FAILED_INGESTION` evidenceId now resolves.
3. **No operator-visible ingestion-job listing existed at all** — individual failed
   jobs (with reason code, not just an aggregate count) were invisible to any API
   consumer. Fixed: `GET /knowledge-documents/ingestion-jobs` (optionally
   `?status=FAILED`), sanitized (no absolute path — `IngestionJob` never carried one).
4. **`unknown: true` collapsed three different situations into one.** A query against
   a never-indexed project, a query with genuinely no answer, and a query whose only
   match was STALE (and `includeStale` wasn't set) were all indistinguishable to a
   caller. Fixed: `KnowledgePack.unknownReason: 'PROJECT_NOT_INDEXED' | 'STALE_ONLY' |
   'NO_SUPPORTED_ANSWER' | null`, additive to the existing contract (no breaking
   change — every existing test that reads `.unknown` is unaffected).

## Rejected: not every measured gap was "fixed"

**MULTI_HOP (0/8, unchanged).** A query whose full answer spans two documents (e.g.
"what framework does X use and why was it chosen") only ever returns the single
best-matching chunk — `retrieval.ts`'s own header comment states there is no
"synthesis step in this file," by design (Phase 5D-2's `RELEVANCE_MARGIN` cutoff
deliberately drops a second, lower-scoring chunk rather than padding results with
noise — that margin is what keeps `unrelatedRate` near zero everywhere else).
Widening the margin to let a second chunk through was evaluated in isolation and
rejected: it reintroduces exactly the dilution the margin exists to prevent, in
exchange for a capability (cross-document synthesis) this deterministic, no-LLM
retrieval layer does not claim to have. `knowledge-quality-evaluation.ts` measures
MULTI_HOP every run but does not gate on it (`CATEGORY_TARGETS` explicitly excludes
it, with the rationale inline). This is recorded as a valid Phase 6E result per the
governing directive's own instruction not to fake success by weakening the
evaluation.

**Semantic/vector search (§25) — not evaluated.** Per the directive, semantic search
is optional and gated on the FTS benchmark revealing a gap deterministic FTS
improvements can't close. After the fixes above, RECALL is 98.7% and every safety
metric is at target; the only unmet category (MULTI_HOP) is an intentional scope
boundary, not a recall failure a vector index would plausibly close (it needs
cross-document synthesis, not better single-chunk similarity). No semantic-search
experiment was run. **Decision: REJECTED at the gate — the FTS benchmark did not
reveal a gap that justified evaluating it**, consistent with the directive's own
framing that this is itself a valid Phase 6E outcome.

## Scale (measured, `npm run test:knowledge-scale`)

Disposable, generated corpus only — never the production DB:

- 1,000 documents, 20 projects, 11,000 chunks (11 sections/doc).
- Ingest throughput: 179.4 docs/sec, 1,973 chunks/sec (5,574ms total for the full
  corpus).
- Retrieval at scale: p50 0ms, p95 1ms (50 random-document marker queries against the
  full 11,000-chunk index).
- Incremental reindex: an unchanged document re-ingest is 2ms (checksum-verified
  no-op); a genuinely changed single document reindexes in 11ms — **~500x cheaper**
  than the 5,574ms full-corpus ingest, proving no unnecessary full-index rebuild
  happens for an ordinary single-document change.
- DB size after 1,000 docs/11,000 chunks: ~30.4 MB; WAL: ~5.1 MB; process RSS: ~183 MB.

## Backup/restore proof (measured, `npm run test:knowledge-backup-restore-benchmark`)

Extends the existing Phase 5D-2 backup/restore foundation (`backup.ts`, previously
proven only against a single canary phrase) to a 40-case benchmark subset: every case
produces the identical top citation from the restored copy as from the live store it
was backed up from. 0 mismatches.

## Command Center

`KnowledgePage.tsx` gains a fifth tab, **Quality**, backed by two new endpoints:
`GET /knowledge-documents/quality-summary` (documents, chunks, projects, stale,
open conflicts, failed/retryable/blocked ingestion, index health) and
`GET /knowledge-documents/ingestion-jobs?status=FAILED` (individual failure detail).
No new mutation route. Verified: `tsc -b`, `vite build`, existing unit/security/E2E
suites all pass unchanged; the E2E fixture flow (which already exercises the
Knowledge page) is unaffected.

## Operator debug view (§31)

`KnowledgeRetrievalService.explainQuery()` / `POST /knowledge-documents/debug-search`
— returns the same candidates `search()` would rank, plus each individual score
component (bm25, exactPhrase, headingMatch, tagMatch, recency, exactPathMatch,
stalePenalty, conflictPenalty) and a 200-character excerpt. Never exposes
`canonicalPath`; still requires the same `KnowledgeQuery` project-scope validation as
every other retrieval entry point — there is no way to use it to bypass scoping.

## No authority expansion

Confirmed live: `unknownMutations: 0`, `unresolvedLegacyMutations: 0`. The two new GET
routes and one new POST route (`debug-search`) fall under the existing
`personal-os/documents` canonical ownership the scanner already classifies — no new
mutation authority, no new external action type, no schema change (`personal-os.db`
remains schema v10 — every Phase 6E table (`knowledge_documents`,
`knowledge_chunks`, etc.) already existed; nothing here is additive to the schema).
