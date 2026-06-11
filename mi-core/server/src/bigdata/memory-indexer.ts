/**
 * Memory Indexer — chunk text, generate embeddings, store in Qdrant + PostgreSQL.
 */

import { pgQuery } from './db-client';
import { auditLog } from './audit-service';
import { redactSecrets } from './secret-redactor';
import { providerRouter } from '../providers/provider-router';
import { loadBigDataEnv } from './env';

loadBigDataEnv();

const QDRANT_URL    = process.env.QDRANT_URL    || 'http://localhost:6333';
const COLLECTION    = process.env.QDRANT_COLLECTION || 'mi_bigdata';
const CHUNK_SIZE    = 800;
const CHUNK_OVERLAP = 100;

export interface ChunkRecord {
  id: number;
  source_id: number;
  raw_object_id?: number;
  chunk_type: string;
  title: string;
  text: string;
  embedding_id: string;
  store_id?: string;
  tags: string[];
}

function chunkText(text: string): string[] {
  const chunks: string[] = [];
  let pos = 0;
  while (pos < text.length) {
    chunks.push(text.slice(pos, pos + CHUNK_SIZE));
    pos += CHUNK_SIZE - CHUNK_OVERLAP;
  }
  return chunks.filter(c => c.trim().length > 20);
}

async function generateEmbedding(text: string): Promise<number[]> {
  const result = await providerRouter.generateEmbedding(text);
  return result.embedding;
}

async function ensureQdrantCollection(): Promise<void> {
  const check = await fetch(`${QDRANT_URL}/collections/${COLLECTION}`);
  if (check.ok) return;

  await fetch(`${QDRANT_URL}/collections/${COLLECTION}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vectors: { size: 768, distance: 'Cosine' } }),
  });
}

async function upsertQdrantPoint(id: string, vector: number[], payload: Record<string, unknown>): Promise<void> {
  await fetch(`${QDRANT_URL}/collections/${COLLECTION}/points`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      points: [{ id: hashToUuid(id), vector, payload }],
    }),
  });
}

function hashToUuid(str: string): string {
  const crypto = require('crypto');
  const hash = crypto.createHash('sha256').update(str).digest('hex');
  return `${hash.slice(0,8)}-${hash.slice(8,12)}-${hash.slice(12,16)}-${hash.slice(16,20)}-${hash.slice(20,32)}`;
}

export async function indexTextChunks(params: {
  text: string;
  title: string;
  source_id: number;
  raw_object_id?: number;
  chunk_type?: string;
  store_id?: string;
  tags?: string[];
  actor?: string;
}): Promise<{ chunks_indexed: number; chunk_ids: number[] }> {
  const { text, title, source_id, raw_object_id, chunk_type = 'text', store_id, tags = [], actor = 'system' } = params;

  // Redact before indexing
  const { redacted, found } = redactSecrets(text);
  if (found.length > 0) {
    console.warn('[BigData:MemoryIndexer] Redacted secrets before indexing:', found);
  }

  await ensureQdrantCollection();

  const chunks = chunkText(redacted);
  const chunkIds: number[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const embeddingId = `${source_id}_${raw_object_id || 'noobj'}_${i}_${Date.now()}`;

    let vector: number[] = [];
    try {
      vector = await generateEmbedding(chunk);
    } catch (e) {
      console.warn('[BigData:MemoryIndexer] Embedding failed, skipping vector:', e);
    }

    if (vector.length > 0) {
      await upsertQdrantPoint(embeddingId, vector, {
        source_id, raw_object_id, chunk_type, title, store_id, tags,
        text: chunk.slice(0, 300),
      });
    }

    const rows = await pgQuery<{ id: number }>(
      `INSERT INTO memory_chunks (source_id, raw_object_id, chunk_type, title, text, embedding_id, store_id, tags)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [source_id, raw_object_id || null, chunk_type, title, chunk, embeddingId, store_id || null, tags]
    );
    chunkIds.push(rows[0].id);
  }

  await auditLog({ actor, action: 'index_memory', entity_type: 'memory_chunk', after_json: { count: chunks.length, source_id, title } });
  return { chunks_indexed: chunks.length, chunk_ids: chunkIds };
}

export async function isQdrantAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${QDRANT_URL}/healthz`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}
