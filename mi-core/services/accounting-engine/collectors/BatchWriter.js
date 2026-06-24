// collectors/BatchWriter.js - Queue → batch commit to SQLite every 5–15 seconds
// P0: never write individual metrics directly — always queue then flush
import { batchInsert } from '../core/DatabaseManager.js';

const DEFAULT_FLUSH_INTERVAL_MS = 10000;  // 10 seconds (within 5–15s spec)
const MAX_QUEUE_SIZE             = 5000;  // safety cap to prevent unbounded growth

export class BatchWriter {
  constructor(db, options = {}) {
    this._db            = db;
    this._flushMs       = options.flushIntervalMs ?? DEFAULT_FLUSH_INTERVAL_MS;
    this._queues        = {};         // tableName → row[]
    this._timer         = null;
    this._flushing      = false;
    this._totalFlushed  = 0;
    this._errorCount    = 0;
    this._onError       = options.onError ?? ((err) => console.error('[BatchWriter]', err.message));
  }

  // Enqueue a row for a given table — never writes directly
  enqueue(tableName, row) {
    if (!this._queues[tableName]) this._queues[tableName] = [];
    const q = this._queues[tableName];

    // Safety cap: drop oldest if queue too large (prevents memory leak)
    if (q.length >= MAX_QUEUE_SIZE) q.shift();
    q.push(row);
  }

  // Start the automatic flush timer
  start() {
    if (this._timer) return;
    this._timer = setInterval(() => this._flush(), this._flushMs);
    if (this._timer.unref) this._timer.unref(); // don't block process exit
    return this;
  }

  // Stop the timer and flush remaining items
  async stop() {
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
    await this._flush();
  }

  // Force an immediate flush (also used internally)
  async _flush() {
    if (this._flushing) return;
    this._flushing = true;
    try {
      for (const [table, rows] of Object.entries(this._queues)) {
        if (!rows.length) continue;
        const batch = rows.splice(0, rows.length); // drain queue atomically
        try {
          const inserted = batchInsert(this._db, table, batch);
          this._totalFlushed += inserted;
        } catch (err) {
          this._errorCount++;
          this._onError(err);
          // put rows back at front so they retry next flush
          this._queues[table] = [...batch, ...(this._queues[table] ?? [])];
        }
      }
    } finally {
      this._flushing = false;
    }
  }

  getStats() {
    const pending = Object.entries(this._queues)
      .reduce((acc, [t, q]) => ({ ...acc, [t]: q.length }), {});
    return { totalFlushed: this._totalFlushed, errorCount: this._errorCount, pending };
  }

  get queueSize() {
    return Object.values(this._queues).reduce((s, q) => s + q.length, 0);
  }
}
