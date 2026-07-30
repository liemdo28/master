'use strict';
/**
 * vector-store.js
 * Unified memory store: Qdrant (primary) + SQLite FTS5 (fallback).
 * Callers use this module; they don't need to know which backend is active.
 */

const qdrant  = require('./qdrant-client');
const sqlite  = require('./sqlite-search-fallback');
const { makeLogger } = require('../../logger');
const log = makeLogger('memory');

function buildSearchText(record) {
  return [
    record.store, record.employee, record.shift,
    record.field_id, record.item_name, record.value,
    record.status, record.notes, record.corrective_action,
  ].filter(Boolean).join(' ');
}

async function indexRecord(record) {
  const text = buildSearchText(record);
  const id   = record.record_id || record.id || String(Date.now());
  const [qdrantOk] = await Promise.allSettled([
    qdrant.upsert(id, text, record),
    sqlite.indexRecord(record),
  ]);
  return { qdrant: qdrantOk.status === 'fulfilled' && qdrantOk.value, sqlite: true };
}

async function search(query, opts = {}) {
  const { store, status, dateFrom, dateTo, limit = 50 } = opts;

  if (qdrant.isConfigured()) {
    const filter = buildQdrantFilter({ store, status, dateFrom, dateTo });
    const results = await qdrant.searchSimilar(query, limit, filter).catch(() => null);
    if (results && results.length > 0) return { source: 'qdrant', results };
  }

  const results = await sqlite.search({ query, store, status, dateFrom, dateTo, limit });
  return { source: 'sqlite', results };
}

function buildQdrantFilter({ store, status, dateFrom, dateTo }) {
  const must = [];
  if (store)    must.push({ key: 'store',      match: { value: store } });
  if (status)   must.push({ key: 'status',     match: { value: status } });
  if (dateFrom) must.push({ key: 'submitted_at', range: { gte: dateFrom } });
  if (dateTo)   must.push({ key: 'submitted_at', range: { lte: dateTo } });
  return must.length ? { must } : null;
}

async function getStatus() {
  const qdrantStatus = await qdrant.getStatus();
  return {
    qdrant: qdrantStatus,
    sqlite: { available: true },
    activeBackend: qdrantStatus.configured && qdrantStatus.reachable ? 'qdrant' : 'sqlite',
  };
}

module.exports = { indexRecord, search, getStatus };
