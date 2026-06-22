// Pending Review Queue — manager actions for Food Safety submissions.
//
// Queue statuses:
//   PENDING_REVIEW - awaiting manager check
//   NEEDS_RETAKE - manager requested a new photo
//   OUT_OF_RANGE - flagged for temperature issues
//   SYNC_PENDING - waiting for Google Sheet sync
//   COMPLETED - approved and closed
//
// Manager actions:
//   Approve, Request Retake, Mark Resolved, Escalate

export const QUEUE_STATUS = Object.freeze({
  PENDING_REVIEW: 'PENDING_REVIEW',
  NEEDS_RETAKE: 'NEEDS_RETAKE',
  OUT_OF_RANGE: 'OUT_OF_RANGE',
  SYNC_PENDING: 'SYNC_PENDING',
  COMPLETED: 'COMPLETED',
});

export const MANAGER_ACTIONS = Object.freeze({
  APPROVE: 'APPROVE',
  REQUEST_RETAKE: 'REQUEST_RETAKE',
  MARK_RESOLVED: 'MARK_RESOLVED',
  ESCALATE: 'ESCALATE',
});

export class ReviewQueue {
  /**
   * @param {object} [opts]
   * @param {() => number} [opts.now] - clock injection for tests
   */
  constructor(opts = {}) {
    this._items = [];
    this._now = opts.now || (() => Date.now());
  }

  /**
   * Add a record to the review queue.
   *
   * @param {object} record - the saved record from RecordStore
   * @param {string} [reason] - why it's in the queue
   * @returns {object} the queue item
   */
  add(record, reason = 'New submission') {
    const status = this._determineStatus(record);
    const item = {
      queue_id: `q_${this._now()}_${Math.random().toString(36).slice(2, 8)}`,
      record_id: record.id,
      store: record.store,
      employee: record.employee_name,
      date: record.date,
      status,
      reason,
      actions: [],
      created_at: new Date(this._now()).toISOString(),
      updated_at: new Date(this._now()).toISOString(),
    };
    this._items.push(item);
    return item;
  }

  /**
   * Perform a manager action on a queue item.
   *
   * @param {string} queueId
   * @param {string} action - one of MANAGER_ACTIONS
   * @param {object} [meta] - { by, notes }
   * @returns {object|null} the updated queue item
   */
  act(queueId, action, meta = {}) {
    const item = this._items.find((i) => i.queue_id === queueId);
    if (!item) return null;

    const validActions = Object.values(MANAGER_ACTIONS);
    if (!validActions.includes(action)) {
      throw new Error(`Invalid action: ${action}. Must be one of: ${validActions.join(', ')}`);
    }

    item.actions.push({
      action,
      by: meta.by || 'manager',
      notes: meta.notes || '',
      at: new Date(this._now()).toISOString(),
    });

    // Transition status based on action
    switch (action) {
      case MANAGER_ACTIONS.APPROVE:
        item.status = QUEUE_STATUS.COMPLETED;
        break;
      case MANAGER_ACTIONS.REQUEST_RETAKE:
        item.status = QUEUE_STATUS.NEEDS_RETAKE;
        break;
      case MANAGER_ACTIONS.MARK_RESOLVED:
        item.status = QUEUE_STATUS.COMPLETED;
        break;
      case MANAGER_ACTIONS.ESCALATE:
        item.reason = `ESCALATED: ${meta.notes || item.reason}`;
        break;
    }

    item.updated_at = new Date(this._now()).toISOString();
    return item;
  }

  /**
   * Get queue items, optionally filtered by status.
   * @param {string} [status]
   * @returns {object[]}
   */
  list(status = null) {
    let results = [...this._items];
    if (status) results = results.filter((i) => i.status === status);
    return results.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  }

  /** Items needing manager attention (not COMPLETED). */
  pending() {
    return this._items.filter((i) => i.status !== QUEUE_STATUS.COMPLETED);
  }

  /** Count of items per status. */
  summary() {
    const counts = {};
    for (const status of Object.values(QUEUE_STATUS)) {
      counts[status] = this._items.filter((i) => i.status === status).length;
    }
    return counts;
  }

  /** Count of pending (non-completed) items. */
  pendingCount() {
    return this.pending().length;
  }

  _determineStatus(record) {
    // Auto-classify based on record state
    if (record.sync_status === 'PENDING' || record.sync_status === 'FAILED') {
      return QUEUE_STATUS.SYNC_PENDING;
    }
    if (record.items && record.items.some((i) => i.inRange === false)) {
      return QUEUE_STATUS.OUT_OF_RANGE;
    }
    if (record.ocr_confidence < 0.75) {
      return QUEUE_STATUS.NEEDS_RETAKE;
    }
    return QUEUE_STATUS.PENDING_REVIEW;
  }
}
