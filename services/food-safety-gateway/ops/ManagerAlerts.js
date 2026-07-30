// Manager Alert Engine — triggers alerts for Food Safety anomalies.
//
// Alert conditions:
//   - Out-of-range temperature
//   - Missing required field
//   - OCR confidence too low
//   - Google Sheet sync failure
//   - Store did not submit by deadline
//
// Alerts go to the dashboard first. WhatsApp manager notification is optional.

export const ALERT_TYPES = Object.freeze({
  OUT_OF_RANGE: 'OUT_OF_RANGE',
  MISSING_FIELD: 'MISSING_FIELD',
  LOW_CONFIDENCE: 'LOW_CONFIDENCE',
  SYNC_FAILURE: 'SYNC_FAILURE',
  MISSED_DEADLINE: 'MISSED_DEADLINE',
});

export const ALERT_SEVERITY = Object.freeze({
  CRITICAL: 'CRITICAL',
  WARNING: 'WARNING',
  INFO: 'INFO',
});

const LOW_CONFIDENCE_THRESHOLD = 0.75;

export class ManagerAlerts {
  /**
   * @param {object} [opts]
   * @param {(alert: object) => Promise<void>} [opts.notifier] - optional WhatsApp notifier
   * @param {() => number} [opts.now] - clock injection for tests
   */
  constructor(opts = {}) {
    this._alerts = [];
    this._notifier = opts.notifier || null;
    this._now = opts.now || (() => Date.now());
  }

  /**
   * Evaluate a completed record and generate alerts for any anomalies.
   *
   * @param {object} record - the saved record from RecordStore
   * @param {object} [ocrResult] - raw OCR result for range checking
   * @returns {object[]} array of generated alerts
   */
  evaluate(record, ocrResult = null) {
    const generated = [];

    // Check OCR confidence
    if (record.ocr_confidence < LOW_CONFIDENCE_THRESHOLD) {
      generated.push(this._create({
        type: ALERT_TYPES.LOW_CONFIDENCE,
        severity: ALERT_SEVERITY.WARNING,
        store: record.store,
        record_id: record.id,
        message: `OCR confidence ${Math.round(record.ocr_confidence * 100)}% is below ${LOW_CONFIDENCE_THRESHOLD * 100}% threshold`,
        value: record.ocr_confidence,
      }));
    }

    // Check sync failure
    if (record.sync_status === 'PENDING' || record.sync_status === 'FAILED') {
      generated.push(this._create({
        type: ALERT_TYPES.SYNC_FAILURE,
        severity: ALERT_SEVERITY.WARNING,
        store: record.store,
        record_id: record.id,
        message: `Google Sheet sync status: ${record.sync_status}`,
      }));
    }

    // Check missing required fields
    const requiredFields = ['store', 'date', 'employee_name', 'shift'];
    for (const field of requiredFields) {
      if (!record[field]) {
        generated.push(this._create({
          type: ALERT_TYPES.MISSING_FIELD,
          severity: ALERT_SEVERITY.CRITICAL,
          store: record.store,
          record_id: record.id,
          message: `Required field missing: ${field}`,
          field,
        }));
      }
    }

    // Check out-of-range temperatures (from items array)
    if (record.items && Array.isArray(record.items)) {
      for (const item of record.items) {
        if (item.inRange === false) {
          generated.push(this._create({
            type: ALERT_TYPES.OUT_OF_RANGE,
            severity: ALERT_SEVERITY.CRITICAL,
            store: record.store,
            record_id: record.id,
            message: `${item.label}: ${item.value}${item.unit || ''} is out of range`,
            field_id: item.fieldId || item.key,
            value: item.value,
          }));
        }
      }
    }

    return generated;
  }

  /**
   * Create a missed-deadline alert when a store has not submitted by a given time.
   *
   * @param {string} store - store name
   * @param {string} deadline - expected submission deadline (e.g. "10:00 AM")
   * @returns {object} the alert
   */
  missedDeadline(store, deadline) {
    return this._create({
      type: ALERT_TYPES.MISSED_DEADLINE,
      severity: ALERT_SEVERITY.CRITICAL,
      store,
      record_id: null,
      message: `${store} did not submit by ${deadline}`,
    });
  }

  /**
   * Get all alerts, optionally filtered.
   * @param {object} [filter] - { store, type, severity }
   */
  list(filter = {}) {
    let results = [...this._alerts];
    if (filter.store) results = results.filter((a) => a.store === filter.store);
    if (filter.type) results = results.filter((a) => a.type === filter.type);
    if (filter.severity) results = results.filter((a) => a.severity === filter.severity);
    return results.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  }

  /** Alerts requiring immediate action (CRITICAL severity). */
  critical() {
    return this.list({ severity: ALERT_SEVERITY.CRITICAL });
  }

  /** Count of unresolved alerts. */
  count() {
    return this._alerts.filter((a) => a.resolved === false).length;
  }

  /**
   * Resolve an alert by id.
   * @param {string} alertId
   * @param {string} [resolvedBy]
   */
  resolve(alertId, resolvedBy = 'system') {
    const alert = this._alerts.find((a) => a.id === alertId);
    if (!alert) return null;
    alert.resolved = true;
    alert.resolved_by = resolvedBy;
    alert.resolved_at = new Date(this._now()).toISOString();
    return alert;
  }

  _create(data) {
    const alert = {
      id: `alert_${this._now()}_${Math.random().toString(36).slice(2, 8)}`,
      ...data,
      resolved: false,
      resolved_by: null,
      resolved_at: null,
      created_at: new Date(this._now()).toISOString(),
    };
    this._alerts.push(alert);

    // Fire optional WhatsApp notification (never blocks)
    if (this._notifier) {
      this._notifier(alert).catch(() => {});
    }

    return alert;
  }
}
