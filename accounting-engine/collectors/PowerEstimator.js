// collectors/PowerEstimator.js - Software-based power estimation (no hardware sensors needed)
// Uses CPU/GPU utilization × typical TDP to estimate watts consumed

const CPU_TDP_WATTS  = 65;    // conservative desktop/server estimate
const GPU_TDP_WATTS  = 200;   // conservative GPU estimate
const BASE_WATTS     = 30;    // system baseline (RAM, mobo, storage)
const WH_PER_MS      = 1 / 3600000;  // 1 Wh = 3,600,000 ms

export class PowerEstimator {
  constructor(options = {}) {
    this._cpuTdp  = options.cpuTdpWatts  ?? CPU_TDP_WATTS;
    this._gpuTdp  = options.gpuTdpWatts  ?? GPU_TDP_WATTS;
    this._base    = options.baseWatts     ?? BASE_WATTS;

    this._startMs      = Date.now();
    this._totalCpuWh   = 0;
    this._totalGpuWh   = 0;
    this._totalBaseWh  = 0;
    this._lastSampleMs = Date.now();
    this._samples      = 0;
  }

  // Call with latest cpu_pct (0–100) and optional gpu_pct (0–100 or null)
  record(cpuPct, gpuPct = null) {
    const now      = Date.now();
    const deltaMs  = now - this._lastSampleMs;
    this._lastSampleMs = now;

    const cpuFrac  = Math.min(Math.max(cpuPct, 0), 100) / 100;
    const gpuFrac  = gpuPct != null ? Math.min(Math.max(gpuPct, 0), 100) / 100 : 0;

    this._totalCpuWh  += this._cpuTdp  * cpuFrac * deltaMs * WH_PER_MS;
    this._totalGpuWh  += this._gpuTdp  * gpuFrac * deltaMs * WH_PER_MS;
    this._totalBaseWh += this._base              * deltaMs * WH_PER_MS;
    this._samples++;
  }

  // Snapshot of current power draw based on last known utilisation
  instantWatts(cpuPct, gpuPct = null) {
    const cpu = this._cpuTdp * (Math.min(Math.max(cpuPct, 0), 100) / 100);
    const gpu = gpuPct != null ? this._gpuTdp * (Math.min(Math.max(gpuPct, 0), 100) / 100) : 0;
    return {
      cpu_w:   Math.round(cpu  * 10) / 10,
      gpu_w:   Math.round(gpu  * 10) / 10,
      base_w:  this._base,
      total_w: Math.round((cpu + gpu + this._base) * 10) / 10,
    };
  }

  getSession() {
    const runtimeMs    = Date.now() - this._startMs;
    const totalWh      = this._totalCpuWh + this._totalGpuWh + this._totalBaseWh;
    const runtimeHours = runtimeMs / 3600000;

    return {
      runtime_ms:    runtimeMs,
      runtime_hours: Math.round(runtimeHours * 1000) / 1000,
      cpu_wh:        Math.round(this._totalCpuWh  * 1000) / 1000,
      gpu_wh:        Math.round(this._totalGpuWh  * 1000) / 1000,
      base_wh:       Math.round(this._totalBaseWh * 1000) / 1000,
      total_wh:      Math.round(totalWh * 1000) / 1000,
      avg_watts:     runtimeMs > 0 ? Math.round((totalWh / runtimeHours) * 10) / 10 : 0,
      samples:       this._samples,
      // cost estimate at $0.12/kWh
      cost_usd:      Math.round(totalWh * 0.00012 * 10000) / 10000,
    };
  }

  reset() {
    this._startMs      = Date.now();
    this._totalCpuWh   = 0;
    this._totalGpuWh   = 0;
    this._totalBaseWh  = 0;
    this._lastSampleMs = Date.now();
    this._samples      = 0;
  }
}
