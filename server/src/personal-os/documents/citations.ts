/**
 * Citation contract — the only code path allowed to build or validate a Citation.
 *
 * A Citation points at an exact source range (heading path, line range or page number,
 * plus the document and chunk checksums it was built from) and never carries
 * `canonicalPath`. Validation here is what stands between a KnowledgePack and a fact
 * with no evidence, a stale checksum, or a suggestion dressed up as sourced.
 */

import type { Citation, DocumentChunk, DocumentRecord, KnowledgePackItem } from './types';

export class CitationValidationError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = 'CitationValidationError';
  }
}

/** The only code path allowed to construct a Citation. */
export function buildCitation(chunk: DocumentChunk, document: DocumentRecord): Citation {
  return {
    documentId: document.id,
    chunkId: chunk.id,
    title: document.title,
    sourceUri: document.sourceUri,
    headingPath: chunk.headingPath,
    sectionTitle: chunk.sectionTitle,
    lineStart: chunk.lineStart,
    lineEnd: chunk.lineEnd,
    pageNumber: chunk.pageNumber,
    documentChecksum: document.checksum,
    chunkContentHash: chunk.contentHash,
    projectIds: chunk.projectIds,
    documentStatus: document.status,
  };
}

/** Confirms a citation still matches the chunk/document it claims to cite, checksum included. */
export function validateCitation(citation: Citation, chunk: DocumentChunk, document: DocumentRecord): void {
  if (citation.documentId !== document.id || citation.chunkId !== chunk.id) {
    throw new CitationValidationError('CITATION_MISMATCH', 'citation does not reference the given chunk/document');
  }
  if (citation.documentChecksum !== document.checksum) {
    throw new CitationValidationError('CHECKSUM_MISMATCH', 'citation checksum does not match the current document');
  }
  if (citation.chunkContentHash !== chunk.contentHash) {
    throw new CitationValidationError('CHECKSUM_MISMATCH', 'citation checksum does not match the current chunk');
  }
  if ('canonicalPath' in (citation as unknown as Record<string, unknown>)) {
    throw new CitationValidationError('PATH_LEAK', 'a citation must never carry canonicalPath');
  }
}

/**
 * Enforces the fact/synthesis/suggestion/unknown typing policy: FACT and SYNTHESIS must
 * be cited; SUGGESTION must carry no citations, so it can never be mistaken for a sourced
 * fact; UNKNOWN must carry no citations and must say, in the statement itself, what is
 * unknown rather than silently returning nothing.
 */
export function validateKnowledgePackItem(item: KnowledgePackItem): void {
  if (!item.statement || !item.statement.trim()) {
    throw new CitationValidationError('EMPTY_STATEMENT', 'every item must carry a non-empty statement');
  }
  switch (item.factType) {
    case 'FACT':
    case 'SYNTHESIS':
      if (!item.citations.length) {
        throw new CitationValidationError('UNCITED_FACT', `${item.factType} items must carry at least one citation`);
      }
      break;
    case 'SUGGESTION':
      if (item.citations.length) {
        throw new CitationValidationError(
          'MISLABELED_SUGGESTION',
          "a SUGGESTION must not carry citations — it is Mi's own inference, not a sourced fact",
        );
      }
      break;
    case 'UNKNOWN':
      if (item.citations.length) {
        throw new CitationValidationError('MISLABELED_UNKNOWN', 'an UNKNOWN item must not carry citations');
      }
      break;
    default:
      throw new CitationValidationError('INVALID_FACT_TYPE', 'unrecognised factType');
  }
}
