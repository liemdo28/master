// tests/integration/api.test.js
import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import Database from 'better-sqlite3';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createApp } from '../../api/server.js';
import { startQARun, completeQARun } from '../../core/QAAccounting.js';
import { createPatchRecord }          from '../../core/PatchLedger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const schema    = readFileSync(join(__dirname, '../../database/schema.sql'), 'utf8');

let server, baseUrl, db;

beforeAll(async () => {
  db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.exec(schema);

  // seed some data
  const run_id = startQARun(db, 'api-test');
  completeQARun(db, run_id, { total_tests: 10, qa_grade: 'PASS', qa_score: 90 });
  createPatchRecord(db, { patch_id: 'patch-api-1', task: 'api test patch', affected_modules: ['api'] });

  const app = createApp(db);
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

async function get(path) {
  const { default: http } = await import('http');
  return new Promise((resolve, reject) => {
    const req = http.get(baseUrl + path, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(data) }));
    });
    req.on('error', reject);
  });
}

describe('API endpoints', () => {
  test('GET /health returns ok=true', async () => {
    const { status, body } = await get('/health');
    expect(status).toBe(200);
    expect(body.ok).toBe(true);
  });

  test('GET /stats returns database, qa, patches, metrics', async () => {
    const { status, body } = await get('/stats');
    expect(status).toBe(200);
    expect(body).toHaveProperty('database');
    expect(body).toHaveProperty('qa');
    expect(body).toHaveProperty('patches');
  });

  test('GET /stats/ledger returns valid chain', async () => {
    const { status, body } = await get('/stats/ledger');
    expect(status).toBe(200);
    expect(body).toHaveProperty('valid');
  });

  test('GET /qa returns array', async () => {
    const { status, body } = await get('/qa');
    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
  });

  test('GET /qa/stats returns total_runs', async () => {
    const { status, body } = await get('/qa/stats');
    expect(status).toBe(200);
    expect(body).toHaveProperty('total_runs');
  });

  test('GET /patches returns array', async () => {
    const { status, body } = await get('/patches');
    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
  });

  test('GET /patches/stats returns total count', async () => {
    const { status, body } = await get('/patches/stats');
    expect(status).toBe(200);
    expect(body).toHaveProperty('total');
  });

  test('GET /patches/:id returns patch', async () => {
    const { status, body } = await get('/patches/patch-api-1');
    expect(status).toBe(200);
    expect(body.patch_id).toBe('patch-api-1');
  });

  test('GET /patches/:id/lineage returns array', async () => {
    const { status, body } = await get('/patches/patch-api-1/lineage');
    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
  });

  test('GET /patches/nonexistent returns 404', async () => {
    const { status } = await get('/patches/no-such-patch');
    expect(status).toBe(404);
  });

  test('Unknown route returns 404', async () => {
    const { status } = await get('/nonexistent');
    expect(status).toBe(404);
  });
});

describe('API performance', () => {
  test('p95 latency < 300ms over 100 sequential requests to /stats', async () => {
    const latencies = [];
    for (let i = 0; i < 100; i++) {
      const t0 = Date.now();
      await get('/stats');
      latencies.push(Date.now() - t0);
    }
    latencies.sort((a, b) => a - b);
    const p95 = latencies[Math.floor(latencies.length * 0.95)];
    expect(p95).toBeLessThan(300);
  });
});
