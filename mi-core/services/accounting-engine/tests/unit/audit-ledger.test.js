// tests/unit/audit-ledger.test.js
import { describe, test, expect, beforeEach } from '@jest/globals';
import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { appendAuditEvent, verifyChain, hashRow, maskSecrets } from '../../core/AuditLedger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const schema    = readFileSync(join(__dirname, '../../database/schema.sql'), 'utf8');

function freshDb() {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.exec(schema);
  return db;
}

describe('AuditLedger — hash chain', () => {
  let db;
  beforeEach(() => { db = freshDb(); });

  test('genesis row starts at sequence 1 with GENESIS_HASH as prev_hash', () => {
    const { sequence, prevHash } = appendAuditEvent(db, 'TEST', { x: 1 });
    expect(sequence).toBe(1);
    expect(prevHash).toBe('0'.repeat(64));
  });

  test('sequence increments monotonically', () => {
    const a = appendAuditEvent(db, 'EVT', { n: 1 });
    const b = appendAuditEvent(db, 'EVT', { n: 2 });
    const c = appendAuditEvent(db, 'EVT', { n: 3 });
    expect(b.sequence).toBe(a.sequence + 1);
    expect(c.sequence).toBe(b.sequence + 1);
  });

  test('each row\'s prev_hash equals previous row\'s current_hash', () => {
    appendAuditEvent(db, 'A', {});
    appendAuditEvent(db, 'B', {});
    appendAuditEvent(db, 'C', {});
    const rows = db.prepare('SELECT * FROM audit_ledger ORDER BY sequence ASC').all();
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i].prev_hash).toBe(rows[i - 1].current_hash);
    }
  });

  test('verifyChain returns valid=true for intact chain', () => {
    for (let i = 0; i < 10; i++) appendAuditEvent(db, 'EVT', { i });
    expect(verifyChain(db).valid).toBe(true);
    expect(verifyChain(db).rowsChecked).toBe(10);
  });

  test('verifyChain detects tampered payload', () => {
    appendAuditEvent(db, 'A', { data: 'original' });
    appendAuditEvent(db, 'B', { data: 'also original' });
    db.prepare("UPDATE audit_ledger SET payload = '{\"data\":\"TAMPERED\"}' WHERE sequence = 1").run();
    const result = verifyChain(db);
    expect(result.valid).toBe(false);
    expect(result.firstInvalid).toBe(1);
  });

  test('verifyChain empty DB returns valid=true, 0 rows checked', () => {
    const r = verifyChain(db);
    expect(r.valid).toBe(true);
    expect(r.rowsChecked).toBe(0);
  });
});

describe('maskSecrets', () => {
  test('masks API keys', () => {
    expect(maskSecrets('api_key: abc123')).toContain('[MASKED]');
  });
  test('masks passwords', () => {
    expect(maskSecrets('password=hunter2')).toContain('[MASKED]');
  });
  test('masks bearer tokens', () => {
    expect(maskSecrets('Authorization: Bearer eyJhbGc...')).toContain('[MASKED]');
  });
  test('leaves normal content intact', () => {
    const safe = maskSecrets('{"user": "alice", "action": "login"}');
    expect(safe).toContain('alice');
  });
});

describe('hashRow', () => {
  test('is deterministic', () => {
    const h1 = hashRow('abc', 'payload');
    const h2 = hashRow('abc', 'payload');
    expect(h1).toBe(h2);
  });
  test('changes when prev_hash changes', () => {
    expect(hashRow('aaa', 'p')).not.toBe(hashRow('bbb', 'p'));
  });
  test('changes when payload changes', () => {
    expect(hashRow('h', 'a')).not.toBe(hashRow('h', 'b'));
  });
});
