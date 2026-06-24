// tests/unit/metrics-compressor.test.js
import { describe, test, expect, beforeEach } from '@jest/globals';
import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { compressOldMetrics, getHourlyStats, ensureHourlyTable } from '../../core/MetricsCompressor.js';
import { batchInsert } from '../../core/DatabaseManager.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const schema    = readFileSync(join(__dirname, '../../database/schema.sql'), 'utf8');

function freshDb() {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.exec(schema);
  ensureHourlyTable(db);
  return db;
}

function insertOldMetrics(db, count = 100, ageHours = 48) {
  const rows = Array.from({ length: count }, (_, i) => ({
    session_id:       'sess-old',
    timestamp:        new Date(Date.now() - ageHours * 3600000 - i * 60000).toISOString(),
    cpu_pct:          Math.random() * 5,
    memory_mb:        100 + Math.random() * 50,
    heap_used_mb:     80,
    heap_total_mb:    200,
    rss_mb:           120,
    memory_delta_pct: Math.random(),
    gpu_mb:           null,
    disk_free_mb:     null,
  }));
  batchInsert(db, 'resource_metrics', rows);
  return rows.length;
}

function insertRecentMetrics(db, count = 10) {
  const rows = Array.from({ length: count }, (_, i) => ({
    session_id:       'sess-recent',
    timestamp:        new Date(Date.now() - i * 60000).toISOString(),
    cpu_pct:          1.0,
    memory_mb:        100,
    heap_used_mb:     80,
    heap_total_mb:    200,
    rss_mb:           120,
    memory_delta_pct: 0,
    gpu_mb:           null,
    disk_free_mb:     null,
  }));
  batchInsert(db, 'resource_metrics', rows);
}

describe('MetricsCompressor', () => {
  let db;
  beforeEach(() => { db = freshDb(); });

  test('compresses old metrics and removes raw rows', () => {
    const inserted = insertOldMetrics(db, 100, 48);
    const before   = db.prepare('SELECT COUNT(*) as c FROM resource_metrics').get().c;
    expect(before).toBe(inserted);

    const result = compressOldMetrics(db, 24 * 3600000);
    expect(result.bucketsCompressed).toBeGreaterThan(0);
    expect(result.rowsDeleted).toBeGreaterThan(0);

    const after = db.prepare('SELECT COUNT(*) as c FROM resource_metrics').get().c;
    expect(after).toBeLessThan(before);
  });

  test('preserves recent metrics (< 24h)', () => {
    insertRecentMetrics(db, 10);
    const result = compressOldMetrics(db, 24 * 3600000);
    expect(result.rowsDeleted).toBe(0); // recent rows untouched

    const count = db.prepare('SELECT COUNT(*) as c FROM resource_metrics').get().c;
    expect(count).toBe(10);
  });

  test('creates hourly aggregate rows in metrics_hourly', () => {
    insertOldMetrics(db, 60, 26); // 60 rows from 26h ago
    compressOldMetrics(db, 24 * 3600000);
    const hourly = db.prepare('SELECT COUNT(*) as c FROM metrics_hourly').get().c;
    expect(hourly).toBeGreaterThan(0);
  });

  test('hourly aggregate has min < avg < max', () => {
    insertOldMetrics(db, 120, 48);
    compressOldMetrics(db, 24 * 3600000);
    const row = db.prepare('SELECT * FROM metrics_hourly LIMIT 1').get();
    if (row && row.sample_count > 1) {
      expect(row.cpu_min).toBeLessThanOrEqual(row.cpu_avg);
      expect(row.cpu_avg).toBeLessThanOrEqual(row.cpu_max);
      expect(row.mem_min).toBeLessThanOrEqual(row.mem_avg);
    }
  });

  test('returns 0 buckets when nothing to compress', () => {
    insertRecentMetrics(db, 5);
    const result = compressOldMetrics(db, 24 * 3600000);
    expect(result.bucketsCompressed).toBe(0);
    expect(result.rowsDeleted).toBe(0);
  });

  test('getHourlyStats returns array of hourly buckets', () => {
    insertOldMetrics(db, 120, 48);
    compressOldMetrics(db, 24 * 3600000);
    const rows = getHourlyStats(db, null, 720);
    expect(Array.isArray(rows)).toBe(true);
  });
});
