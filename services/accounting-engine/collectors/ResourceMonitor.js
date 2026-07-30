// collectors/ResourceMonitor.js - CPU/memory/disk monitor, no GPU/NVIDIA dependency
import { EventEmitter } from 'events';
import { statSync, existsSync } from 'fs';

const SAMPLE_INTERVAL_MS = 5000;   // sample every 5s
const MEMORY_WARN_PCT    = 0.08;   // warn if delta > 8%

export class ResourceMonitor extends EventEmitter {
  constructor(batchWriter, options = {}) {
    super();
    this._writer         = batchWriter;
    this._intervalMs     = options.intervalMs ?? SAMPLE_INTERVAL_MS;
    this._sessionId      = options.sessionId  ?? null;
    this._timer          = null;
    this._running        = false;
    this._samples        = 0;
    this._baselineMemory = null;
    this._prevCpuUsage   = null;
    this._prevCpuTime    = null;
  }

  start(sessionId = null) {
    if (this._running) return this;
    if (sessionId) this._sessionId = sessionId;
    this._running        = true;
    this._baselineMemory = process.memoryUsage().heapUsed;
    this._prevCpuUsage   = process.cpuUsage();
    this._prevCpuTime    = Date.now();
    this._timer = setInterval(() => this._sample(), this._intervalMs);
    if (this._timer.unref) this._timer.unref();
    return this;
  }

  stop() {
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
    this._running = false;
    return this;
  }

  _sample() {
    try {
      const mem  = process.memoryUsage();
      const now  = Date.now();

      // CPU delta since last sample
      const curCpu     = process.cpuUsage(this._prevCpuUsage);
      const elapsedUs  = (now - this._prevCpuTime) * 1000;
      const cpuPct     = elapsedUs > 0
        ? ((curCpu.user + curCpu.system) / elapsedUs) * 100
        : 0;
      this._prevCpuUsage = process.cpuUsage();
      this._prevCpuTime  = now;

      // Memory
      const heapUsedMB  = mem.heapUsed  / 1048576;
      const heapTotalMB = mem.heapTotal / 1048576;
      const rssMB       = mem.rss       / 1048576;
      const memDeltaPct = this._baselineMemory > 0
        ? (mem.heapUsed - this._baselineMemory) / this._baselineMemory
        : 0;

      if (memDeltaPct > MEMORY_WARN_PCT) {
        this.emit('memoryWarning', { memDeltaPct, heapUsedMB });
      }

      const row = {
        session_id:      this._sessionId,
        timestamp:       new Date(now).toISOString(),
        cpu_pct:         Math.round(cpuPct * 100) / 100,
        memory_mb:       Math.round(heapUsedMB * 100) / 100,
        heap_used_mb:    Math.round(heapUsedMB  * 100) / 100,
        heap_total_mb:   Math.round(heapTotalMB * 100) / 100,
        rss_mb:          Math.round(rssMB        * 100) / 100,
        memory_delta_pct: Math.round(memDeltaPct * 10000) / 100,
        gpu_mb:          null,   // GPU intentionally not monitored — no NVIDIA dep
        disk_free_mb:    this._diskFreeMB(),
      };

      this._writer.enqueue('resource_metrics', row);
      this._samples++;
      this.emit('sample', row);
    } catch (err) {
      this.emit('error', err);
    }
  }

  _diskFreeMB() {
    try {
      // statSync on the process cwd gives us the mount-point info
      const st = statSync(process.cwd());
      // Not available cross-platform without native bindings; return null safely
      return null;
    } catch {
      return null;
    }
  }

  getStats() {
    return {
      running:   this._running,
      samples:   this._samples,
      sessionId: this._sessionId,
    };
  }
}
