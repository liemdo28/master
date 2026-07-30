/**
 * Shared SEO Database
 * JSON-backed key/value + table store. Zero native deps so every agent can boot.
 * Tables = arrays of records with {id, ...payload, _ts}. Concurrent writes are
 * serialized via a simple atomic-write pattern (write to .tmp then rename).
 */
const fs = require('fs');
const path = require('path');

const ENTITIES = [
  'locations',
  'gbp_profiles',
  'apple_profiles',
  'bing_profiles',
  'pages',
  'keywords',
  'schema_items',
  'content_briefs',
  'reviews',
  'citations',
  'technical_issues',
  'ranking_snapshots',
  'analytics_metrics',
  'utm_links',
  'agent_status',
  'agent_tasks',
  'mi_sync_logs',
  'reports',
];

class SharedDatabase {
  constructor(dbPath) {
    this.dbPath = dbPath;
    this.dir = path.dirname(dbPath);
    if (!fs.existsSync(this.dir)) fs.mkdirSync(this.dir, { recursive: true });
    if (!fs.existsSync(this.dbPath)) {
      const empty = {};
      for (const e of ENTITIES) empty[e] = [];
      this._write(empty);
    }
  }

  _read() {
    try {
      return JSON.parse(fs.readFileSync(this.dbPath, 'utf8'));
    } catch (e) {
      const empty = {};
      for (const e2 of ENTITIES) empty[e2] = [];
      return empty;
    }
  }

  _write(data) {
    // Per-process unique tmp file to avoid cross-process rename races on Windows.
    const tmp = `${this.dbPath}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2, 6)}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
    // Retry rename on EPERM/EBUSY (Windows AV / lock). Bounded retries.
    let attempts = 0;
    while (true) {
      try { fs.renameSync(tmp, this.dbPath); return; }
      catch (e) {
        if (++attempts > 10) {
          try { fs.unlinkSync(tmp); } catch (_) {}
          throw e;
        }
        // Tiny sync sleep
        const until = Date.now() + 25;
        while (Date.now() < until) { /* spin */ }
      }
    }
  }

  _ensureTable(db, table) {
    if (!ENTITIES.includes(table)) {
      throw new Error(`Unknown entity table: ${table}`);
    }
    if (!db[table]) db[table] = [];
  }

  insert(table, record) {
    const db = this._read();
    this._ensureTable(db, table);
    const id = record.id || `${table}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const row = { id, ...record, _ts: new Date().toISOString() };
    db[table].push(row);
    this._write(db);
    return row;
  }

  upsert(table, record, key = 'id') {
    const db = this._read();
    this._ensureTable(db, table);
    const idx = db[table].findIndex((r) => r[key] === record[key]);
    const row = { ...record, _ts: new Date().toISOString() };
    if (idx >= 0) db[table][idx] = { ...db[table][idx], ...row };
    else db[table].push({ id: record.id || `${table}_${Date.now()}`, ...row });
    this._write(db);
    return row;
  }

  find(table, predicate = () => true) {
    const db = this._read();
    this._ensureTable(db, table);
    return db[table].filter(predicate);
  }

  all(table) {
    return this.find(table);
  }

  latest(table, predicate = () => true) {
    const rows = this.find(table, predicate);
    return rows.sort((a, b) => (b._ts || '').localeCompare(a._ts || ''))[0] || null;
  }

  count(table) {
    return this.find(table).length;
  }

  delete(table, predicate) {
    const db = this._read();
    this._ensureTable(db, table);
    const before = db[table].length;
    db[table] = db[table].filter((r) => !predicate(r));
    this._write(db);
    return before - db[table].length;
  }

  entities() {
    return [...ENTITIES];
  }
}

let _instance = null;
function getDatabase(dbPath) {
  if (!_instance) _instance = new SharedDatabase(dbPath);
  return _instance;
}

module.exports = { SharedDatabase, getDatabase, ENTITIES };
