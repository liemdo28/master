/**
 * Chat runtime metrics — counters and latency tracking for the chat layer.
 * All reads are synchronous; no external deps.
 */

export interface ChatMetricsSnapshot {
  requests_total: number;
  requests_success: number;
  requests_failed: number;
  requests_timeout: number;
  requests_queued_rejected: number;
  queue_depth_current: number;
  queue_depth_peak: number;
  active_requests: number;
  ollama_calls: number;
  ollama_timeouts: number;
  circuit_breaker_open: boolean;
  circuit_breaker_trips: number;
  avg_latency_ms: number;
  p95_latency_ms: number;
  uptime_s: number;
  reset_at: string;
}

const started = Date.now();

let reqTotal = 0;
let reqSuccess = 0;
let reqFailed = 0;
let reqTimeout = 0;
let reqQueueRejected = 0;
let queueDepth = 0;
let queueDepthPeak = 0;
let activeRequests = 0;
let ollamaCalls = 0;
let ollamaTimeouts = 0;
let cbOpen = false;
let cbTrips = 0;

const latencyWindow: number[] = [];
const WINDOW_MAX = 200;

export const chatMetrics = {
  reqStart() { reqTotal++; activeRequests++; },
  reqEnd(latencyMs: number, success: boolean) {
    activeRequests = Math.max(0, activeRequests - 1);
    if (success) reqSuccess++; else reqFailed++;
    latencyWindow.push(latencyMs);
    if (latencyWindow.length > WINDOW_MAX) latencyWindow.shift();
  },
  reqTimeout() { reqTimeout++; reqFailed++; activeRequests = Math.max(0, activeRequests - 1); },
  reqQueueRejected() { reqQueueRejected++; },
  queueEnter() { queueDepth++; if (queueDepth > queueDepthPeak) queueDepthPeak = queueDepth; },
  queueLeave() { queueDepth = Math.max(0, queueDepth - 1); },
  ollamaCall() { ollamaCalls++; },
  ollamaTimeout() { ollamaTimeouts++; },
  circuitOpen() { cbOpen = true; cbTrips++; },
  circuitClose() { cbOpen = false; },

  snapshot(): ChatMetricsSnapshot {
    const sorted = [...latencyWindow].sort((a, b) => a - b);
    const avg = sorted.length ? Math.round(sorted.reduce((s, v) => s + v, 0) / sorted.length) : 0;
    const p95 = sorted.length ? sorted[Math.floor(sorted.length * 0.95)] ?? sorted[sorted.length - 1] : 0;
    return {
      requests_total: reqTotal,
      requests_success: reqSuccess,
      requests_failed: reqFailed,
      requests_timeout: reqTimeout,
      requests_queued_rejected: reqQueueRejected,
      queue_depth_current: queueDepth,
      queue_depth_peak: queueDepthPeak,
      active_requests: activeRequests,
      ollama_calls: ollamaCalls,
      ollama_timeouts: ollamaTimeouts,
      circuit_breaker_open: cbOpen,
      circuit_breaker_trips: cbTrips,
      avg_latency_ms: avg,
      p95_latency_ms: p95,
      uptime_s: Math.floor((Date.now() - started) / 1000),
      reset_at: new Date(started).toISOString(),
    };
  },
};
