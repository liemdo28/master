// core/AuditLedger.js - Hash-chain immutable audit ledger
// Every row contains prev_hash + SHA256(prev_hash + payload) = current_hash
// Any modification to a historical row makes the chain invalid.
import { createHash } from 'crypto';

const SECRET_PATTERNS = [
  /["']?api[_-]?key["']?\s*[:=]\s*["']?\S+/gi,
  /["']?password["']?\s*[:=]\s*["']?\S+/gi,
  /["']?secret["']?\s*[:=]\s*["']?\S+/gi,
  /["']?token["']?\s*[:=]\s*["']?\S+/gi,
  /bearer\s+\S+/gi,
  /authorization\s*:\s*\S+/gi,
  /sk-[a-zA-Z0-9]{20,}/g,
  /ghp_[a-zA-Z0-9]{36}/g,
  /AKIA[A-Z0-9]{16}/g,
];

const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

export function maskSecrets(obj) {
  let str = typeof obj === 'string' ? obj : JSON.stringify(obj);
  for (const re of SECRET_PATTERNS) {
    str = str.replace(re, '[MASKED]');
    re.lastIndex = 0;
  }
  return str;
}

export function hashRow(prevHash, payload) {
  return createHash('sha256')
    .update(prevHash + (typeof payload === 'string' ? payload : JSON.stringify(payload)))
    .digest('hex');
}

export function appendAuditEvent(db, eventType, payload, actor = 'system') {
  const last = db.prepare(
    'SELECT sequence, current_hash FROM audit_ledger ORDER BY sequence DESC LIMIT 1'
  ).get();

  const sequence   = last ? last.sequence + 1 : 1;
  const prevHash   = last ? last.current_hash : GENESIS_HASH;
  const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const maskedStr  = maskSecrets(payloadStr);
  const curHash    = hashRow(prevHash, payloadStr);
  const timestamp  = new Date().toISOString();

  db.prepare(`
    INSERT INTO audit_ledger (sequence, prev_hash, current_hash, event_type, actor, payload, masked_payload, timestamp)
    VALUES (@sequence, @prevHash, @curHash, @eventType, @actor, @payloadStr, @maskedStr, @timestamp)
  `).run({ sequence, prevHash, curHash, eventType, actor, payloadStr, maskedStr, timestamp });

  return { sequence, prevHash, currentHash: curHash };
}

export function verifyChain(db) {
  const rows = db.prepare(
    'SELECT sequence, prev_hash, current_hash, payload FROM audit_ledger ORDER BY sequence ASC'
  ).all();

  if (!rows.length) return { valid: true, rowsChecked: 0, firstInvalid: null };

  let prevHash = GENESIS_HASH;
  for (const row of rows) {
    if (row.prev_hash !== prevHash) {
      return {
        valid: false,
        rowsChecked: row.sequence,
        firstInvalid: row.sequence,
        reason: `prev_hash mismatch at sequence ${row.sequence}: expected ${prevHash}, got ${row.prev_hash}`,
      };
    }
    const expected = hashRow(prevHash, row.payload);
    if (row.current_hash !== expected) {
      return {
        valid: false,
        rowsChecked: row.sequence,
        firstInvalid: row.sequence,
        reason: `current_hash mismatch at sequence ${row.sequence}: row was tampered`,
      };
    }
    prevHash = row.current_hash;
  }

  return { valid: true, rowsChecked: rows.length, firstInvalid: null };
}

export function getAuditEvents(db, limit = 100, offset = 0, eventType = null) {
  const where = eventType ? 'WHERE event_type = ?' : '';
  const args  = eventType ? [eventType, limit, offset] : [limit, offset];
  return db.prepare(
    `SELECT sequence, event_type, actor, masked_payload as payload, timestamp
     FROM audit_ledger ${where} ORDER BY sequence DESC LIMIT ? OFFSET ?`
  ).all(...args);
}
