import { indexTextChunks } from '../bigdata/memory-indexer';
import { hybridSearch } from '../bigdata/search-service';
import { pgQuery } from '../bigdata/db-client';

export async function addMemory(params: {
  text: string;
  title: string;
  source_id: number;
  raw_object_id?: number;
  chunk_type?: string;
  store_id?: string;
  tags?: string[];
  actor?: string;
}) {
  return indexTextChunks(params);
}

export async function searchMemory(query: string, filters: Record<string, string> = {}, limit = 10) {
  return hybridSearch(query, filters, limit);
}

export async function summarizeMemory(query: string, filters: Record<string, string> = {}, limit = 10) {
  const results = await searchMemory(query, filters, limit);
  return {
    query,
    count: results.length,
    summary: results.slice(0, 5).map(r => `${r.title}: ${r.description || r.text || ''}`).join('\n'),
    results,
  };
}

export async function syncMemory(sourceId?: number) {
  const params: unknown[] = [];
  const where = sourceId ? 'WHERE source_id=$1' : '';
  if (sourceId) params.push(sourceId);
  const rows = await pgQuery<{ count: string }>(
    `SELECT COUNT(*)::text as count FROM memory_chunks ${where}`,
    params,
  );
  return {
    status: 'canonical',
    vector_store: 'qdrant',
    memory_intelligence: 'supermemory-adapter-pending',
    knowledge_portal: 'ragflow-adapter-pending',
    chunks: parseInt(rows[0]?.count || '0', 10),
  };
}

export const memoryRouterBoundary = {
  addMemory,
  searchMemory,
  summarizeMemory,
  syncMemory,
};
