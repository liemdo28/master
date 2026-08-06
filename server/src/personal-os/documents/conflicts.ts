/**
 * Lightweight conflict detection.
 *
 * No embeddings, no LLM judgement call — a conflict candidate is raised only when two
 * ACTIVE chunks from *different* documents assert a different value for what looks like
 * the same labelled fact (`key: value`, `key = value`, `key is value`). That is
 * deliberately narrow: it will miss conflicts phrased in prose, but it will never
 * silently pick a winner, and every candidate it raises is explainable from the two
 * exact quotes that triggered it.
 */

import type { DocumentRecord, DocumentChunk } from './types';
import type { DocumentStore } from './store';

export interface ConflictCandidate {
  chunkIds: string[];
  documentIds: string[];
  projectIds: string[];
  description: string;
  detectionReason: string;
}

interface ExtractedFact { key: string; value: string; chunk: DocumentChunk; document: DocumentRecord }

const VALUE_PATTERN = /\b([a-z][a-z0-9 _-]{2,40}?)\s*(?:[:=]|is)\s*([a-z0-9][a-z0-9._/:-]{0,60})\b/gi;
const MAX_CANDIDATES = 200;

function extractFacts(chunk: DocumentChunk, document: DocumentRecord): ExtractedFact[] {
  const facts: ExtractedFact[] = [];
  const re = new RegExp(VALUE_PATTERN);
  let match: RegExpExecArray | null;
  while ((match = re.exec(chunk.normalizedText))) {
    const key = match[1].trim();
    const value = match[2].trim();
    if (key.length < 3 || !value) continue;
    facts.push({ key, value, chunk, document });
  }
  return facts;
}

/** Pure detection over an in-memory set of ACTIVE chunks. Never touches the database. */
export function detectConflicts(chunks: Array<{ chunk: DocumentChunk; document: DocumentRecord }>): ConflictCandidate[] {
  const byKey = new Map<string, ExtractedFact[]>();
  for (const { chunk, document } of chunks) {
    for (const fact of extractFacts(chunk, document)) {
      const list = byKey.get(fact.key) ?? [];
      list.push(fact);
      byKey.set(fact.key, list);
    }
  }

  const candidates: ConflictCandidate[] = [];
  for (const [key, facts] of byKey) {
    if (candidates.length >= MAX_CANDIDATES) break;
    const documentIds = new Set(facts.map(f => f.document.id));
    if (documentIds.size < 2) continue; // same-doc repetition is not a conflict

    const distinctValues = new Set(facts.map(f => f.value));
    if (distinctValues.size < 2) continue; // everyone agrees

    const seenChunk = new Set<string>();
    const involved = facts.filter(f => (seenChunk.has(f.chunk.id) ? false : (seenChunk.add(f.chunk.id), true)));
    candidates.push({
      chunkIds: involved.map(f => f.chunk.id),
      documentIds: [...documentIds],
      projectIds: [...new Set(involved.flatMap(f => f.chunk.projectIds))],
      description: `documents disagree on "${key}": ${[...distinctValues].map(v => `"${v}"`).join(' vs ')}`,
      detectionReason: 'differing-value-for-shared-key',
    });
  }
  return candidates;
}

export interface ConflictScanResult {
  scanned: number;
  candidatesFound: number;
  created: number;
  alreadyRaised: number;
}

/**
 * Scans every ACTIVE chunk visible to the given project ids, raises any new conflict
 * candidates, and returns a summary. Never resolves a conflict itself.
 *
 * Conflict identity is the exact set of chunk ids involved, and chunk ids are
 * content-hash-derived — so once a chunk pair's disagreement has been raised in *any*
 * status (including RESOLVED/DISMISSED), rescanning never raises it again unless the
 * underlying content actually changes (which mints new chunk ids and is a genuinely new
 * conflict). A human who resolved "30s is correct" should not be asked again every scan.
 */
export function scanForConflicts(store: DocumentStore, projectIds: string[]): ConflictScanResult {
  const chunks: Array<{ chunk: DocumentChunk; document: DocumentRecord }> = [];
  for (const document of store.listDocuments('ACTIVE', 500)) {
    if (!document.projectIds.some(p => projectIds.includes(p))) continue;
    for (const chunk of store.listChunks(document.id)) chunks.push({ chunk, document });
  }

  const candidates = detectConflicts(chunks);
  const existingKeys = new Set(store.listConflicts(undefined, 1000).map(c => [...c.chunkIds].sort().join('|')));

  let created = 0;
  let alreadyRaised = 0;
  for (const candidate of candidates) {
    const key = [...candidate.chunkIds].sort().join('|');
    if (existingKeys.has(key)) { alreadyRaised++; continue; }
    store.createConflict(candidate);
    existingKeys.add(key);
    created++;
  }

  return { scanned: chunks.length, candidatesFound: candidates.length, created, alreadyRaised };
}
