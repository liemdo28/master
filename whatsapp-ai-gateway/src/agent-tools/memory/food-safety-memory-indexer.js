'use strict';
/**
 * food-safety-memory-indexer.js
 * Indexes Food Safety submissions into the vector store on submission events.
 * Wraps existing submission data from SQLite food_safety_submissions table.
 */

const { indexRecord, search, getStatus } = require('./vector-store');
const { makeLogger } = require('../../logger');
const log = makeLogger('memory');

let _db = null;
function getDb() {
  if (!_db) {
    try { _db = require('../../storage/sqlite'); } catch (_) {}
  }
  return _db;
}

async function indexSubmission(submission) {
  const record = normalizeSubmission(submission);
  const result = await indexRecord(record);
  log.info('Indexed food safety submission', { id: record.record_id, ...result });
  return result;
}

async function indexBatch(submissions) {
  let indexed = 0;
  for (const s of submissions) {
    try { await indexSubmission(s); indexed++; } catch (err) {
      log.warn('Batch index error', { error: err.message });
    }
  }
  return { indexed, total: submissions.length };
}

async function reindexAll() {
  const db = getDb();
  if (!db) return { ok: false, error: 'SQLite not available' };
  try {
    const rows = await db.all('SELECT * FROM food_safety_submissions ORDER BY submitted_at DESC LIMIT 5000');
    const result = await indexBatch(rows);
    log.info('Reindex complete', result);
    return { ok: true, ...result };
  } catch (err) {
    log.warn('Reindex failed', { error: err.message });
    return { ok: false, error: err.message };
  }
}

async function searchSubmissions(query, opts = {}) {
  return search(query, opts);
}

async function getMemoryStatus() {
  return getStatus();
}

function normalizeSubmission(s) {
  return {
    record_id:    String(s.id || s.record_id || ''),
    store:        s.store_id || s.store || '',
    employee:     s.employee || s.submitted_by || '',
    shift:        s.shift || s.shift_time || '',
    field_id:     s.field_id || '',
    item_name:    s.item_name || s.item || '',
    value:        String(s.value ?? s.reading ?? ''),
    status:       s.status || s.pass_fail || '',
    notes:        s.notes || s.corrective_action || '',
    submitted_at: s.submitted_at || s.timestamp || new Date().toISOString(),
  };
}

module.exports = { indexSubmission, indexBatch, reindexAll, searchSubmissions, getMemoryStatus, normalizeSubmission };
