'use strict';
/**
 * sqlite-search-fallback.js
 * Full-text search over Food Safety records using SQLite LIKE queries.
 * Used when Qdrant is not configured.
 */

const { all, run } = require('../../storage/sqlite');
const { makeLogger } = require('../../logger');
const log = makeLogger('memory');

async function ensureFtsTable() {
  // Create FTS virtual table if not exists (SQLite FTS5)
  await run(`
    CREATE VIRTUAL TABLE IF NOT EXISTS fs_memory_fts USING fts5(
      record_id,
      store,
      employee,
      shift,
      field_id,
      item_name,
      value,
      status,
      notes,
      submitted_at,
      content='',
      tokenize='unicode61'
    )
  `).catch(() => {});
}

async function indexRecord(record) {
  await ensureFtsTable();
  try {
    await run(
      `INSERT OR REPLACE INTO fs_memory_fts
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
    log.warn('FTS index failed', { error: err.message });
  }
}

async function search({ query, store, status, dateFrom, dateTo, limit = 50 }) {
  await ensureFtsTable();
  const conditions = [];
  const params = [];

  if (query) {
    // FTS5 MATCH
    try {
      const ftsRows = await all(
        `SELECT record_id, store, employee, shift, field_id, item_name, value, status, notes, submitted_at
         FROM fs_memory_fts WHERE fs_memory_fts MATCH ? LIMIT ?`,
        [query, limit]
      );
      return ftsRows;
    } catch (_) {
      // FTS may fail on some query syntax — fall through to LIKE
      conditions.push(`(item_name LIKE ? OR notes LIKE ? OR employee LIKE ?)`);
      params.push(`%${query}%`, `%${query}%`, `%${query}%`);
    }
  }

  if (store)    { conditions.push('store LIKE ?');        params.push(`%${store}%`); }
  if (status)   { conditions.push('status = ?');          params.push(status); }
  if (dateFrom) { conditions.push('submitted_at >= ?');   params.push(dateFrom); }
  if (dateTo)   { conditions.push('submitted_at <= ?');   params.push(dateTo); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  try {
    return await all(
      `SELECT record_id, store, employee, shift, field_id, item_name, value, status, notes, submitted_at
       FROM fs_memory_fts ${where} ORDER BY submitted_at DESC LIMIT ?`,
      [...params, limit]
    );
  } catch (_) {
    return [];
  }
}

module.exports = { indexRecord, search, ensureFtsTable };
