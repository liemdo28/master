/**
 * PostgreSQL + pgvector Client (Phase 35)
 * Falls back gracefully when Postgres not configured.
 * Setup: docker run -d --name mi-postgres -e POSTGRES_PASSWORD=micore -p 5432:5432 pgvector/pgvector:pg16
 * .env: PG_HOST=localhost PG_PORT=5432 PG_DATABASE=micore PG_USER=postgres PG_PASSWORD=micore
 */

let pool: any = null;
let pgAvailable = false;

function getPool(): any {
  if (pool) return pool;
  if (!process.env.PG_HOST) return null;
  try {
    const { Pool } = require('pg');
    pool = new Pool({ host: process.env.PG_HOST || 'localhost', port: parseInt(process.env.PG_PORT || '5432'), database: process.env.PG_DATABASE || 'micore', user: process.env.PG_USER || 'postgres', password: process.env.PG_PASSWORD || '', max: 10, idleTimeoutMillis: 30000, connectionTimeoutMillis: 3000 });
    pool.on('error', (_err: Error) => {});
    pgAvailable = true;
    return pool;
  } catch { pgAvailable = false; return null; }
}

export async function pgQuery(sql: string, params: any[] = []): Promise<any[]> {
  const p = getPool(); if (!p) return [];
  try { const res = await p.query(sql, params); return res.rows; } catch { return []; }
}

export function isPgAvailable(): boolean { return pgAvailable && !!process.env.PG_HOST; }

export async function ensurePgSchema(): Promise<boolean> {
  const p = getPool(); if (!p) return false;
  try {
    await p.query('CREATE EXTENSION IF NOT EXISTS vector');
    await p.query(`CREATE TABLE IF NOT EXISTS embeddings (id SERIAL PRIMARY KEY, source TEXT NOT NULL, content TEXT NOT NULL, metadata JSONB DEFAULT '{}', embedding vector(1536), created_at TIMESTAMPTZ DEFAULT NOW())`);
    await p.query('CREATE INDEX IF NOT EXISTS embeddings_vec_idx ON embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)');
    await p.query(`CREATE TABLE IF NOT EXISTS engineering_tasks_pg (id TEXT PRIMARY KEY, objective TEXT NOT NULL, project TEXT DEFAULT 'mi-core', selected_model TEXT, status TEXT DEFAULT 'PENDING', classification JSONB DEFAULT '{}', routing JSONB DEFAULT '{}', created_at TIMESTAMPTZ DEFAULT NOW(), started_at TIMESTAMPTZ, finished_at TIMESTAMPTZ, review_score INT, pr_branch TEXT, error TEXT)`);
    await p.query(`CREATE TABLE IF NOT EXISTS memory_events (id SERIAL PRIMARY KEY, type TEXT NOT NULL, content TEXT NOT NULL, source TEXT, metadata JSONB DEFAULT '{}', created_at TIMESTAMPTZ DEFAULT NOW())`);
    await p.query(`CREATE TABLE IF NOT EXISTS financial_snapshots (id SERIAL PRIMARY KEY, brand TEXT NOT NULL, period TEXT NOT NULL, revenue NUMERIC, cogs NUMERIC, gross_profit NUMERIC, data JSONB DEFAULT '{}', snapped_at TIMESTAMPTZ DEFAULT NOW())`);
    console.log('[PgClient] Schema ready (pgvector + tables)');
    return true;
  } catch (e: any) { console.warn('[PgClient] Schema setup failed:', e.message); return false; }
}

export async function vectorSearch(embedding: number[], topK = 5): Promise<{ id: number; source: string; content: string; similarity: number }[]> {
  if (!isPgAvailable()) return [];
  const vec = `[${embedding.join(',')}]`;
  return pgQuery('SELECT id, source, content, 1 - (embedding <=> $1::vector) AS similarity FROM embeddings ORDER BY embedding <=> $1::vector LIMIT $2', [vec, topK]);
}

export async function insertEmbedding(source: string, content: string, embedding: number[], metadata: object = {}): Promise<boolean> {
  if (!isPgAvailable()) return false;
  const vec = `[${embedding.join(',')}]`;
  try { await pgQuery('INSERT INTO embeddings (source, content, embedding, metadata) VALUES ($1, $2, $3::vector, $4)', [source, content, vec, JSON.stringify(metadata)]); return true; } catch { return false; }
}
