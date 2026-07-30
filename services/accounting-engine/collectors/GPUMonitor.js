// collectors/GPUMonitor.js - GPU monitoring with NVIDIA/AMD/Intel fallback
// Never crashes if GPU unavailable — gracefully returns null fields
import { execSync } from 'child_process';
import { EventEmitter } from 'events';

const SAMPLE_INTERVAL_MS = 10000;

function tryNvidia() {
  try {
    const out = execSync(
      'nvidia-smi --query-gpu=utilization.gpu,memory.used,memory.total,temperature.gpu --format=csv,noheader,nounits',
      { timeout: 3000, stdio: ['ignore', 'pipe', 'ignore'] }
    ).toString().trim();
    if (!out) return null;
    const lines = out.split('\n').map((l) => l.split(',').map((v) => parseFloat(v.trim())));
    // Sum across GPUs
    let gpu_pct = 0, vram_used = 0, vram_total = 0, temp = 0;
    for (const [util, memUsed, memTotal, temperature] of lines) {
      gpu_pct   += isNaN(util)        ? 0 : util;
      vram_used += isNaN(memUsed)     ? 0 : memUsed;
      vram_total+= isNaN(memTotal)    ? 0 : memTotal;
      temp       = isNaN(temperature) ? temp : Math.max(temp, temperature);
    }
    return {
      vendor:        'nvidia',
      gpu_pct:       Math.round((gpu_pct / lines.length) * 10) / 10,
      vram_mb:       Math.round(vram_used),
      vram_total_mb: Math.round(vram_total),
      temperature_c: temp || null,
    };
  } catch {
    return null;
  }
}

function tryAMD() {
  try {
    const out = execSync(
      'rocm-smi --showuse --showmeminfo vram --showtemp --csv',
      { timeout: 3000, stdio: ['ignore', 'pipe', 'ignore'] }
    ).toString().trim();
    if (!out) return null;
    // rocm-smi CSV format is inconsistent — just confirm it ran
    return { vendor: 'amd', gpu_pct: null, vram_mb: null, vram_total_mb: null, temperature_c: null };
  } catch {
    return null;
  }
}

function tryIntel() {
  try {
    // intel_gpu_top exists on some Linux systems
    const out = execSync(
      'intel_gpu_top -J -s 100 2>/dev/null | head -20',
      { timeout: 2000, shell: true, stdio: ['ignore', 'pipe', 'ignore'] }
    ).toString();
    if (!out) return null;
    return { vendor: 'intel', gpu_pct: null, vram_mb: null, vram_total_mb: null, temperature_c: null };
  } catch {
    return null;
  }
}

export class GPUMonitor extends EventEmitter {
  constructor(options = {}) {
    super();
    this._intervalMs = options.intervalMs ?? SAMPLE_INTERVAL_MS;
    this._timer      = null;
    this._vendor     = null;   // detected once, cached
    this._available  = null;   // null=unknown, false=no GPU, true=has GPU
  }

  start() {
    if (this._timer) return this;
    this._timer = setInterval(() => this._sample(), this._intervalMs);
    if (this._timer.unref) this._timer.unref();
    return this;
  }

  stop() {
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
    return this;
  }

  sample() { return this._sample(); }

  _sample() {
    // Short-circuit once we know no GPU is present
    if (this._available === false) {
      const row = this._nullRow();
      this.emit('sample', row);
      return row;
    }

    let result = tryNvidia();
    if (!result) result = tryAMD();
    if (!result) result = tryIntel();

    if (!result) {
      this._available = false;
      const row = this._nullRow();
      this.emit('sample', row);
      return row;
    }

    this._available = true;
    this._vendor    = result.vendor;
    const row = {
      vendor:        result.vendor,
      gpu_pct:       result.gpu_pct,
      vram_mb:       result.vram_mb,
      vram_total_mb: result.vram_total_mb,
      temperature_c: result.temperature_c,
      timestamp:     new Date().toISOString(),
    };
    this.emit('sample', row);
    return row;
  }

  _nullRow() {
    return {
      vendor:        null,
      gpu_pct:       null,
      vram_mb:       null,
      vram_total_mb: null,
      temperature_c: null,
      timestamp:     new Date().toISOString(),
    };
  }

  get available() { return this._available; }
  get vendor()    { return this._vendor; }
}
