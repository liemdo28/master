import fs from 'fs';
import path from 'path';

let loaded = false;

export function loadBigDataEnv(): void {
  if (loaded) return;
  loaded = true;

  const envPath = path.resolve(__dirname, '../../../infra/bigdata/.env');
  if (!fs.existsSync(envPath)) return;

  const content = fs.readFileSync(envPath, 'utf-8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
    if (!process.env[key]) process.env[key] = value;
  }

  if (!process.env.POSTGRES_DATABASE && process.env.POSTGRES_DB) {
    process.env.POSTGRES_DATABASE = process.env.POSTGRES_DB;
  }
  if (!process.env.MINIO_ENDPOINT) {
    process.env.MINIO_ENDPOINT = `http://localhost:${process.env.MINIO_PORT || '9000'}`;
  }
  if (!process.env.QDRANT_URL) {
    process.env.QDRANT_URL = `http://localhost:${process.env.QDRANT_PORT || '6333'}`;
  }
}
