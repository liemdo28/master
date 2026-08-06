# Phase 5D-2 — knowledge retrieval security

Extends `docs/security/PHASE5D_KNOWLEDGE_SECURITY.md` (Phase 5D-1: approved-root
containment, secret scanning, sensitivity tagging) to the retrieval, citation, conflict
and relation surfaces added in this phase. Every invariant below is exercised in
`server/src/personal-os/documents/__tests__/retrieval-security.test.ts`
(`test:knowledge-retrieval-security`).

## There is no "search everything" query

`KnowledgeQuery` requires `projectIds`: a non-empty array, bounded to 5 entries, each
matching `^[a-z0-9][a-z0-9._-]{0,63}$` (`query-validation.ts`). A query with no
`projectIds`, an empty array, `null`, or a non-array value is rejected with
`PROJECT_SCOPE_REQUIRED`/`INVALID_FIELD` before it reaches the store — retrieval code
never sees an unscoped request. `text` is bounded to 2–500 characters; `limit` is bounded
to 1–20; `goalIds`/`taskIds` are bounded to 10 entries each.

## No cross-project expansion

`DocumentStore.searchChunks` filters every candidate chunk against the caller's
`projectIds` in the retrieval layer itself (not just at the API boundary), and
`KnowledgeRetrievalService` never widens that set. A query scoped to `proj-public` cannot
observe `proj-secret`'s content even when both documents structurally match the same
query terms almost word for word — proven directly in the security suite with two
documents differing only in a token value, and again at scale in the 30-query evaluation
(`projectLeaks=0` across all 30 queries).

## Citations never carry a filesystem path

`Citation` (in `types.ts`) has no `canonicalPath` field — the TypeScript contract itself
prevents it. `citations.ts::buildCitation` constructs a `Citation` from `document.sourceUri`
(the same project-relative value the Phase 5D-1 document API already exposes), never from
`document.canonicalPath`. `validateCitation` additionally asserts at runtime that no
citation object carries a `canonicalPath` key, as a second line of defense against a
future accidental spread of the full `DocumentRecord` into a citation.

## No raw SQL, no arbitrary filters, no dump endpoint

Every new Phase 5D-2 route and CLI command takes a bounded, typed shape — a
`KnowledgeQuery` body, a `projectIds` array, a conflict id matching a fixed UUID pattern,
or a document id matching the existing `doc-<uuid>` pattern. None accepts a raw filter
object, a SQL fragment, or an unbounded listing. `GET /knowledge-documents/conflicts`
takes an optional `status` restricted to the four known `ConflictStatus` values and a
`limit` clamped server-side; there is no equivalent for chunks or citations.

Query text reaches SQLite only through `ftsMatchExpression` (`store.ts`), which splits on
whitespace, wraps every term in a quoted FTS5 phrase, and doubles any embedded `"` per
FTS5's own escaping rule — a query containing `"; DROP TABLE knowledge_chunks; --`,
`****`, unbalanced quotes, or FTS5 operator syntax (`NEAR(...)`, column filters) is
treated as literal search terms, never as control syntax, and never crashes the query.

## Citation correctness is checked, not assumed

`validateCitation` confirms a citation's `documentChecksum`/`chunkContentHash` still
match the live chunk and document before it is trusted — a citation surviving a document
edit or supersession without a matching checksum is rejected. The evaluation suite checks
every citation returned across all 30 queries this way (`citationCorrectness=100%`).

## Conflicts and relations respect the same project scope

`scanForConflicts`/`scanForRelations` only ever read documents whose `projectIds`
intersects the caller-supplied set; a conflict or relation can never be raised across
project boundaries the caller did not name. `openConflictsForChunks` (used when a
`KnowledgePack` attaches conflicts) is filtered to the chunks already present in that
pack's own, already-project-scoped result set.
