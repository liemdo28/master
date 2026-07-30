/**
 * Transaction Helper
 *
 * Provides safe transaction wrappers for multi-step SQLite writes.
 * Ensures WAL-friendly batch operations to avoid SQLITE_BUSY.
 *
 * Rules:
 * - Use BEGIN IMMEDIATE for write transactions (acquires lock early)
 * - Keep transactions short — commit quickly
 * - Use batch insert for high-volume parallel operations
 * - Set busy_timeout in the DB config (already set to 5000ms in sqlite.js)
 */

const { getDb, run, all, get } = require('./sqlite');
const { makeLogger } = require('../logger');

const log = makeLogger('whatsapp');

// ── Transaction: Promise-based wrapper ────────────────────────────────────────
// Use BEGIN IMMEDIATE to acquire write lock at start (WAL-safe)
function transaction(stmts) {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.run('BEGIN IMMEDIATE', function (err) {
      if (err) { reject(err); return; }
      // stmts is an array of {sql, params} or a single function(db) for complex logic
      if (typeof stmts === 'function') {
        try {
          const result = stmts(db);
          db.run('COMMIT', function (err2) {
            if (err2) { reject(err2); } else { resolve(result); }
          });
        } catch (e) {
          db.run('ROLLBACK', () => reject(e));
        }
      } else {
        // Execute array of {sql, params} sequentially
        const results = [];
        let idx = 0;
        function next() {
          if (idx >= stmts.length) {
            db.run('COMMIT', function (err2) {
              if (err2) reject(err2); else resolve(results);
            });
            return;
          }
          const s = stmts[idx++];
          db.run(s.sql, s.params || [], function (err3) {
            if (err3) {
              db.run('ROLLBACK', () => reject(err3));
            } else {
              results.push(this);
              next();
            }
          });
        }
        next();
      }
    });
  });
}

// ── Batch Insert ──────────────────────────────────────────────────────────────
// Insert multiple rows with a single transaction (WAL-safe for high-volume)
async function batchInsert(tableName, columns, rows) {
  if (!rows || rows.length === 0) return [];
  const colNames = columns.join(', ');
  const placeholders = `(${columns.map(() => '?').join(', ')})`;
  const multiPlaceholders = rows.map(() => placeholders).join(', ');
  const params = rows.flat();
  const sql = `INSERT INTO ${tableName} (${colNames}) VALUES ${multiPlaceholders}`;
  try {
    await transaction([{ sql, params }]);
    return rows.map((_, i) => i + 1);
  } catch (err) {
    log.warn('batchInsert failed, trying one-by-one', { tableName, error: err.message });
    // Fallback: one-by-one with individual transactions
    const ids = [];
    for (const row of rows) {
      const p = row;
      const s = `INSERT INTO ${tableName} (${colNames}) VALUES ${placeholders}`;
      try {
        const r = await run(s, p);
        ids.push(r.lastID);
      } catch (e) {
        log.warn('row insert failed', { tableName, row, error: e.message });
        ids.push(null);
      }
    }
    return ids;
  }
}

// ── Multi-row read helper ─────────────────────────────────────────────────────
// Safe read that waits for WAL checkpoint (avoids SQLITE_BUSY on reads)
async function readSafe(sql, params = []) {
  // SQLite reads in WAL mode don't block, but we add a small retry
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await all(sql, params);
    } catch (err) {
      if (err.message.includes('SQLITE_BUSY') && attempt < 2) {
        await new Promise(r => setTimeout(r, 100 * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }
}

// ── Write with retry ─────────────────────────────────────────────────────────
async function writeWithRetry(sql, params = []) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await run(sql, params);
    } catch (err) {
      if (err.message.includes('SQLITE_BUSY') && attempt < 2) {
        await new Promise(r => setTimeout(r, 200 * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }
}

// ── Sequential batch ─────────────────────────────────────────────────────────
// Write many rows sequentially in one transaction (avoids concurrent lock)
async function sequentialBatch(tableName, columns, rows) {
  if (!rows || rows.length === 0) return [];
  const colNames = columns.join(', ');
  const placeholders = `(${columns.map(() => '?').join(', ')})`;
  const stmts = rows.map(row => ({
    sql: `INSERT INTO ${tableName} (${colNames}) VALUES ${placeholders}`,
    params: Array.isArray(row) ? row : columns.map(c => row[c]),
  }));
  await transaction(stmts);
  return rows.map((_, i) => i + 1);
}

// ── Health check ─────────────────────────────────────────────────────────────
async function healthCheck() {
  try {
    const db = getDb();
    const result = await new Promise((resolve, reject) => {
      db.get('PRAGMA journal_mode', (err, row) => {
        if (err) reject(err); else resolve(row);
      });
    });
    return { ok: true, journalMode: result?.journal_mode || 'unknown' };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

module.exports = { transaction, batchInsert, readSafe, writeWithRetry, sequentialBatch, healthCheck };