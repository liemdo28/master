# Phase 5D-2 — citation contract and fact-typing policy

## Citation

```ts
interface Citation {
  documentId: string;
  chunkId: string;
  title: string;
  sourceUri: string;        // project-relative, never canonicalPath
  headingPath: string[];
  sectionTitle: string | null;
  lineStart: number | null; // MARKDOWN/TEXT only — see below
  lineEnd: number | null;
  pageNumber: number | null; // PDF only
  documentChecksum: string;
  chunkContentHash: string;
  projectIds: string[];
  documentStatus: DocumentStatus;
}
```

`citations.ts::buildCitation` is the only code path allowed to construct one.
`validateCitation` confirms `documentChecksum`/`chunkContentHash` still match the live
document/chunk (a citation surviving a re-ingest without matching checksums is stale and
rejected) and that no `canonicalPath` key is present.

### Why only Markdown and plain text get line numbers

`ParsedSection.lineStart`/`lineEnd` are computed during parsing from the *original* file
text (markdown: tracked directly while iterating `lines`; plain text: a binary search
over a precomputed newline-offset array, `O(log n)` per lookup). HTML's section offsets
are measured against post-stripping text, not the original file, so a line number there
would be misleading rather than exact — HTML cites by heading path instead. JSON/YAML
have no line concept that survives their flattening into `key.path: value` sections; they
cite by heading path (the key path itself). PDF cites by `pageNumber`. A citation with
`lineStart: null` is not missing information — it means "this source type cites a
different way," and callers should prefer `headingPath`/`sectionTitle`/`pageNumber` when
`lineStart` is absent.

## The fact-typing policy

Every `KnowledgePackItem` carries one of four types, and `validateKnowledgePackItem`
(`citations.ts`) enforces the rule for each:

| Type | Citations | Meaning |
|---|---|---|
| `FACT` | ≥ 1, required | A near-verbatim excerpt, sourced |
| `SYNTHESIS` | ≥ 1, required | A combination of multiple facts, still sourced |
| `SUGGESTION` | 0, required to be empty | Mi's own inference — never dressed up as sourced |
| `UNKNOWN` | 0, required to be empty | Nothing matched; said explicitly, not a silent empty list |

An uncited `FACT`/`SYNTHESIS` (`UNCITED_FACT`), a `SUGGESTION` carrying citations
(`MISLABELED_SUGGESTION`), an `UNKNOWN` carrying citations (`MISLABELED_UNKNOWN`), or any
item with a blank `statement` (`EMPTY_STATEMENT`) throws `CitationValidationError` before
the item can leave `buildKnowledgePack`.

`KnowledgeRetrievalService`, being purely extractive/structural, only ever produces
`FACT` (for a match) or `UNKNOWN` (for no match) — see `PHASE5D2_RETRIEVAL_ARCHITECTURE.md`.
`SYNTHESIS` and `SUGGESTION` are real, validated, and ready for a future component that
composes an answer from multiple `FACT`s; nothing in this phase constructs one.

## KnowledgePack

```ts
interface KnowledgePack {
  queryId: string;
  query: { text: string; projectIds: string[]; includeStale: boolean };
  generatedAt: string;
  items: KnowledgePackItem[];
  conflicts: ConflictRecord[]; // unresolved conflicts touching any returned chunk
  warnings: string[];
  unknown: boolean;            // true when items is the single explicit UNKNOWN item
}
```

`KnowledgeRetrievalService.buildKnowledgePack` is the only code path allowed to
construct one. Every item is validated before the pack is returned.
