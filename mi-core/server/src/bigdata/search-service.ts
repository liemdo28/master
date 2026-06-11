/**
 * Search Service — hybrid keyword (PostgreSQL) + semantic (Qdrant) search.
 */

import { pgQuery } from './db-client';
import { providerRouter } from '../providers/provider-router';
import { loadBigDataEnv } from './env';

loadBigDataEnv();

const QDRANT_URL  = process.env.QDRANT_URL       || 'http://localhost:6333';
const COLLECTION  = process.env.QDRANT_COLLECTION || 'mi_bigdata';

export interface SearchResult {
  id: string | number;
  type: 'event' | 'chunk';
  score: number;
  title: string;
  description?: string;
  event_type?: string;
  store_id?: string;
  event_time?: string;
  source?: string;
  text?: string;
}

async function keywordSearch(query: string, filters: Record<string, string>, limit: number): Promise<SearchResult[]> {
  const words = query.split(/\s+/).filter(w => w.length > 2).slice(0, 6);
  if (words.length === 0) return [];

  const conditions: string[] = ['(e.title ILIKE $1 OR e.description ILIKE $1)'];
  const params: unknown[] = [`%${query}%`];
  let pidx = 2;

  if (filters['store_id']) { conditions.push(`e.store_id = $${pidx++}`); params.push(filters['store_id']); }
  if (filters['event_type']) { conditions.push(`e.event_type = $${pidx++}`); params.push(filters['event_type']); }
  if (filters['date_from']) { conditions.push(`e.event_time >= $${pidx++}`); params.push(filters['date_from']); }
  if (filters['date_to']) { conditions.push(`e.event_time <= $${pidx++}`); params.push(filters['date_to']); }

  params.push(limit);

  const rows = await pgQuery<{
    id: number; title: string; description: string; event_type: string;
    store_id: string; event_time: string; name: string;
  }>(
    `SELECT e.id, e.title, e.description, e.event_type, e.store_id, e.event_time, s.name
     FROM normalized_events e
     JOIN data_sources s ON s.id = e.source_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY e.event_time DESC
     LIMIT $${pidx}`,
    params
  );

  return rows.map(r => ({
    id: r.id,
    type: 'event' as const,
    score: 0.8,
    title: r.title || '',
    description: r.description,
    event_type: r.event_type,
    store_id: r.store_id,
    event_time: r.event_time,
    source: r.name,
  }));
}

async function semanticSearch(query: string, limit: number): Promise<SearchResult[]> {
  try {
    const { embedding } = await providerRouter.generateEmbedding(query, { timeoutMs: 5000 });

    const searchRes = await fetch(`${QDRANT_URL}/collections/${COLLECTION}/points/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vector: embedding, limit, with_payload: true }),
      signal: AbortSignal.timeout(5000),
    });
    if (!searchRes.ok) return [];

    const data = await searchRes.json() as { result: Array<{ id: string; score: number; payload: Record<string, unknown> }> };
    return (data.result || []).map(r => ({
      id: r.id,
      type: 'chunk' as const,
      score: r.score,
      title: String(r.payload['title'] || ''),
      text: String(r.payload['text'] || ''),
      store_id: r.payload['store_id'] as string,
      source: String(r.payload['source_id'] || ''),
    }));
  } catch {
    return [];
  }
}

export async function hybridSearch(
  query: string,
  filters: Record<string, string> = {},
  limit = 20
): Promise<SearchResult[]> {
  const [kw, sem] = await Promise.allSettled([
    keywordSearch(query, filters, limit),
    semanticSearch(query, Math.ceil(limit / 2)),
  ]);

  const kwResults = kw.status === 'fulfilled' ? kw.value : [];
  const semResults = sem.status === 'fulfilled' ? sem.value : [];

  // Merge, deduplicate by id, sort by score
  const seen = new Set<string>();
  const merged: SearchResult[] = [];
  for (const r of [...kwResults, ...semResults]) {
    const key = `${r.type}:${r.id}`;
    if (!seen.has(key)) { seen.add(key); merged.push(r); }
  }

  return merged.sort((a, b) => b.score - a.score).slice(0, limit);
}

export async function listEvents(filters: {
  store_id?: string;
  event_type?: string;
  source?: string;
  date_from?: string;
  date_to?: string;
  limit?: number;
}): Promise<unknown[]> {
  const conditions: string[] = ['1=1'];
  const params: unknown[] = [];
  let pidx = 1;

  if (filters.store_id)   { conditions.push(`e.store_id = $${pidx++}`);     params.push(filters.store_id); }
  if (filters.event_type) { conditions.push(`e.event_type = $${pidx++}`);   params.push(filters.event_type); }
  if (filters.source)     { conditions.push(`s.name = $${pidx++}`);          params.push(filters.source); }
  if (filters.date_from)  { conditions.push(`e.event_time >= $${pidx++}`);  params.push(filters.date_from); }
  if (filters.date_to)    { conditions.push(`e.event_time <= $${pidx++}`);  params.push(filters.date_to); }

  params.push(filters.limit || 50);

  return pgQuery(
    `SELECT e.*, s.name as source_name FROM normalized_events e
     JOIN data_sources s ON s.id = e.source_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY e.event_time DESC LIMIT $${pidx}`,
    params
  );
}
