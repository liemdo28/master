// tests/stress/db-storm.test.js - DB storm certification
// 100 concurrent writes, 100k metric inserts, 10k audit inserts, 1000 patch events
import { describe, test, expect, beforeAll } from '@jest/globals';
import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { batchInsert }     from '../../core/DatabaseManager.js';
import { appendAuditEvent } from '../../core/AuditLedger.js';
import { createPatchRecord, updatePatchStatus } from '../../core/PatchLedger.js';
import { BatchWriter }     from '../../collectors/BatchWriter.js';
import { randomUUID }      from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const schema    = readFileSync(join(__dirname, '../../database/schema.sql'), 'utf8');

function freshDb() {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('temp_store = MEMORY');
  db.exec(schema);
  return db;
}

function makeMetricRow(i) {
  return {
    session_id:       `storm-sess-${i % 10}`,
    timestamp:        new Date().toISOString(),
    cpu_pct:          Math.random() * 5,
    memory_mb:        100 + Math.random() * 50,
    heap_used_mb:     80  + Math.random() * 40,
    heap_total_mb:    200,
    rss_mb:           120 + Math.random() * 30,
    memory_delta_pct: Math.random() * 2,
    gpu_mb:           null,
    disk_free_mb:     null,
  };
}

describe('DB Storm — 100k metric inserts', () => {
  let db;
  beforeAll(() => { db = freshDb(); });

  test('inserts 100,000 metric rows without corruption', () => {
    const TOTAL = 100000;
    const CHUNK = 2000;
    let inserted = 0;
    for (let i = 0; i < TOTAL; i += CHUNK) {
      const rows = Array.from({ length: Math.min(CHUNK, TOTAL - i) }, (_, j) => makeMetricRow(i + j));
      inserted += batchInsert(db, 'resource_metrics', rows);
    }
    expect(inserted).toBe(TOTAL);
    const count = db.prepare('SELECT COUNT(*) as c FROM resource_metrics').get().c;
    expect(count).toBe(TOTAL);
  }, 60000);
});

describe('DB Storm — 10k audit inserts', () => {
  let db;
  beforeAll(() => { db = freshDb(); });

  test('inserts 10,000 audit events, chain remains valid', async () => {
    const { verifyChain } = await import('../../core/AuditLedger.js');
    for (let i = 0; i < 10000; i++) {
      appendAuditEvent(db, 'STORM_TEST', { i, data: `payload-${i}` });
    }
    const count = db.prepare('SELECT COUNT(*) as c FROM audit_ledger').get().c;
    expect(count).toBe(10000);

    const result = verifyChain(db);
    expect(result.valid).toBe(true);
    expect(result.rowsChecked).toBe(10000);
  }, 120000);
});

describe('DB Storm — 1000 patch lifecycle events', () => {
  let db;
  beforeAll(() => { db = freshDb(); });

  test('1000 patches created and transitioned without orphans', () => {
    const statuses = ['applied', 'rejected', 'rolled_back', 'failed'];
    for (let i = 0; i < 1000; i++) {
      const patch_id = `storm-patch-${i}-${randomUUID().slice(0,6)}`;
      createPatchRecord(db, {
        patch_id, task: `storm task ${i}`,
        affected_modules: [`mod-${i % 5}`],
        files_changed:    [`file-${i}.js`],
      });
      updatePatchStatus(db, patch_id, statuses[i % statuses.length]);
    }
    const total = db.prepare('SELECT COUNT(*) as c FROM patch_ledger').get().c;
    expect(total).toBe(1000);

    // No orphan audit entries (every patch has at least 2 audit events: CREATED + STATUS)
    const auditCount = db.prepare('SELECT COUNT(*) as c FROM audit_ledger').get().c;
    expect(auditCount).toBeGreaterThanOrEqual(2000);
  }, 60000);
});

describe('DB Storm — BatchWriter concurrent flush simulation', () => {
  let db;
  beforeAll(() => { db = freshDb(); });

  test('100 concurrent enqueue operations, no duplicates after flush', async () => {
    const writer = new BatchWriter(db, { flushIntervalMs: 999999 });
    const CONCURRENT = 100;
    // Simulate 100 "writers" each enqueuing 10 rows
    for (let w = 0; w < CONCURRENT; w++) {
      for (let r = 0; r < 10; r++) {
        writer.enqueue('resource_metrics', makeMetricRow(w * 10 + r));
      }
    }
    expect(writer.queueSize).toBe(1000);
    await writer.stop(); // flushes all
    const count = db.prepare('SELECT COUNT(*) as c FROM resource_metrics').get().c;
    expect(count).toBe(1000);
  }, 30000);
});
