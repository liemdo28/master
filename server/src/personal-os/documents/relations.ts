/**
 * Lightweight relation derivation. Not a graph database — every relation is a single
 * row keyed by (fromChunkId, toChunkId, relationType), derived deterministically from
 * facts already on hand (version history, heading nesting, exact text/value matches).
 * Nothing here is inferred by a model, so `confidence` reflects how exact the signal
 * was, not a learned probability.
 */

import type { DocumentStore } from './store';
import type { ConflictCandidate } from './conflicts';
import type { DocumentChunk, DocumentRecord, KnowledgeRelationType } from './types';

export interface DerivedRelation {
  fromChunkId: string;
  toChunkId: string;
  relationType: KnowledgeRelationType;
  confidence: number;
}

function isHeadingPrefix(prefix: string[], full: string[]): boolean {
  if (prefix.length >= full.length) return false;
  return prefix.every((title, i) => full[i] === title);
}

/** PART_OF / CONTAINS from heading-path nesting within one document. Exact, confidence 1. */
export function deriveStructuralRelations(chunks: DocumentChunk[]): DerivedRelation[] {
  const out: DerivedRelation[] = [];
  for (const a of chunks) {
    for (const b of chunks) {
      if (a.id === b.id) continue;
      if (isHeadingPrefix(a.headingPath, b.headingPath)) {
        out.push({ fromChunkId: b.id, toChunkId: a.id, relationType: 'PART_OF', confidence: 1 });
        out.push({ fromChunkId: a.id, toChunkId: b.id, relationType: 'CONTAINS', confidence: 1 });
      }
    }
  }
  return out;
}

/** SUPERSEDES / SUPERSEDED_BY, anchored on each document's first chunk. Exact, confidence 1. */
export function deriveVersionRelations(
  newFirstChunk: DocumentChunk | null, oldFirstChunk: DocumentChunk | null,
): DerivedRelation[] {
  if (!newFirstChunk || !oldFirstChunk) return [];
  return [
    { fromChunkId: newFirstChunk.id, toChunkId: oldFirstChunk.id, relationType: 'SUPERSEDES', confidence: 1 },
    { fromChunkId: oldFirstChunk.id, toChunkId: newFirstChunk.id, relationType: 'SUPERSEDED_BY', confidence: 1 },
  ];
}

/** DUPLICATES: identical normalised text in chunks from two different documents. Exact. */
export function deriveDuplicateRelations(chunks: Array<{ chunk: DocumentChunk; document: DocumentRecord }>): DerivedRelation[] {
  const byText = new Map<string, Array<{ chunk: DocumentChunk; document: DocumentRecord }>>();
  for (const entry of chunks) {
    if (entry.chunk.normalizedText.length < 40) continue; // too short to be meaningfully "the same fact"
    const list = byText.get(entry.chunk.normalizedText) ?? [];
    list.push(entry);
    byText.set(entry.chunk.normalizedText, list);
  }
  const out: DerivedRelation[] = [];
  for (const group of byText.values()) {
    const distinctDocs = new Set(group.map(g => g.document.id));
    if (distinctDocs.size < 2) continue;
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        if (group[i].document.id === group[j].document.id) continue;
        // Explicit linkage required even for an exact text match: a scan spanning
        // multiple projects at once must not connect two documents that don't actually
        // share a project just because a scan happened to cover both.
        const sharesProject = group[i].chunk.projectIds.some(p => group[j].chunk.projectIds.includes(p));
        if (!sharesProject) continue;
        out.push({ fromChunkId: group[i].chunk.id, toChunkId: group[j].chunk.id, relationType: 'DUPLICATES', confidence: 1 });
      }
    }
  }
  return out;
}

/** REFERENCES / REFERENCED_BY: a chunk's text literally names another active document. Heuristic. */
export function deriveReferenceRelations(chunks: Array<{ chunk: DocumentChunk; document: DocumentRecord }>): DerivedRelation[] {
  const firstChunkByDoc = new Map<string, DocumentChunk>();
  for (const { chunk, document } of chunks) {
    if (chunk.ordinal === 0) firstChunkByDoc.set(document.id, chunk);
  }
  const out: DerivedRelation[] = [];
  for (const { chunk, document } of chunks) {
    const lowerText = chunk.normalizedText;
    for (const [otherDocId, anchor] of firstChunkByDoc) {
      if (otherDocId === document.id) continue;
      const otherDoc = chunks.find(c => c.document.id === otherDocId)?.document;
      if (!otherDoc) continue;
      if (!document.projectIds.some(p => otherDoc.projectIds.includes(p))) continue; // explicit linkage required
      const needle = otherDoc.title.toLowerCase();
      // A multi-word title is unlikely to appear as an accidental substring the way a
      // single short generic word could — "Deploy Guide" is specific; "Runbook" alone is
      // not high-confidence evidence that a chunk is actually referencing that document.
      const isSpecificTitle = needle.length >= 10 && needle.trim().split(/\s+/).length >= 2;
      if (isSpecificTitle && lowerText.includes(needle)) {
        out.push({ fromChunkId: chunk.id, toChunkId: anchor.id, relationType: 'REFERENCES', confidence: 0.7 });
        out.push({ fromChunkId: anchor.id, toChunkId: chunk.id, relationType: 'REFERENCED_BY', confidence: 0.7 });
      }
    }
  }
  return out;
}

