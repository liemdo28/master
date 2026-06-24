// tests/stress/tamper-simulation.test.js - Ledger tamper detection certification
import { describe, test, expect, beforeEach } from '@jest/globals';
import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { appendAuditEvent, verifyChain, hashRow } from '../../core/AuditLedger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const schema    = readFileSync(join(__dirname, '../../database/schema.sql'), 'utf8');

function freshDb() {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.exec(schema);
  return db;
}

function seed(db, n = 20) {
  for (let i = 0; i < n; i++) appendAuditEvent(db, 'LEGIT_EVENT', { i, data: `original-${i}` });
}

describe('Tamper Simulation — payload modification', () => {
  let db;
  beforeEach(() => { db = freshDb(); seed(db); });

  test('modifying payload of row 1 breaks chain at sequence 1', () => {
    db.prepare("UPDATE audit_ledger SET payload = '{\"i\":0,\"data\":\"TAMPERED\"}' WHERE sequence = 1").run();
    const result = verifyChain(db);
    expect(result.valid).toBe(false);
    expect(result.firstInvalid).toBe(1);
    expect(result.reason).toContain('tampered');
  });

  test('modifying payload of middle row breaks chain at that row', () => {
    db.prepare("UPDATE audit_ledger SET payload = '{\"HACKED\":true}' WHERE sequence = 10").run();
    const result = verifyChain(db);
    expect(result.valid).toBe(false);
    expect(result.firstInvalid).toBe(10);
  });

  test('modifying payload of last row is detected', () => {
    const last = db.prepare('SELECT sequence FROM audit_ledger ORDER BY sequence DESC LIMIT 1').get();
    db.prepare('UPDATE audit_ledger SET payload = ? WHERE sequence = ?').run('{"FORGED":true}', last.sequence);
    const result = verifyChain(db);
    expect(result.valid).toBe(false);
    expect(result.firstInvalid).toBe(last.sequence);
  });
});

describe('Tamper Simulation — hash field modification', () => {
  let db;
  beforeEach(() => { db = freshDb(); seed(db); });

  test('replacing current_hash directly is detected via prev_hash mismatch on next row', () => {
    db.prepare("UPDATE audit_ledger SET current_hash = 'deadbeef' WHERE sequence = 5").run();
    const result = verifyChain(db);
    expect(result.valid).toBe(false);
    // Either sequence 5 or 6 fails (hash recalc mismatch)
    expect(result.firstInvalid).toBeLessThanOrEqual(6);
  });

  test('replacing prev_hash of first row is detected', () => {
    db.prepare("UPDATE audit_ledger SET prev_hash = 'ffffffff' WHERE sequence = 1").run();
    const result = verifyChain(db);
    expect(result.valid).toBe(false);
    expect(result.firstInvalid).toBe(1);
  });
});

describe('Tamper Simulation — row deletion', () => {
  let db;
  beforeEach(() => { db = freshDb(); seed(db); });

  test('deleting a middle row breaks chain (sequence gap + prev_hash mismatch)', () => {
    db.prepare('DELETE FROM audit_ledger WHERE sequence = 5').run();
    const result = verifyChain(db);
    // Row 6's prev_hash no longer matches row 4's current_hash
    expect(result.valid).toBe(false);
  });
});

describe('Tamper Simulation — row insertion', () => {
  let db;
  beforeEach(() => { db = freshDb(); seed(db); });

  test('inserting a forged row with wrong hash is detected', () => {
    // Insert a forged row by hijacking sequence 21 with wrong hashes
    db.prepare(`
      INSERT INTO audit_ledger (sequence, prev_hash, current_hash, event_type, actor, payload, masked_payload, timestamp)
      VALUES (21, 'fakeprev', 'fakecurrent', 'FORGED', 'attacker', '{"evil":true}', '{"evil":true}', datetime('now'))
    `).run();
    // The forged row's prev_hash won't match row 20's current_hash
    const result = verifyChain(db);
    expect(result.valid).toBe(false);
  });
});

describe('Tamper Simulation — alert generation', () => {
  let db;
  beforeEach(() => { db = freshDb(); seed(db); });

  test('verifyChain returns reason string describing the tamper', () => {
    db.prepare("UPDATE audit_ledger SET payload = '{\"evil\":1}' WHERE sequence = 3").run();
    const result = verifyChain(db);
    expect(typeof result.reason).toBe('string');
    expect(result.reason.length).toBeGreaterThan(0);
    expect(result.reason).toContain('3');
  });

  test('intact chain always returns valid=true with correct rowsChecked', () => {
    const result = verifyChain(db);
    expect(result.valid).toBe(true);
    expect(result.rowsChecked).toBe(20);
    expect(result.firstInvalid).toBeNull();
  });
});
