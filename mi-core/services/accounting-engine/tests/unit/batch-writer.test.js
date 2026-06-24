// tests/unit/batch-writer.test.js
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { BatchWriter } from '../../collectors/BatchWriter.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const schema    = readFileSync(join(__dirname, '../../database/schema.sql'), 'utf8');

function freshDb() {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.exec(schema);
  return db;
}

function makeRow(i = 0) {
  return {
    session_id:       null,
    timestamp:        new Date().toISOString(),
    cpu_pct:          i * 0.1,
    memory_mb:        100,
    heap_used_mb:     80,
    heap_total_mb:    200,
    rss_mb:           120,
    memory_delta_pct: 0,
    gpu_mb:           null,
    disk_free_mb:     null,
  };
}

describe('BatchWriter', () => {
  let db, writer;

  beforeEach(() => {
    db     = freshDb();
    writer = new BatchWriter(db, { flushIntervalMs: 50000 }); // long timer, we flush manually
  });

  afterEach(async () => {
    await writer.stop();
  });

  test('enqueue adds rows to internal queue', () => {
    writer.enqueue('resource_metrics', makeRow(1));
    writer.enqueue('resource_metrics', makeRow(2));
    expect(writer.queueSize).toBe(2);
  });

  test('_flush writes rows to DB and clears queue', async () => {
    writer.enqueue('resource_metrics', makeRow(1));
    writer.enqueue('resource_metrics', makeRow(2));
    await writer._flush();
    expect(writer.queueSize).toBe(0);
    const count = db.prepare('SELECT COUNT(*) as c FROM resource_metrics').get().c;
    expect(count).toBe(2);
  });

  test('totalFlushed tracks count correctly', async () => {
    for (let i = 0; i < 5; i++) writer.enqueue('resource_metrics', makeRow(i));
    await writer._flush();
    expect(writer.getStats().totalFlushed).toBe(5);
  });

  test('safety cap drops oldest when queue exceeds MAX_QUEUE_SIZE', () => {
    const MAX = 5000;
    for (let i = 0; i < MAX + 10; i++) writer.enqueue('resource_metrics', makeRow(i));
    expect(writer.queueSize).toBe(MAX);
  });

  test('concurrent _flush calls are serialised (flushing guard)', async () => {
    for (let i = 0; i < 10; i++) writer.enqueue('resource_metrics', makeRow(i));
    await Promise.all([writer._flush(), writer._flush(), writer._flush()]);
    const count = db.prepare('SELECT COUNT(*) as c FROM resource_metrics').get().c;
    expect(count).toBe(10); // not duplicated
  });

  test('stop() flushes remaining rows', async () => {
    writer.enqueue('resource_metrics', makeRow(1));
    await writer.stop();
    const count = db.prepare('SELECT COUNT(*) as c FROM resource_metrics').get().c;
    expect(count).toBe(1);
  });

  test('getStats returns pending counts per table', () => {
    writer.enqueue('resource_metrics', makeRow(1));
    writer.enqueue('resource_metrics', makeRow(2));
    const stats = writer.getStats();
    expect(stats.pending.resource_metrics).toBe(2);
    expect(stats.totalFlushed).toBe(0);
    expect(stats.errorCount).toBe(0);
  });

  test('on flush error rows are returned to front of queue', async () => {
    // Use a broken writer that throws on batchInsert
    const brokenDb = { prepare: () => { throw new Error('DB error'); } };
    const errors = [];
    const bw = new BatchWriter(brokenDb, { onError: (e) => errors.push(e.message) });
    bw.enqueue('resource_metrics', makeRow(1));
    await bw._flush();
    expect(errors.length).toBe(1);
    expect(bw.queueSize).toBe(1); // row returned to queue
  });
});
