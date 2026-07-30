/**
 * RAG Engine — Search / Memory / Knowledge
 * Embedding (BGE/OpenAI) → Vector Store (Qdrant/SQLite-vec) → Reranker → Answer
 * Falls back to keyword search against existing knowledge.db when Qdrant offline.
 */

import https from 'https';
import * as path from 'path';
import Database from 'better-sqlite3';

const GLOBAL_DIR = process.env.GLOBAL_DIR || 'E:/Project/Master/.local-agent-global';
const KB_PATH    = path.join(GLOBAL_DIR, 'knowledge-db', 'knowledge.db');
const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
const COLLECTION = 'mi-knowledge';

export interface RagResult {
  text:       string;
  source:     string;
  score:      number;
  metadata?:  Record<string, any>;
}

export interface RagResponse {
  query:      string;
  results:    RagResult[];
  strategy:   'vector' | 'keyword' | 'hybrid';
  latency_ms: number;
}

// ── Embedding via OpenAI ──────────────────────────────────────────────────────

async function embed(text: string): Promise<number[] | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;

  return new Promise((resolve) => {
    const body = JSON.stringify({ model: 'text-embedding-3-small', input: text });
    const req  = https.request({
      hostname: 'api.openai.com', path: '/v1/embeddings', method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json',
                 'Content-Length': Buffer.byteLength(body) },
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d).data?.[0]?.embedding || null); }
        catch { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(10000, () => { req.destroy(); resolve(null); });
    req.write(body); req.end();
  });
}

// ── Qdrant search ─────────────────────────────────────────────────────────────

async function qdrantSearch(embedding: number[], topK: number): Promise<RagResult[]> {
  return new Promise((resolve) => {
    const body = JSON.stringify({ vector: embedding, limit: topK, with_payload: true });
    const url  = new URL(`${QDRANT_URL}/collections/${COLLECTION}/points/search`);
    const lib  = url.protocol === 'https:' ? https : require('http');

    const req = lib.request({
      hostname: url.hostname, port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, (res: any) => {
      let d = '';
      res.on('data', (c: any) => d += c);
      res.on('end', () => {
        try {
          const hits = JSON.parse(d).result || [];
          resolve(hits.map((h: any) => ({
            text:     h.payload?.text || '',
            source:   h.payload?.source || 'qdrant',
            score:    h.score,
            metadata: h.payload,
          })));
        } catch { resolve([]); }
      });
    });
    req.on('error', () => resolve([]));
    req.setTimeout(5000, () => { req.destroy(); resolve([]); });
    req.write(body); req.end();
  });
}

// ── Keyword fallback via knowledge.db ─────────────────────────────────────────

function keywordSearch(query: string, topK: number): RagResult[] {
  try {
    const db   = new Database(KB_PATH, { readonly: true });
    const terms = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    if (!terms.length) return [];

    const like = terms.map(() => `(content LIKE ? OR title LIKE ?)`).join(' OR ');
    const vals = terms.flatMap(t => [`%${t}%`, `%${t}%`]);

    const rows = db.prepare(
      `SELECT title, content, source, category FROM knowledge WHERE ${like} LIMIT ?`
    ).all(...vals, topK) as any[];

    return rows.map((r, i) => ({
      text:   `${r.title ? r.title + '\n' : ''}${(r.content || '').slice(0, 600)}`,
      source: r.source || r.category || 'knowledge.db',
      score:  1 - i * 0.05,
    }));
  } catch {
    return [];
  }
}

// ── Reranker (score-based, no external API needed) ────────────────────────────

function rerank(query: string, results: RagResult[]): RagResult[] {
  const qTerms = new Set(query.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  return results
    .map(r => {
      const text  = r.text.toLowerCase();
      const hits  = [...qTerms].filter(t => text.includes(t)).length;
      const boost = hits / Math.max(qTerms.size, 1);
      return { ...r, score: r.score * 0.7 + boost * 0.3 };
    })
    .sort((a, b) => b.score - a.score);
}

// ── Main search ───────────────────────────────────────────────────────────────

export async function search(query: string, topK: number = 5): Promise<RagResponse> {
  const start = Date.now();
  let results: RagResult[] = [];
  let strategy: RagResponse['strategy'] = 'keyword';

  // 1. Try vector search
  const embedding = await embed(query);
  if (embedding) {
    const vectorHits = await qdrantSearch(embedding, topK);
    if (vectorHits.length) {
      results  = vectorHits;
      strategy = 'vector';
    }
  }

  // 2. Keyword fallback
  const kwHits = keywordSearch(query, topK);
  if (kwHits.length) {
    results  = strategy === 'vector' ? [...results, ...kwHits] : kwHits;
    strategy = strategy === 'vector' ? 'hybrid' : 'keyword';
  }

  // 3. Rerank
  results = rerank(query, results).slice(0, topK);

  return { query, results, strategy, latency_ms: Date.now() - start };
}

// ── Ingest document into Qdrant ───────────────────────────────────────────────

export async function ingest(text: string, source: string, metadata: Record<string, any> = {}): Promise<boolean> {
  const embedding = await embed(text);
  if (!embedding) return false;

  const body = JSON.stringify({
    points: [{ id: Date.now(), vector: embedding, payload: { text, source, ...metadata } }],
  });

  return new Promise((resolve) => {
    const url = new URL(`${QDRANT_URL}/collections/${COLLECTION}/points`);
    const lib = url.protocol === 'https:' ? https : require('http');
    const req = lib.request({
      hostname: url.hostname, port: url.port || 6333,
      path: url.pathname, method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, (res: any) => {
      res.on('data', () => {});
      res.on('end', () => resolve(res.statusCode < 300));
    });
    req.on('error', () => resolve(false));
    req.write(body); req.end();
  });
}
