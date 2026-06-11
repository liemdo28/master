/**
 * PostgreSQL client for Mi Big Data.
 * Uses pg (node-postgres). Lazy-connect — no crash if Postgres is down.
 */

import { Pool, PoolClient } from 'pg';
import { loadBigDataEnv } from './env';

loadBigDataEnv();

const pool = new Pool({
  host:     process.env.POSTGRES_HOST     || 'localhost',
  port:     parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DATABASE || process.env.POSTGRES_DB || 'mi_bigdata',
  user:     process.env.POSTGRES_USER     || 'mi_user',
  password: process.env.POSTGRES_PASSWORD || '',
  max:      10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 3000,
});

pool.on('error', (err) => {
  console.error('[BigData:PG] Pool error:', err.message);
});

export async function pgQuery<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const client: PoolClient = await pool.connect();
  try {
    const res = await client.query(sql, params);
    return res.rows as T[];
  } finally {
    client.release();
  }
}

export async function pgQueryOne<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T | null> {
  const rows = await pgQuery<T>(sql, params);
  return rows[0] || null;
}

export async function isPostgresAvailable(): Promise<boolean> {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

export { pool };
