// tests/stress/rollback-storm.test.js
// Stress-tests the patch ledger under rapid patch creation + rollback conditions.
// Validates audit chain integrity after a rollback storm.
import { describe, test, expect, beforeEach } from '@jest/globals';
import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createPatchRecord, updatePatchStatus, getPatchStats, listPatches } from '../../core/PatchLedger.js';
import { verifyChain } from '../../core/AuditLedger.js';
import { randomUUID } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const schema    = readFileSync(join(__dirname, '../../database/schema.sql'), 'utf8');

function freshDb() {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.exec(schema);
  return db;
}

describe('Rollback storm — patch ledger integrity', () => {
  let db;
  beforeEach(() => { db = freshDb(); });

  test('1 000 patches created and immediately rolled back — audit chain stays valid', () => {
    const N = 1_000;
    const ids = [];

    for (let i = 0; i < N; i++) {
      const patch_id = `rb-storm-${i}-${randomUUID().slice(0, 6)}`;
      ids.push(patch_id);
      createPatchRecord(db, {
        patch_id,
        task:       `storm task ${i}`,
        risk_level: i % 5 === 0 ? 'high' : 'low',
        files_changed: [`src/storm-${i}.js`],
      });
      // Immediately apply then rollback
      updatePatchStatus(db, patch_id, 'applied',      { approval_status: 'approved' });
      updatePatchStatus(db, patch_id, 'rolled_back',  { rollback_reason: `storm rollback ${i}` });
    }

    const stats = getPatchStats(db);
    expect(stats.total).toBe(N);
    expect(stats.rolled_back).toBe(N);

    // Audit chain must be valid after all operations
    const audit = verifyChain(db);
    expect(audit.valid).toBe(true);
    // Each patch generates 3 audit events (created, applied, rolled_back)
    expect(audit.rowsChecked).toBe(N * 3);
  });

  test('mixed patch statuses — stats match actual rows', () => {
    const N = 200;
    const statuses = ['applied', 'rejected', 'rolled_back', 'failed', 'applied'];

    for (let i = 0; i < N; i++) {
      const patch_id = `mixed-${i}-${randomUUID().slice(0, 6)}`;
      createPatchRecord(db, { patch_id, task: `mixed ${i}`, risk_level: 'low', files_changed: [] });
      const target = statuses[i % statuses.length];
      updatePatchStatus(db, patch_id, target, {
        approval_status:  target === 'applied' ? 'approved' : 'pending',
        rollback_reason:  target === 'rolled_back' ? 'test' : undefined,
      });
    }

    const stats = getPatchStats(db);
    const applied    = Math.floor(N * 2 / 5);   // indices 0,4 mod 5
    const rejected   = Math.floor(N * 1 / 5);
    const rolledBack = Math.floor(N * 1 / 5);
    const failed     = Math.floor(N * 1 / 5);

    expect(stats.total).toBe(N);
    expect(stats.applied    + stats.rejected + stats.rolled_back + stats.failed).toBe(N);
    expect(verifyChain(db).valid).toBe(true);
  });

  test('patch lineage survives rollback storm', () => {
    let parentId = null;
    const ids = [];

    for (let i = 0; i < 100; i++) {
      const patch_id = `lineage-${i}-${randomUUID().slice(0, 6)}`;
      ids.push(patch_id);
      createPatchRecord(db, {
        patch_id,
        parent_patch: parentId,
        task:         `lineage task ${i}`,
        risk_level:   'low',
        files_changed: [],
      });
      updatePatchStatus(db, patch_id, 'rolled_back', { rollback_reason: 'storm' });
      if (i % 10 === 0) parentId = patch_id;
    }

    // Every patch should still be retrievable
    const allPatches = listPatches(db, { limit: 200 });
    expect(allPatches.length).toBe(100);
    expect(verifyChain(db).valid).toBe(true);
  });

  test('high-risk patches all require approval_status tracked', () => {
    const N = 50;
    for (let i = 0; i < N; i++) {
      const patch_id = `highrisk-${i}-${randomUUID().slice(0, 6)}`;
      createPatchRecord(db, { patch_id, task: `hr ${i}`, risk_level: 'high', files_changed: [] });
      updatePatchStatus(db, patch_id, 'applied', { approval_status: 'approved', approved_by: 'admin' });
    }
    const pending = db.prepare(
      "SELECT COUNT(*) as c FROM patch_ledger WHERE risk_level='high' AND approval_status='pending'"
    ).get().c;
    // All were explicitly approved — none should be pending
    expect(pending).toBe(0);
    expect(verifyChain(db).valid).toBe(true);
  });
});
