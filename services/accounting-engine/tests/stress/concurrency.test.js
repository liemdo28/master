// tests/stress/concurrency.test.js
// Validates that the BatchWriter + DatabaseManager handles concurrent promise chains
// without data loss or SQLite SQLITE_BUSY errors.
// better-sqlite3 is synchronous so "concurrency" here means interleaved async callers
// all enqueuing before the batch flush fires — the real risk is queue corruption.
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import Database    from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { BatchWriter }    from '../../collectors/BatchWriter.js';
import { batchInsert }    from '../../core/DatabaseManager.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const schema    = readFileSync(join(__dirname, '../../database/schema.sql'), 'utf8');

function freshDb() {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.exec(schema);
  return db;
}

describe('BatchWriter — concurrent enqueue correctness', () => {
  let db, writer;

  beforeEach(() => {
    db     = freshDb();
    writer = new BatchWriter(db, { flushIntervalMs: 50 });
    writer.start();
  });

  afterEach(async () => {
    await writer.stop();
  });

  test('100 concurrent enqueue calls all reach the DB after flush', async () => {
    const N = 100;
    const now = new Date().toISOString();
    for (let i = 0; i < N; i++) {
      writer.enqueue('resource_metrics', {
        session_id:       `sess-conc-${i}`,
        timestamp:        now,
        cpu_pct:          i % 100,
        memory_mb:        100 + i,
        heap_used_mb:     80  + i,
        heap_total_mb:    200,
        rss_mb:           120,
        memory_delta_pct: 0,
        gpu_mb:           null,
        disk_free_mb:     null,
      });
    }
    // Wait for the automatic flush
    await new Promise((r) => setTimeout(r, 200));
    const count = db.prepare('SELECT COUNT(*) as c FROM resource_metrics').get().c;
    expect(count).toBe(N);
  });

  test('queue does not corrupt when flushing partially and more rows arrive', async () => {
    const BATCH_1 = 200;
    const BATCH_2 = 150;
    const now = new Date().toISOString();

    for (let i = 0; i < BATCH_1; i++) {
      writer.enqueue('resource_metrics', {
        session_id: `sess-b1-${i}`, timestamp: now,
        cpu_pct: i, memory_mb: i, heap_used_mb: i, heap_total_mb: 200,
        rss_mb: 100, memory_delta_pct: 0, gpu_mb: null, disk_free_mb: null,
      });
    }
    // First flush fires at 50ms — add more rows while it's in progress
    await new Promise((r) => setTimeout(r, 60));
    for (let i = 0; i < BATCH_2; i++) {
      writer.enqueue('resource_metrics', {
        session_id: `sess-b2-${i}`, timestamp: now,
        cpu_pct: i, memory_mb: i, heap_used_mb: i, heap_total_mb: 200,
        rss_mb: 100, memory_delta_pct: 0, gpu_mb: null, disk_free_mb: null,
      });
    }
    // Wait for second flush
    await new Promise((r) => setTimeout(r, 200));
    const count = db.prepare('SELECT COUNT(*) as c FROM resource_metrics').get().c;
    expect(count).toBe(BATCH_1 + BATCH_2);
  });

  test('safety cap prevents memory blow-up: oldest rows are dropped at MAX_QUEUE_SIZE', () => {
    const OVER_CAP = 6000;   // MAX_QUEUE_SIZE = 5000
    const now = new Date().toISOString();
    for (let i = 0; i < OVER_CAP; i++) {
      writer.enqueue('resource_metrics', {
        session_id: `sess-cap-${i}`, timestamp: now,
        cpu_pct: i % 100, memory_mb: 100, heap_used_mb: 80, heap_total_mb: 200,
        rss_mb: 100, memory_delta_pct: 0, gpu_mb: null, disk_free_mb: null,
      });
    }
    // Queue should be capped at 5000 — not 6000
    expect(writer.queueSize).toBeLessThanOrEqual(5000);
  });

  test('getStats reflects flushed count after stop', async () => {
    const N = 50;
    const now = new Date().toISOString();
    for (let i = 0; i < N; i++) {
      writer.enqueue('resource_metrics', {
        session_id: `sess-stats-${i}`, timestamp: now,
        cpu_pct: i, memory_mb: 100, heap_used_mb: 80, heap_total_mb: 200,
        rss_mb: 100, memory_delta_pct: 0, gpu_mb: null, disk_free_mb: null,
      });
    }
    await writer.stop();
    expect(writer.getStats().totalFlushed).toBe(N);
    expect(writer.getStats().errorCount).toBe(0);
  });
});

describe('batchInsert — direct transaction correctness', () => {
  let db;
  beforeEach(() => { db = freshDb(); });

  test('inserts all rows in one transaction', () => {
    const rows = Array.from({ length: 500 }, (_, i) => ({
      session_id:       `sess-bi-${i}`,
      timestamp:        new Date().toISOString(),
      cpu_pct:          i % 100,
      memory_mb:        100,
      heap_used_mb:     80,
      heap_total_mb:    200,
      rss_mb:           100,
      memory_delta_pct: 0,
      gpu_mb:           null,
      disk_free_mb:     null,
    }));
    batchInsert(db, 'resource_metrics', rows);
    expect(db.prepare('SELECT COUNT(*) as c FROM resource_metrics').get().c).toBe(500);
  });

  test('empty batch insert returns 0', () => {
    expect(batchInsert(db, 'resource_metrics', [])).toBe(0);
  });
});