/**
 * RELATED_TO: same project, different documents, and either an explicit shared tag
 * (deliberate metadata, high confidence) or a shared section title specific enough not
 * to be coincidental (at least three words — "Architecture", "Config", "Limits",
 * "Deployment" recur naturally across unrelated documents in any real codebase and are
 * not, on their own, evidence of a relationship; "Choose Zustand Over Redux" is).
 */
const GENERIC_HEADING_MIN_WORDS = 3;

export function deriveRelatedToRelations(chunks: Array<{ chunk: DocumentChunk; document: DocumentRecord }>): DerivedRelation[] {
  const out: DerivedRelation[] = [];
  for (let i = 0; i < chunks.length; i++) {
    for (let j = i + 1; j < chunks.length; j++) {
      const a = chunks[i];
      const b = chunks[j];
      if (a.document.id === b.document.id) continue;
      const sharesProject = a.chunk.projectIds.some(p => b.chunk.projectIds.includes(p));
      if (!sharesProject) continue;
      const sharesTag = a.chunk.tags.some(t => b.chunk.tags.includes(t));
      const sharedSectionIsSpecific = Boolean(a.chunk.sectionTitle)
        && a.chunk.sectionTitle === b.chunk.sectionTitle
        && a.chunk.sectionTitle!.trim().split(/\s+/).length >= GENERIC_HEADING_MIN_WORDS;
      if (sharesTag || sharedSectionIsSpecific) {
        out.push({ fromChunkId: a.chunk.id, toChunkId: b.chunk.id, relationType: 'RELATED_TO', confidence: 0.5 });
      }
    }
  }
  return out;
}

/** CONTRADICTS / CONTRADICTED_BY: one relation pair per chunk pair inside a detected conflict. Exact. */
export function deriveContradictionRelations(candidates: ConflictCandidate[]): DerivedRelation[] {
  const out: DerivedRelation[] = [];
  for (const candidate of candidates) {
    for (let i = 0; i < candidate.chunkIds.length; i++) {
      for (let j = i + 1; j < candidate.chunkIds.length; j++) {
        out.push({ fromChunkId: candidate.chunkIds[i], toChunkId: candidate.chunkIds[j], relationType: 'CONTRADICTS', confidence: 1 });
        out.push({ fromChunkId: candidate.chunkIds[j], toChunkId: candidate.chunkIds[i], relationType: 'CONTRADICTED_BY', confidence: 1 });
      }
    }
  }
  return out;
}

export interface RelationScanResult {
  scanned: number;
  created: number;
}

/**
 * Scans every ACTIVE document visible to the given project ids and persists derived
 * relations (idempotent: `createRelation` is `INSERT OR IGNORE` on the same triple).
 * Version relations are derived separately, from `supersedesId`, against SUPERSEDED
 * documents' surviving chunk-0 record where still resolvable.
 */
export function scanForRelations(store: DocumentStore, projectIds: string[]): RelationScanResult {
  const active = store.listDocuments('ACTIVE', 500).filter(d => d.projectIds.some(p => projectIds.includes(p)));
  const entries: Array<{ chunk: DocumentChunk; document: DocumentRecord }> = [];
  for (const document of active) {
    for (const chunk of store.listChunks(document.id)) entries.push({ chunk, document });
  }

  const derived: DerivedRelation[] = [
    ...active.flatMap(document => deriveStructuralRelations(store.listChunks(document.id))),
    ...deriveDuplicateRelations(entries),
    ...deriveReferenceRelations(entries),
    ...deriveRelatedToRelations(entries),
  ];

  let created = 0;
  for (const relation of derived) {
    store.createRelation(relation);
    created++;
  }
  return { scanned: entries.length, created };
}
