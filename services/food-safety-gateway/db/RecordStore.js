// Local record database for Food Safety submissions.
//
// Backed by a JSON file so the pilot runs with zero external services. The
// path is injectable so tests can use a temp file (or in-memory mode).

import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export const SYNC_STATUS = Object.freeze({
  PENDING: 'PENDING',
  SYNCED: 'SYNCED',
  FAILED: 'FAILED',
});

export class RecordStore {
  /**
   * @param {object} [opts]
   * @param {string} [opts.filePath] - JSON file path. Omit for in-memory only.
   */
  constructor(opts = {}) {
    this._filePath = opts.filePath || null;
    this._records = [];
    this._load();
  }

  _load() {
    if (!this._filePath) return;
    try {
      if (fs.existsSync(this._filePath)) {
        const raw = fs.readFileSync(this._filePath, 'utf8');
        this._records = raw.trim() ? JSON.parse(raw) : [];
      }
    } catch {
      this._records = [];
    }
  }

  _persist() {
    if (!this._filePath) return;
    fs.mkdirSync(path.dirname(this._filePath), { recursive: true });
    fs.writeFileSync(this._filePath, JSON.stringify(this._records, null, 2), 'utf8');
  }

  /**
   * Insert a confirmed record.
   * Required fields: store, date, employee_name, shift, manager, items[],
   * image_path, ocr_confidence, status.
   * @param {object} input
   * @returns {object} the saved record (with id + created_at + sync_status)
   */
  insert(input) {
    const record = {
      id: randomUUID(),
      store: input.store,
      date: input.date,
      employee_name: input.employee_name,
      shift: input.shift,
      manager: input.manager,
      items: Array.isArray(input.items) ? input.items : [],
      image_path: input.image_path,
      ocr_confidence: input.ocr_confidence,
      status: input.status || 'COMPLETED',
      sync_status: input.sync_status || SYNC_STATUS.PENDING,
      created_at: input.created_at || new Date().toISOString(),
    };
    this._records.push(record);
    this._persist();
    return record;
  }

  /**
   * Update the sync status of a record by id.
   * @param {string} id
   * @param {string} syncStatus
   */
  setSyncStatus(id, syncStatus) {
    const rec = this._records.find((r) => r.id === id);
    if (!rec) return null;
    rec.sync_status = syncStatus;
    this._persist();
    return rec;
  }

  /** Return all records (newest first). */
  list() {
    return [...this._records].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  }

  /** Find a record by id. */
  get(id) {
    return this._records.find((r) => r.id === id) || null;
  }

  /** Count of stored records. */
  count() {
    return this._records.length;
  }
}
