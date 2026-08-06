/**
 * Deterministic chunking.
 *
 * Determinism is the whole point: the same input must always produce the same chunk
 * ids, so re-indexing an unchanged document is a no-op and a citation stays valid.
 * Chunk ids are therefore derived from (documentId, ordinal, contentHash) rather than
 * from a random uuid or a timestamp.
 */

import { createHash } from 'crypto';
import {
  CHUNK_DEFAULTS, DOCUMENT_LIMITS,
  type DocumentChunk, type DocumentSensitivity, type ParsedSection,
} from './types';
import { scanForSecrets } from './secret-scanner';

export interface ChunkInput {
  documentId: string;
  sections: ParsedSection[];
  projectIds: string[];
  sensitivity: DocumentSensitivity;
  tags?: string[];
  now: string;
}

export interface ChunkResult {
  chunks: DocumentChunk[];
  /** Sections dropped because they carried credential-like content. */
  rejectedSections: number;
  duplicatesSkipped: number;
}

export function normaliseText(input: string): string {
  return input
    .toLowerCase()
    .replace(/[`*_~>#|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function estimateTokens(text: string): number {
  // Rough but stable: good enough for budgeting, and deterministic.
  return Math.max(1, Math.ceil(text.length / 4));
}

export function chunkContentHash(documentId: string, headingPath: string[], text: string): string {
  return createHash('sha256')
    .update(JSON.stringify({ documentId, headingPath, text }))
    .digest('hex');
}

/**
 * Splits an oversized section on paragraph boundaries where possible, falling back to
 * sentence and then hard character boundaries. Overlap carries a little context across
 * the seam so a fact split across a boundary is still retrievable from either side.
 */
function splitOversized(text: string): string[] {
  if (text.length <= CHUNK_DEFAULTS.maxChars) return [text];
  const out: string[] = [];
  const paragraphs = text.split(/\n\s*\n/);
  let current = '';

  const push = (value: string) => {
    const trimmed = value.trim();
    if (trimmed) out.push(trimmed);
  };

  for (const paragraph of paragraphs) {
    if (paragraph.length > CHUNK_DEFAULTS.maxChars) {
      push(current); current = '';
      // Sentence boundaries, then hard slices for text with none (minified, tables).
      const sentences = paragraph.match(/[^.!?\n]+[.!?]*\s*/g) ?? [paragraph];
      let piece = '';
      for (const sentence of sentences) {
        if (sentence.length > CHUNK_DEFAULTS.maxChars) {
          push(piece); piece = '';
          for (let i = 0; i < sentence.length; i += CHUNK_DEFAULTS.targetChars) {
            push(sentence.slice(i, i + CHUNK_DEFAULTS.targetChars));
          }
          continue;
        }
        if (piece.length + sentence.length > CHUNK_DEFAULTS.targetChars) { push(piece); piece = ''; }
        piece += sentence;
      }
      push(piece);
      continue;
    }
    if (current.length + paragraph.length + 2 > CHUNK_DEFAULTS.targetChars) {
      push(current);
      // Overlap: reuse the tail of the previous chunk as leading context.
      const tail = current.slice(-CHUNK_DEFAULTS.overlapChars);
      current = tail ? `${tail}\n\n${paragraph}` : paragraph;
    } else {
      current = current ? `${current}\n\n${paragraph}` : paragraph;
    }
  }
  push(current);
  return out.length ? out : [text.slice(0, CHUNK_DEFAULTS.maxChars)];
}

export function buildChunks(input: ChunkInput): ChunkResult {
  const chunks: DocumentChunk[] = [];
  const seen = new Set<string>();
  let rejectedSections = 0;
  let duplicatesSkipped = 0;
  let ordinal = 0;

  for (const section of input.sections) {
    const sectionText = (section.text || '').trim();
    if (sectionText.length < CHUNK_DEFAULTS.minChars) continue;

    // Belt and braces: the whole file was scanned before parsing, but a section is
    // scanned again so a credential introduced by a parser transform cannot slip in.
    if (scanForSecrets(sectionText).classification === 'SECRET_REJECTED') {
      rejectedSections++;
      continue;
    }

    for (const piece of splitOversized(sectionText)) {
      if (chunks.length >= DOCUMENT_LIMITS.maxChunksPerDocument) return finish();
      const text = piece.trim();
      if (text.length < CHUNK_DEFAULTS.minChars) continue;

      const contentHash = chunkContentHash(input.documentId, section.headingPath, text);
      if (seen.has(contentHash)) { duplicatesSkipped++; continue; }
      seen.add(contentHash);

      chunks.push({
        // Deterministic id: same document + position + content ⇒ same id, every run.
        id: `chunk-${contentHash.slice(0, 32)}`,
        documentId: input.documentId,
        ordinal: ordinal++,
        headingPath: section.headingPath,
        text,
        normalizedText: normaliseText(text),
        tokenEstimate: estimateTokens(text),
        contentHash,
        sourceStart: section.sourceStart,
        sourceEnd: section.sourceEnd,
        lineStart: section.lineStart,
        lineEnd: section.lineEnd,
        pageNumber: section.pageNumber,
        sectionTitle: section.sectionTitle,
        tags: input.tags ?? [],
        projectIds: input.projectIds,
        sensitivity: input.sensitivity,
        createdAt: input.now,
        updatedAt: input.now,
      });
    }
  }
  return finish();

  function finish(): ChunkResult {
    return { chunks, rejectedSections, duplicatesSkipped };
  }
}
