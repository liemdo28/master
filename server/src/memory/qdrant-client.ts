/**
 * Qdrant Semantic Memory Client — WS6
 *
 * Collections:
 *   mi_memory      — executive memory snippets
 *   mi_knowledge   — knowledge DB documents
 *   mi_messages    — WhatsApp + chat history
 *   mi_compliance  — compliance DB chunks (future)
 *
 * Setup: docker run -p 6333:6333 -p 6334:6334 qdrant/qdrant
 * Embed model: nomic-embed-text (already in Ollama)
 */

import { QdrantClient } from '@qdrant/js-client-rest';

const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const EMBED_MODEL = 'nomic-embed-text';
const VECTOR_SIZE = 768;  // nomic-embed-text dimension

export const qdrant = new QdrantClient({ url: QDRANT_URL });

export const COLLECTIONS = {
  MEMORY: 'mi_memory',
  KNOWLEDGE: 'mi_knowledge',
  MESSAGES: 'mi_messages',
  COMPLIANCE: 'mi_compliance',
  PROJECTS: 'mi_projects',
} as const;

// ── Health check ───────────────────────────────────────────────────────────
export async function isQdrantAvailable(): Promise<boolean> {
  try {
    await qdrant.getCollections();
    return true;
  } catch { return false; }
}

// ── Embedding via Ollama ───────────────────────────────────────────────────
export async function embed(text: string): Promise<number[]> {
  const res = await fetch(`${OLLAMA_URL}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: EMBED_MODEL, prompt: text }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Embed error: ${res.status}`);
  const data = await res.json() as { embedding: number[] };
  return data.embedding;
}

// ── Collection bootstrap ───────────────────────────────────────────────────
export async function ensureCollection(name: string): Promise<void> {
  try {
    await qdrant.getCollection(name);
  } catch {
    await qdrant.createCollection(name, {
      vectors: { size: VECTOR_SIZE, distance: 'Cosine' },
    });
    console.log(`[Qdrant] Created collection: ${name}`);
  }
}

export async function initCollections(): Promise<void> {
  for (const name of Object.values(COLLECTIONS)) {
    await ensureCollection(name);
  }
}

// ── Upsert ────────────────────────────────────────────────────────────────
export async function upsertPoint(
  collection: string,
  id: string | number,
  text: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const vector = await embed(text);
  await qdrant.upsert(collection, {
    wait: true,
    points: [{ id, vector, payload: { ...payload, text, indexed_at: new Date().toISOString() } }],
  });
}

// ── Search ────────────────────────────────────────────────────────────────
export interface QdrantSearchResult {
  id: string | number;
  score: number;
  payload: Record<string, unknown>;
}

export async function semanticSearch(
  collection: string,
  query: string,
  limit = 5,
  filter?: Record<string, unknown>,
): Promise<QdrantSearchResult[]> {
  const vector = await embed(query);
  const res = await qdrant.search(collection, {
    vector,
    limit,
    with_payload: true,
    filter,
  });
  return res.map(r => ({
    id: r.id,
    score: r.score,
    payload: r.payload as Record<string, unknown>,
  }));
}

// ── Delete ────────────────────────────────────────────────────────────────
export async function deletePoint(collection: string, id: string | number): Promise<void> {
  await qdrant.delete(collection, { points: [id] });
}

// ── High-level: search memory ─────────────────────────────────────────────
export async function searchMemory(query: string, limit = 5): Promise<QdrantSearchResult[]> {
  try {
    return await semanticSearch(COLLECTIONS.MEMORY, query, limit);
  } catch { return []; }
}

// ── High-level: index a memory snippet ───────────────────────────────────
export async function indexMemorySnippet(
  key: string,
  text: string,
  category: string,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  const id = Math.abs(hashString(key));
  await upsertPoint(COLLECTIONS.MEMORY, id, text, { key, category, ...metadata });
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(31, h) + s.charCodeAt(i) | 0;
  }
  return h;
}
