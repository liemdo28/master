/**
 * Phase 5D-2 §6-7 — citation contract and fact-typing policy.
 */

import assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { buildCitation, CitationValidationError, validateCitation, validateKnowledgePackItem } from '../citations';
import { DocumentStore } from '../store';
import { KnowledgeDocumentService } from '../service';
import type { DocumentChunk, DocumentRecord, KnowledgePackItem } from '../types';

function fixtureDocument(overrides: Partial<DocumentRecord> = {}): DocumentRecord {
  return {
    id: 'doc-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', title: 'Runbook', sourceType: 'MARKDOWN',
    sourceUri: 'docs/runbook.md', canonicalPath: 'C:/secret/path/docs/runbook.md',
    projectIds: ['proj-a'], goalIds: [], taskIds: [], mimeType: 'text/markdown', language: 'en',
    checksum: 'doc-checksum-1', sizeBytes: 100, status: 'ACTIVE', sensitivity: 'INTERNAL',
    ingestionPolicy: 'PROJECT_DOCS', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    indexedAt: '2026-01-01T00:00:00.000Z', sourceModifiedAt: null, version: 1, supersedesId: null,
    metadata: {}, evidenceReferences: [], ...overrides,
  };
}

function fixtureChunk(overrides: Partial<DocumentChunk> = {}): DocumentChunk {
  return {
    id: 'chunk-1', documentId: 'doc-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', ordinal: 0,
    headingPath: ['Rollback'], text: 'Run npm run rollback to restore the previous release.',
    normalizedText: 'run npm run rollback to restore the previous release.', tokenEstimate: 12,
    contentHash: 'chunk-checksum-1', sourceStart: 0, sourceEnd: 50, lineStart: 3, lineEnd: 3,
    pageNumber: null, sectionTitle: 'Rollback', tags: [], projectIds: ['proj-a'], sensitivity: 'INTERNAL',
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', ...overrides,
  };
}

