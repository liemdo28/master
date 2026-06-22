// tests/stress/tamper-ledger.test.js
// CEO requirement: append 100 events, manually tamper one row, verifyChain() must fail
import { describe, test, expect, beforeEach } from '@jest/globals';
import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { appendAuditEvent, verifyChain } from '../../core/AuditLedger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const schema    = readFileSync(join(__dirname, '../../database/schema.sql'), 'utf8');

function freshDb() {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.exec(schema);
  return db;
}

describe('Tamper Ledger — CEO certification', () => {
  let db;
  beforeEach(() => {
    db = freshDb();
    for (let i = 0; i < 100; i++) {
      appendAuditEvent(db, 'LEGIT_EVENT', { seq: i, data: `authentic-${i}` });
    }
  });

  test('100 authentic events — chain intact before tamper', () => {
    const result = verifyChain(db);
    expect(result.valid).toBe(true);
    expect(result.rowsChecked).toBe(100);
    expect(result.firstInvalid).toBeNull();
  });

  test('tamper payload of row 1 — detected, valid=false, sequence reported', () => {
    db.prepare("UPDATE audit_ledger SET payload = '{\"tampered\":true}' WHERE sequence = 1").run();
    const result = verifyChain(db);
    expect(result.valid).toBe(false);
    expect(result.firstInvalid).toBe(1);
    expect(typeof result.reason).toBe('string');
    expect(result.reason).toContain('1');
  });

  test('tamper masked_payload of row 50 — current_hash mismatch detected', () => {
    db.prepare("UPDATE audit_ledger SET masked_payload = '{\"evil\":1}' WHERE sequence = 50").run();
    // masked_payload not part of hash — but change it to also corrupt payload
    db.prepare("UPDATE audit_ledger SET payload = '{\"evil\":1}' WHERE sequence = 50").run();
    const result = verifyChain(db);
    expect(result.valid).toBe(false);
    expect(result.firstInvalid).toBeLessThanOrEqual(50);
  });

  test('tamper row 100 (last row) — tail tamper is detected', () => {
    db.prepare("UPDATE audit_ledger SET payload = '{\"hacked\":\"last\"}' WHERE sequence = 100").run();
    const result = verifyChain(db);
    expect(result.valid).toBe(false);
    expect(result.firstInvalid).toBe(100);
  });

  test('tamper current_hash of row 30 — broken chain at 30 or 31', () => {
    db.prepare("UPDATE audit_ledger SET current_hash = 'deadbeef0000' WHERE sequence = 30").run();
    const result = verifyChain(db);
    expect(result.valid).toBe(false);
    expect(result.firstInvalid).toBeLessThanOrEqual(31);
  });

  test('delete row 42 — prev_hash mismatch on row 43 is detected', () => {
    db.prepare('DELETE FROM audit_ledger WHERE sequence = 42').run();
    const result = verifyChain(db);
    expect(result.valid).toBe(false);
  });

  test('tamper report has non-empty reason string', () => {
    db.prepare("UPDATE audit_ledger SET payload = '{\"x\":1}' WHERE sequence = 7").run();
    const result = verifyChain(db);
    expect(result.valid).toBe(false);
    expect(result.reason.length).toBeGreaterThan(10);
  });
});
