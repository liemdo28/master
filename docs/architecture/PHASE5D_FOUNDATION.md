# Phase 5D-1 — document foundation

Schema **v4** inside the existing Personal OS database. No second database, no vector
store, no retrieval yet — this batch establishes the document layer that Phase 5D-2 will
index and cite.

## Why broad ingestion is forbidden

`knowledge/knowledge-db.ts` already exports `ingestDirectory(root, maxFiles = 2000)`,
`fullIngest()` and `clearAndRebuild()`. Those are live and used by the cron scheduler,
enterprise brain and skill registry, so they stay — but Phase 5D never calls them. They
cannot satisfy this phase's contracts:

| Requirement | Broad entry points |
|---|---|
| Explicit approval per document | absent — a directory is swept wholesale |
| Secret scanning before persistence | absent |
| Project scoping and sensitivity | absent |
| Chunk-level provenance | absent — a `docs` table only |
| Section / page / line citation | impossible without chunks |

Phase 5D adds one gated entry point instead: `KnowledgeDocumentService.ingestApprovedDocument`.

## Approved roots

A file is ingestible only if it resolves inside a registered Project Registry root, a
configured document root (`MI_DOCUMENT_ROOTS`), or an explicitly approved file
(`MI_APPROVED_DOCUMENT_FILES`). Containment is checked on the **real** path after
symlink and junction resolution, so a link inside an approved root that points outside
it is refused with `LINK_ESCAPE` rather than followed.

Rejection codes: `NOT_FOUND`, `OUTSIDE_APPROVED_ROOTS`, `TRAVERSAL`, `LINK_ESCAPE`,
`EXCLUDED_PATH_CLASS`, `NOT_A_FILE`, `NOT_A_DIRECTORY`, `NO_APPROVED_ROOTS`. No message
or API response ever contains an absolute path.

Always excluded, wherever they appear: `.git`, `node_modules`, `dist`, `build`,
`generated`, `coverage`, `logs`, `tmp`/`temp`/`cache`, `.local-agent-global`, `secrets`,
`credentials`, `.ssh`/`.aws`/`.gnupg`, WhatsApp session dirs, PM2 backups, browser
profiles, model caches — plus `.env*`, `*.pem`/`*.key`/`*.p12`, `id_rsa`,
`google-tokens.json`, `service-account*.json`, `*.db`/`*.sqlite`, `session.json`,
`cookies.*`.

## Parsers

| Type | Support | Notes |
|---|---|---|
| Markdown | full | headings, nested heading path, fenced code, tables, front matter |
| Plain text | full | paragraph blocks, encoding validation |
| JSON | full | bounded depth 12, stable sorted key order, sensitive keys redacted |
| YAML | **safe subset** | block maps, sequences, scalars, inline lists. Anchors, aliases, custom tags and merge keys are **refused**, not interpreted — this is what "no custom object constructors" means without a YAML library |
| HTML | full | scripts, styles, iframes, images, comments stripped before text extraction |
| PDF | **unavailable** | reuses `data-analyst/pdf-extractor`, which needs `pdf-parse`; that package is not installed, so PDF ingestion returns a controlled `PARSER_UNAVAILABLE`. No OCR in this batch |

Structured documents group their flattened leaves by parent path. Emitting one section
per leaf produced lines like `steps.0: build` that fell under the minimum chunk size, so
a whole YAML file could ingest to nothing; grouping keeps siblings together.

Every parser is pure text handling: no shell, no macros, no network fetch, no include
resolution, no code evaluation.

## Chunking defaults

| Setting | Value |
|---|---|
| target size | 1,200 chars |
| max size | 1,800 chars |
| overlap | 150 chars |
| minimum | 40 chars |
| max chunks per document | 2,000 |

Chunk ids are **derived**, not random: `chunk-<sha256(documentId, headingPath, text)>`.
The same input therefore always produces the same ids, so re-ingesting an unchanged
document is a no-op and an issued citation stays valid. Oversized sections split on
paragraph, then sentence, then hard boundaries, with overlap carrying context across the
seam. A document whose content all falls below the minimum fails cleanly with
`NO_CONTENT` rather than activating with zero chunks.

## Staged ingestion

1. validate request → 2. resolve approved root → 3. verify real path → 4. classify →
5. size/MIME check → 6. **secret scan on raw bytes** → 7. parse → 8. chunk (scanned
again) → 9. persist document + chunks in one transaction → 10. activate → 11. record job.

Failure never leaves a partial ACTIVE document. `operationId` makes a repeat request
idempotent. A job still `RUNNING` at startup means the process died mid-ingestion: on
reopen it becomes `RECOVERY_REQUIRED`, its document drops to `FAILED`, and its partial
chunks are deleted.

## Staleness and versioning

Compared per document: checksum, source modified time, size, parser version. An
unchanged source stays `ACTIVE`; a changed or missing source becomes `STALE`.
Re-ingesting creates a new version, links `supersedesId`, marks the previous version
`SUPERSEDED` and removes its chunks. A same-length edit is still detected, because
staleness is driven by checksum rather than size. Deletion drops chunks but keeps the
document row so the audit trail resolves.

## Not in this batch

No retrieval, no KnowledgePack, no citations surfaced to callers, no embeddings, no
vector database, no relations, no conflict engine, no daily operating loop. Those are
Phase 5D-2 and later.
