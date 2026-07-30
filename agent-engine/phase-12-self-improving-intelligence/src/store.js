/**
 * store.js — JSON-backed persistence for Phase 12 learning engines.
 *
 * Portable: resolves a data dir relative to this module (no hard-coded OS path).
 * Each store is a separate JSON file holding an array of records.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const DEFAULT_DATA_DIR = join(__dirname, '..', 'data');

function resolveDataDir(override) {
  const dir = override || process.env.MI_PHASE12_DATA_DIR || DEFAULT_DATA_DIR;
  return dir;
}

export class JsonStore {
  /**
   * @param {string} name  filename (without .json)
   * @param {object} [opts]
   * @param {string} [opts.dataDir]
   */
  constructor(name, opts = {}) {
    this.name = name;
    this.dataDir = resolveDataDir(opts.dataDir);
    this.path = join(this.dataDir, `${name}.json`);
    this.records = [];
    this._load();
  }

  _ensureDir() {
    mkdirSync(this.dataDir, { recursive: true });
  }

  _load() {
    try {
      if (existsSync(this.path)) {
        const raw = readFileSync(this.path, 'utf8');
        const parsed = JSON.parse(raw);
        this.records = Array.isArray(parsed) ? parsed : [];
      }
    } catch {
      this.records = [];
    }
  }

  _persist() {
    try {
      this._ensureDir();
      writeFileSync(this.path, JSON.stringify(this.records, null, 2));
    } catch (err) {
      // Non-fatal: learning still works in-memory for the session.
      // eslint-disable-next-line no-console
      console.warn(`[phase12:store] persist failed for ${this.name}: ${err.message}`);
    }
  }

  insert(record) {
    this.records.unshift(record);
    this._persist();
    return record;
  }

  update(id, patch) {
    const idx = this.records.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    this.records[idx] = { ...this.records[idx], ...patch };
    this._persist();
    return this.records[idx];
  }

  find(predicate) {
    return this.records.find(predicate);
  }

  filter(predicate) {
    return this.records.filter(predicate);
  }

  all() {
    return this.records;
  }

  count() {
    return this.records.length;
  }

  /** Wipe store — used by tests for deterministic isolation. */
  clear() {
    this.records = [];
    this._persist();
  }

  /** Hard-delete backing file (tests only). */
  destroy() {
    try {
      if (existsSync(this.path)) rmSync(this.path, { force: true });
    } catch {
      /* noop */
    }
    this.records = [];
  }
}

/** Make a monotonic-ish id with a short random suffix. */
export function makeId(prefix) {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now()}_${rand}`;
}