async function run(): Promise<void> {
  const document = fixtureDocument();
  const chunk = fixtureChunk();

  // --- buildCitation never carries canonicalPath -------------------------------
  const citation = buildCitation(chunk, document);
  assert.ok(!('canonicalPath' in citation), 'a Citation object has no canonicalPath property at all');
  assert.ok(!JSON.stringify(citation).includes('secret/path'), 'the serialised citation never contains the absolute path');
  assert.strictEqual(citation.sourceUri, 'docs/runbook.md');
  assert.strictEqual(citation.lineStart, 3);
  assert.strictEqual(citation.lineEnd, 3);
  assert.strictEqual(citation.documentChecksum, 'doc-checksum-1');
  assert.strictEqual(citation.chunkContentHash, 'chunk-checksum-1');

  // --- validateCitation catches drift -------------------------------------------
  validateCitation(citation, chunk, document); // must not throw for a fresh, matching citation

  assert.throws(
    () => validateCitation(citation, chunk, fixtureDocument({ checksum: 'changed-checksum' })),
    (err: unknown) => err instanceof CitationValidationError && err.code === 'CHECKSUM_MISMATCH',
    'a document whose content changed since the citation was built must fail validation',
  );
  assert.throws(
    () => validateCitation(citation, fixtureChunk({ contentHash: 'changed-hash' }), document),
    (err: unknown) => err instanceof CitationValidationError && err.code === 'CHECKSUM_MISMATCH',
    'a chunk whose content changed since the citation was built must fail validation',
  );
  assert.throws(
    () => validateCitation(citation, fixtureChunk({ id: 'chunk-other' }), document),
    (err: unknown) => err instanceof CitationValidationError && err.code === 'CITATION_MISMATCH',
    'a citation pointed at the wrong chunk must fail validation',
  );

  // --- fact-typing policy: FACT/SYNTHESIS need citations -------------------------
  const uncitedFact: KnowledgePackItem = { factType: 'FACT', statement: 'the port is 4001', citations: [], score: 1, isStale: false };
  assert.throws(
    () => validateKnowledgePackItem(uncitedFact),
    (err: unknown) => err instanceof CitationValidationError && err.code === 'UNCITED_FACT',
    'a FACT with no citations must be rejected',
  );
  const citedFact: KnowledgePackItem = { factType: 'FACT', statement: 'the port is 4001', citations: [citation], score: 1, isStale: false };
  validateKnowledgePackItem(citedFact); // must not throw

  const uncitedSynthesis: KnowledgePackItem = { factType: 'SYNTHESIS', statement: 'combining two facts', citations: [], score: 1, isStale: false };
  assert.throws(
    () => validateKnowledgePackItem(uncitedSynthesis),
    (err: unknown) => err instanceof CitationValidationError && err.code === 'UNCITED_FACT',
    'a SYNTHESIS with no citations must be rejected',
  );

  // --- SUGGESTION must never carry citations (never dressed up as sourced) -------
  const mislabeledSuggestion: KnowledgePackItem = { factType: 'SUGGESTION', statement: 'you might want to add caching', citations: [citation], score: 0.5, isStale: false };
  assert.throws(
    () => validateKnowledgePackItem(mislabeledSuggestion),
    (err: unknown) => err instanceof CitationValidationError && err.code === 'MISLABELED_SUGGESTION',
    'a SUGGESTION carrying citations must be rejected — it would look like a sourced fact',
  );
  const properSuggestion: KnowledgePackItem = { factType: 'SUGGESTION', statement: 'you might want to add caching', citations: [], score: 0.5, isStale: false };
  validateKnowledgePackItem(properSuggestion); // must not throw

  // --- UNKNOWN must never carry citations -----------------------------------------
  const mislabeledUnknown: KnowledgePackItem = { factType: 'UNKNOWN', statement: 'no information found', citations: [citation], score: 0, isStale: false };
  assert.throws(
    () => validateKnowledgePackItem(mislabeledUnknown),
    (err: unknown) => err instanceof CitationValidationError && err.code === 'MISLABELED_UNKNOWN',
  );
  const properUnknown: KnowledgePackItem = { factType: 'UNKNOWN', statement: 'no information found for this query', citations: [], score: 0, isStale: false };
  validateKnowledgePackItem(properUnknown); // must not throw

  // --- every item needs a non-empty statement, regardless of type ------------------
  const emptyStatement: KnowledgePackItem = { factType: 'FACT', statement: '   ', citations: [citation], score: 1, isStale: false };
  assert.throws(
    () => validateKnowledgePackItem(emptyStatement),
    (err: unknown) => err instanceof CitationValidationError && err.code === 'EMPTY_STATEMENT',
  );

  // --- citation stability across an unchanged reindex, and unavailability after -----
  // supersession/deletion, against a real store rather than hand-built fixtures.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mi-5d2-citation-stability-'));
  const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mi-5d2-citation-stability-db-'));
  const store = new DocumentStore(dbDir);
  const service = new KnowledgeDocumentService({ store, roots: { documentRoots: [root] } });

  const filePath = path.join(root, 'stability.md');
  fs.writeFileSync(filePath, '# Stability\n\nThis fixture text is used to check that citation identity survives an unchanged reindex.\n', 'utf8');
  const first = await service.ingestApprovedDocument({ filePath, projectIds: ['proj-stability'] });
  assert.strictEqual(first.status, 'ACTIVE');
  const firstChunk = store.listChunks(first.documentId!)[0];
  const firstCitation = buildCitation(firstChunk, store.getDocument(first.documentId!)!);

  // Re-ingesting the *same* content is a no-op (service.ts reports UNCHANGED) — the
  // chunk id is content-hash-derived, so the citation must resolve to the exact same
  // chunk, not a newly-minted one.
  const second = await service.ingestApprovedDocument({ filePath, operationId: `reindex-unchanged-${Date.now()}`, projectIds: ['proj-stability'] });
  assert.strictEqual(second.status, 'UNCHANGED');
  const secondChunk = store.listChunks(second.documentId!)[0];
  assert.strictEqual(secondChunk.id, firstChunk.id, 'an unchanged reindex preserves the exact chunk id, so old citations stay valid');
  validateCitation(firstCitation, secondChunk, store.getDocument(second.documentId!)!); // must not throw

  // Now genuinely change the content: the old citation's chunk must become unresolvable
  // (SUPERSEDED documents have their chunks deleted), so a caller holding the stale
  // citation can detect it rather than silently trusting stale content.
  fs.writeFileSync(filePath, '# Stability\n\nThis fixture text has changed, so the previous citation must no longer resolve.\n', 'utf8');
  const third = await service.ingestApprovedDocument({ filePath, operationId: `reindex-changed-${Date.now()}`, projectIds: ['proj-stability'] });
  assert.strictEqual(third.status, 'SUPERSEDED');
  const oldDocument = store.getDocument(first.documentId!)!;
  assert.strictEqual(oldDocument.status, 'SUPERSEDED', 'the old document record survives, marked SUPERSEDED, for audit purposes');
  const staleChunkStillExists = store.listChunks(first.documentId!).find(c => c.id === firstChunk.id);
  assert.strictEqual(staleChunkStillExists, undefined, 'the old citation\'s chunk is gone — a superseded citation is unavailable, not silently served');

  // Deletion: the citation becomes unavailable the same way, and the document itself is
  // no longer returned by normal lookups that filter DELETED out.
  fs.writeFileSync(path.join(root, 'to-delete.md'), '# To Delete\n\nThis document about deletion-canary-fact will be removed outright.\n', 'utf8');
  const deletable = await service.ingestApprovedDocument({ filePath: path.join(root, 'to-delete.md'), projectIds: ['proj-stability'] });
  assert.strictEqual(deletable.status, 'ACTIVE');
  const deletableChunkId = store.listChunks(deletable.documentId!)[0].id;
  store.deleteDocument(deletable.documentId!);
  assert.strictEqual(store.listChunks(deletable.documentId!).find(c => c.id === deletableChunkId), undefined, 'a deleted document\'s citation is unavailable');
  assert.strictEqual(store.getDocument(deletable.documentId!)?.status, 'DELETED');

  service.close();
  fs.rmSync(root, { recursive: true, force: true });
  fs.rmSync(dbDir, { recursive: true, force: true });

  console.log('[citations] PASS');
}

run().catch(err => { console.error('[citations] FAIL:', err); process.exit(1); });
