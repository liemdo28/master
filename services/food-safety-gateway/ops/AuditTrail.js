// Record Audit Trail — append-only log of every Food Safety submission.
//
// Writes one structured JSON line per submission to logs/record-audit.log.
// The audit captures the full pipeline outcome so the CEO can trace any record
// end-to-end (photo → OCR → DB → Google Sheet → dashboard).

import fs from 'node:fs';
import path from 'node:path';

export class AuditTrail {
  /**
   * @param {object} [opts]
   * @param {string} [opts.filePath] - audit log path. Omit for in-memory only.
   * @param {() => number} [opts.now] - clock injection for tests
   */
  constructor(opts = {}) {
    this._filePath = opts.filePath || null;
    this._now = opts.now || (() => Date.now());
    this._entries = [];
    this._load();
  }

  _load() {
    if (!this._filePath) return;
    try {
      if (fs.existsSync(this._filePath)) {
        const raw = fs.readFileSync(this._filePath, 'utf8');
        this._entries = raw
          .split('\n')
          .filter((line) => line.trim())
          .map((line) => {
            try {
              return JSON.parse(line);
            } catch {
              return null;
            }
          })
          .filter(Boolean);
      }
    } catch {
      this._entries = [];
    }
  }

  /**
   * Append a single audit entry for a submission.
   *
   * @param {object} entry
   * @param {string} entry.store
   * @param {string} entry.employee
   * @param {string} entry.date
   * @param {string} entry.image_filename
   * @param {object} entry.ocr_extracted_values
   * @param {object} entry.db_saved_values
   * @param {string} entry.sheet_sync_result
   * @param {boolean} entry.dashboard_visible
   * @param {string} [entry.record_id]
   * @returns {object} the persisted audit entry
   */
  log(entry) {
    const auditEntry = {
      audit_id: `audit_${this._now()}_${Math.random().toString(36).slice(2, 8)}`,
      record_id: entry.record_id || null,
      store: entry.store,
      employee: entry.employee,
      date: entry.date,
      image_filename: entry.image_filename,
      ocr_extracted_values: entry.ocr_extracted_values || {},
      db_saved_values: entry.db_saved_values || {},
      sheet_sync_result: entry.sheet_sync_result,
      dashboard_visible: !!entry.dashboard_visible,
      created_at: new Date(this._now()).toISOString(),
    };

    this._entries.push(auditEntry);
    this._append(auditEntry);
    return auditEntry;
  }

  _append(auditEntry) {
    if (!this._filePath) return;
    fs.mkdirSync(path.dirname(this._filePath), { recursive: true });
    fs.appendFileSync(this._filePath, JSON.stringify(auditEntry) + '\n', 'utf8');
  }

  /** Return all audit entries (newest first). */
  list() {
    return [...this._entries].reverse();
  }

  /** Find audit entries for a specific record id. */
  forRecord(recordId) {
    return this._entries.filter((e) => e.record_id === recordId);
  }

  /** Count of audit entries. */
  count() {
    return this._entries.length;
  }
}
