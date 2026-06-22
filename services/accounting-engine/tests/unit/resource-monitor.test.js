// tests/unit/resource-monitor.test.js
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { BatchWriter }    from '../../collectors/BatchWriter.js';
import { ResourceMonitor } from '../../collectors/ResourceMonitor.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const schema    = readFileSync(join(__dirname, '../../database/schema.sql'), 'utf8');

function freshDb() {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.exec(schema);
  return db;
}

describe('ResourceMonitor', () => {
  let db, writer, monitor;

  beforeEach(() => {
    db      = freshDb();
    writer  = new BatchWriter(db, { flushIntervalMs: 60000 });
    monitor = new ResourceMonitor(writer, { intervalMs: 50 }); // fast for tests
  });

  afterEach(async () => {
    monitor.stop();
    await writer.stop();
  });

  test('starts and stops cleanly', () => {
    monitor.start('test-session');
    expect(monitor.getStats().running).toBe(true);
    monitor.stop();
    expect(monitor.getStats().running).toBe(false);
  });

  test('does not require NVIDIA/GPU', () => {
    // If GPU were required this would throw — it must not
    expect(() => monitor.start('sess')).not.toThrow();
  });

  test('emits sample events with correct shape', (done) => {
    monitor.on('sample', (row) => {
      expect(row).toHaveProperty('cpu_pct');
      expect(row).toHaveProperty('memory_mb');
      expect(row).toHaveProperty('heap_used_mb');
      expect(row).toHaveProperty('rss_mb');
      expect(row.gpu_mb).toBeNull(); // no GPU
      expect(typeof row.timestamp).toBe('string');
      monitor.stop();
      done();
    });
    monitor.start('sess-test');
  });

  test('enqueues rows into batch writer', (done) => {
    monitor.on('sample', () => {
      expect(writer.queueSize).toBeGreaterThan(0);
      monitor.stop();
      done();
    });
    monitor.start('sess-enqueue');
  });

  test('getStats tracks sample count', (done) => {
    let count = 0;
    monitor.on('sample', () => {
      count++;
      if (count >= 2) {
        expect(monitor.getStats().samples).toBeGreaterThanOrEqual(2);
        monitor.stop();
        done();
      }
    });
    monitor.start('sess-count');
  });

  test('cpu_pct is a non-negative number', (done) => {
    monitor.on('sample', (row) => {
      expect(row.cpu_pct).toBeGreaterThanOrEqual(0);
      monitor.stop();
      done();
    });
    monitor.start('sess-cpu');
  });
});
