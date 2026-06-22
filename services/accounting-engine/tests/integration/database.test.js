// tests/integration/database.test.js
import { describe, test, expect, beforeAll } from '@jest/globals';
import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { batchInsert, getStats }         from '../../core/DatabaseManager.js';
import { appendAuditEvent, verifyChain } from '../../core/AuditLedger.js';
import { createPatchRecord, updatePatchStatus, getPatchStats } from '../../core/PatchLedger.js';
import { startQARun, completeQARun, getQAStats } from '../../core/QAAccounting.js';
import { getFullStats }                  from '../../analyzers/StatsAnalyzer.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const schema    = readFileSync(join(__dirname, '../../database/schema.sql'), 'utf8');

let db;
beforeAll(() => {
  db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.exec(schema);
});

describe('batchInsert', () => {
  test('inserts multiple rows in one transaction', () => {
    const rows = Array.from({ length: 100 }, (_, i) => ({
      session_id:       `sess-${i}`,
      timestamp:        new Date().toISOString(),
      cpu_pct:          i * 0.1,
      memory_mb:        100,
      heap_used_mb:     80,
      heap_total_mb:    200,
      rss_mb:           120,
      memory_delta_pct: 0,
      gpu_mb:           null,
      disk_free_mb:     null,
    }));
    const n = batchInsert(db, 'resource_metrics', rows);
    expect(n).toBe(100);
  });

  test('returns 0 for empty rows array', () => {
    expect(batchInsert(db, 'resource_metrics', [])).toBe(0);
  });
});

describe('Full patch lifecycle', () => {
  test('proposed → applied → rolled_back chain is recorded', () => {
    const patch_id = `patch-test-${Date.now()}`;
    createPatchRecord(db, { patch_id, task: 'lifecycle test', affected_modules: ['core'] });
    updatePatchStatus(db, patch_id, 'applied',      { approval_status: 'approved' });
    updatePatchStatus(db, patch_id, 'rolled_back',  { rollback_reason: 'test rollback' });

    const stats = getPatchStats(db);
    expect(stats.rolled_back).toBeGreaterThan(0);
  });
});

describe('QA integration', () => {
  test('startQARun + completeQARun round-trip', () => {
    const run_id = startQARun(db, 'integration-test');
    completeQARun(db, run_id, {
      total_tests: 50, failed_tests: 2, qa_grade: 'PASS', qa_score: 96,
    });
    const stats = getQAStats(db);
    expect(stats.total_runs).toBeGreaterThan(0);
  });
});

describe('getFullStats performance', () => {
  test('completes in under 3000ms', () => {
    const start  = Date.now();
    const result = getFullStats(db);
    const ms     = Date.now() - start;
    expect(ms).toBeLessThan(3000);
    expect(result).toHaveProperty('database');
    expect(result).toHaveProperty('qa');
    expect(result).toHaveProperty('patches');
    expect(result).toHaveProperty('metrics');
  });
});

describe('verifyChain after inserts', () => {
  test('chain remains valid after many appends', () => {
    for (let i = 0; i < 50; i++) appendAuditEvent(db, 'PERF_TEST', { i });
    expect(verifyChain(db).valid).toBe(true);
  });
});
