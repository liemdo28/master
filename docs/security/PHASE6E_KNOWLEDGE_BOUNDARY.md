# Phase 6E — Knowledge Boundary

Date: 2026-08-12

Phase 6E's security surface is deliberately small: two new read-only GET routes, one
new read-only POST route (a debug/explain view, not a mutation), and additive-only
changes to two existing internal contracts (`KnowledgePack.unknownReason`,
`EvidenceRecord` normalization for ingestion jobs). No new mutation route, no schema
change, no new external action type.

## What did NOT change (and is exhaustively covered elsewhere)

Cross-project leakage, path traversal, unapproved-root rejection, secret-bearing
document rejection, SQL/FTS-injection resistance, and KnowledgePack byte-budget
enforcement are unchanged and remain covered by `retrieval-security.test.ts` and
`document-security.test.ts` (both still pass, unmodified, after every Phase 6E code
change — see full regression results in `PHASE6E_ACCEPTANCE.md`). Phase 6E's own
security test (`knowledge-quality-security.test.ts`) intentionally does not
re-test these; it targets only the new surfaces below.

## New surfaces and their guarantees

1. **`GET /knowledge-documents/ingestion-jobs`** — same auth as every other route on
   this router (`x-api-key` via `/api`, session auth via `/api/command-center`).
   `IngestionJob` never carried an absolute path (`documentId`/`operationId`/
   `errorCode`/`safeError` only; `safeError` is produced by `service.ts`'s
   `safeMessage()`, which strips paths before it is ever persisted). An unrecognized
   `?status=` value is ignored (whitelisted against `JOB_STATUSES`), never passed
   through toward SQL. Verified: unauthenticated request → 401; a
   `?status=DROP+TABLE`-shaped value → 200 with the unfiltered list, not an error or a
   SQL side effect.
2. **`GET /knowledge-documents/quality-summary`** — same auth. Pure aggregation over
   existing store methods (`listDocuments`, `listJobs`, `stats`, `listConflicts`); no
   new query surface, no user input at all.
3. **`POST /knowledge-documents/debug-search`** — same auth. Internally calls
   `KnowledgeRetrievalService.explainQuery()`, which validates through the exact same
   `validateKnowledgeQuery()` every other retrieval entry point uses — a request with
   no `projectIds` is rejected with 400, identically to `/search` and
   `/knowledge-pack`. There is no debug-only bypass of project scoping. Response never
   contains `canonicalPath`; excerpts are truncated to 200 characters, the same
   defense-in-depth posture as a normal `KnowledgePackItem.statement`.
4. **Router registration order.** Both new GET routes are registered *before*
   `GET /knowledge-documents/:id` (matching the existing `/stale` and `/conflicts`
   convention, with an explicit code comment) — an earlier draft of this change
   registered them after, and Express's top-to-bottom route matching silently
   swallowed both into the `:id` handler, producing spurious 400s. Caught by this
   phase's own security test before merge, not left for review to find.

## `exactPathMatch` ranking signal — not a new authority boundary

The new `store.findBySourceUriFragment()` lookup is a `sourceUri LIKE`-scoped query
(never `canonicalPath`, which never leaves the module), and its result is filtered by
`document.projectIds.some(p => projectIds.includes(p))` before being returned to the
caller — the same project-scope enforcement every other store method applies. It
cannot be used to discover or retrieve a document outside the caller's declared
project scope; it only changes *which already-in-scope document* wins the ranking.
Verified by the existing project-isolation assertions in
`knowledge-quality.test.ts` and by 8/8 `WRONG_PROJECT_DISTRACTOR` cases in the 507-case
evaluation.

## `unknownReason` — no information disclosure beyond what was already true

Before Phase 6E, `unknown: true` already told a caller "nothing matched." The new
`unknownReason` field only refines *why*, using information the caller's own
`projectIds` scope already entitles them to (whether their own scoped project has any
indexed document at all is not new information relative to what `discover()` and
`listDocuments()` already expose to the same caller).

## Evidence integration fix — no new leakage path

`normalizeIngestionJob()` follows the exact same `baseRecord()` pipeline as every
other evidence normalizer: `sanitizeClaim()`, `classifyRedaction()`, and the
content-driven `SECRET_NEVER_RENDER` upgrade all apply unconditionally. `errorCode`/
`safeError` were already guaranteed secret-free by `service.ts`'s ingestion pipeline
(the secret scanner runs before any error is ever recorded), and `baseRecord()`'s own
defense-in-depth secret scan covers the claim text regardless. No new redaction class
was introduced; ingestion-job evidence defaults to the same `OPERATOR_SAFE`
classification as document/conflict evidence from the same `KNOWLEDGE` source system.

## Regression proof

`test:knowledge-quality-security` — malicious document metadata (script-tag-shaped
and template-injection-shaped content) ingests as inert plain text, never gains extra
citations, never escapes its declared project scope, and the service never throws
outside its normal `ACTIVE`/`REJECTED`/`FAILED` outcome shape.

Required, confirmed live and in the full regression: `unknownMutations: 0`,
`unresolvedLegacyMutations: 0`, no Gmail SEND route, no financial action type, no
autonomous approval/merge/deploy capability, Operator Control remains observational,
Evidence contract remains truthful (every `FAILED_INGESTION` evidenceId now resolves —
strictly more truthful than before, not less).
