// collectors/MetricCollector.js - High-level facade over BatchWriter + ResourceMonitor
import { BatchWriter }    from './BatchWriter.js';
import { ResourceMonitor } from './ResourceMonitor.js';
import { openDatabase }   from '../core/DatabaseManager.js';
import { randomUUID }     from 'crypto';

export class MetricCollector {
  constructor(options = {}) {
    this._db      = options.db ?? openDatabase();
    this._writer  = new BatchWriter(this._db, {
      flushIntervalMs: options.flushIntervalMs ?? 10000,
      onError: options.onError,
    });
    this._monitor = new ResourceMonitor(this._writer, {
      intervalMs: options.monitorIntervalMs ?? 5000,
    });
    this._sessionId = null;
  }

  startSession(sessionId = null) {
    this._sessionId = sessionId ?? `sess-${Date.now()}-${randomUUID().slice(0, 8)}`;
    this._writer.start();
    this._monitor.start(this._sessionId);
    this._monitor.on('memoryWarning', (info) => {
      console.warn(`[MetricCollector] memory delta ${info.memDeltaPct.toFixed(2)}% — heap ${info.heapUsedMB.toFixed(1)} MB`);
    });
    return this._sessionId;
  }

  async stopSession() {
    this._monitor.stop();
    await this._writer.stop();
  }

  enqueue(table, row) {
    this._writer.enqueue(table, row);
  }

  getStats() {
    return {
      sessionId:   this._sessionId,
      writer:      this._writer.getStats(),
      monitor:     this._monitor.getStats(),
    };
  }

  get db() { return this._db; }
  get writer() { return this._writer; }
  get monitor() { return this._monitor; }
}
