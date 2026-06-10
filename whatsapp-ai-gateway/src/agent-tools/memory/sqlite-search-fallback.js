'use strict';
/**
 * sqlite-search-fallback.js
 * Full-text search over Food Safety records using a regular SQLite table.
 * Used when Qdrant is not configured.
 */

const { all, run } = require('../../storage/sqlite');
const { makeLogger } = require('../../logger');
const log = makeLogger('memory');

async function ensureFtsTable() {
  await run(`
    CREATE TABLE IF NOT EXISTS fs_memory_records (
      record_id   TEXT PRIMARY KEY,
      store       TEXT,
      employee    TEXT,
      shift       TEXT,
      field_id    TEXT,
      item_name   TEXT,
      value       TEXT,
      status      TEXT,
      notes       TEXT,
      submitted_at TEXT
    )
  `).catch(() => {});
  await run(`CREATE INDEX IF NOT EXISTS idx_fsmem_store ON fs_memory_records(store)`).catch(() => {});
  await run(`CREATE INDEX IF NOT EXISTS idx_fsmem_status ON fs_memory_records(status)`).catch(() => {});
  await run(`CREATE INDEX IF NOT EXISTS idx_fsmem_date ON fs_memory_records(submitted_at)`).catch(() => {});
}

async function indexRecord(record) {
  await ensureFtsTable();
  try {
    await run(
      `INSERT OR REPLACE INTO fs_memory_records
       (record_id, store, employee, shift, field_id, item_name, value, status, notes, submitted_at)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [
        record.record_id || record.id || '',
        record.store || '',
        record.employee || '',
        record.shift || '',
        record.field_id || '',
        record.item_name || '',
        String(record.value ?? ''),
        record.status || '',
        record.notes || record.corrective_action || '',
        record.submitted_at || record.timestamp || new Date().toISOString(),
      ]
    );
  } catch (err) {
    log.warn('Memory index failed', { error: err.message });
  }
}

async function search({ query, store, status, dateFrom, dateTo, limit = 50 }) {
  await ensureFtsTable();
  const conditions = [];
  const params = [];

  if (query) {
    conditions.push(`(item_name LIKE ? OR notes LIKE ? OR employee LIKE ? OR store LIKE ? OR value LIKE ?)`);
    const q = `%${query}%`;
    params.push(q, q, q, q, q);
  }
  if (store)    { conditions.push('store LIKE ?');         params.push(`%${store}%`); }
  if (status)   { conditions.push('status = ?');           params.push(status); }
  if (dateFrom) { conditions.push('submitted_at >= ?');    params.push(dateFrom); }
  if (dateTo)   { conditions.push('submitted_at <= ?');    params.push(dateTo); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  try {
    return await all(
      `SELECT record_id, store, employee, shift, field_id, item_name, value, status, notes, submitted_at
       FROM fs_memory_records ${where} ORDER BY submitted_at DESC LIMIT ?`,
      [...params, limit]
    );
  } catch (err) {
    log.warn('Memory search failed', { error: err.message });
    return [];
  }
}

module.exports = { indexRecord, search, ensureFtsTable };
