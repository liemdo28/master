// Data Pipeline Verifier — validates submission integrity across all stages.
//
// For each submission, checks:
//   Photo → OCR → DB → Google Sheet → Dashboard
//
// Marks each stage: OCR_OK | DB_OK | SHEET_OK | DASHBOARD_OK
// If any stage fails or data mismatches: DATA_MISMATCH

export const PIPELINE_STAGES = Object.freeze({
  OCR_OK: 'OCR_OK',
  DB_OK: 'DB_OK',
  SHEET_OK: 'SHEET_OK',
  DASHBOARD_OK: 'DASHBOARD_OK',
  DATA_MISMATCH: 'DATA_MISMATCH',
});

/**
 * @typedef {object} VerificationResult
 * @property {string} record_id
 * @property {string} store
 * @property {string[]} passed - stages that passed
 * @property {string[]} failed - stages that failed
 * @property {string} overall - 'OK' or 'DATA_MISMATCH'
 * @property {string[]} mismatches - description of data mismatches found
 * @property {string} verified_at
 */

export class PipelineVerifier {
  /**
   * @param {object} deps
   * @param {import('../db/RecordStore.js').RecordStore} deps.records
   * @param {import('./AuditTrail.js').AuditTrail} [deps.audit]
   */
  constructor(deps = {}) {
    this._records = deps.records;
    this._audit = deps.audit || null;
    this._results = [];
  }

  /**
   * Verify a single record through the full pipeline.
   *
   * @param {string} recordId
   * @param {object} [ctx] - optional context: { ocrResult, sheetSynced, dashboardRecords }
   * @returns {VerificationResult}
   */
  verify(recordId, ctx = {}) {
    const record = this._records.get(recordId);
    if (!record) {
      return this._fail(recordId, 'RECORD_NOT_FOUND');
    }

    const passed = [];
    const failed = [];
    const mismatches = [];

    // Stage 1: OCR
    if (record.ocr_confidence > 0 && record.items && record.items.length > 0) {
      passed.push(PIPELINE_STAGES.OCR_OK);
    } else {
      failed.push(PIPELINE_STAGES.OCR_OK);
      mismatches.push('OCR did not produce valid items or confidence is 0');
    }

    // Stage 2: DB
    if (record.store && record.date && record.employee_name && record.status) {
      passed.push(PIPELINE_STAGES.DB_OK);
    } else {
      failed.push(PIPELINE_STAGES.DB_OK);
      mismatches.push('DB record missing required fields');
    }

    // Stage 3: Google Sheet
    if (record.sync_status === 'SYNCED' || ctx.sheetSynced === true) {
      passed.push(PIPELINE_STAGES.SHEET_OK);
    } else {
      failed.push(PIPELINE_STAGES.SHEET_OK);
      mismatches.push(`Sheet sync status: ${record.sync_status}`);
    }

    // Stage 4: Dashboard
    const dashboardRecords = ctx.dashboardRecords || this._records.list();
    const visibleInDashboard = dashboardRecords.some((r) => r.id === recordId);
    if (visibleInDashboard) {
      passed.push(PIPELINE_STAGES.DASHBOARD_OK);
    } else {
      failed.push(PIPELINE_STAGES.DASHBOARD_OK);
      mismatches.push('Record not visible in dashboard listing');
    }

    // Cross-check: OCR items match DB items
    if (ctx.ocrResult && record.items) {
      const ocrCount = ctx.ocrResult.items ? ctx.ocrResult.items.length : 0;
      const dbCount = record.items.length;
      if (ocrCount !== dbCount) {
        mismatches.push(`OCR items (${ocrCount}) != DB items (${dbCount})`);
      }
    }

    const overall = failed.length === 0 && mismatches.length === 0 ? 'OK' : 'DATA_MISMATCH';

    const result = {
      record_id: recordId,
      store: record.store,
      passed,
      failed,
      overall,
      mismatches,
      verified_at: new Date().toISOString(),
    };

    this._results.push(result);
    return result;
  }

  /**
   * Verify all records in the store.
   * @returns {VerificationResult[]}
   */
  verifyAll() {
    const records = this._records.list();
    return records.map((r) => this.verify(r.id));
  }

  /** Get all verification results. */
  results() {
    return [...this._results];
  }

  /** Count records with data mismatches. */
  mismatchCount() {
    return this._results.filter((r) => r.overall === 'DATA_MISMATCH').length;
  }

  _fail(recordId, reason) {
    const result = {
      record_id: recordId,
      store: null,
      passed: [],
      failed: [reason],
      overall: 'DATA_MISMATCH',
      mismatches: [reason],
      verified_at: new Date().toISOString(),
    };
    this._results.push(result);
    return result;
  }
}
