/**
 * O4 — Latency Monitor
 * Tracks response times with Green/Yellow/Red thresholds.
 */

import { getOpsDb, nowIso } from './ops-db';

export type LatencyCategory =
  | 'whatsapp_response'
  | 'executive_snapshot'
  | 'ai_inference'
  | 'workflow_creation'
  | 'approval_processing'
  | 'chat_response'
  | 'connector_fetch';

// Thresholds (ms)
const THRESHOLDS: Record<LatencyCategory, { yellow: number; red: number }> = {
  whatsapp_response:    { yellow: 3000,  red: 8000  },
  executive_snapshot:   { yellow: 2000,  red: 5000  },
  ai_inference:         { yellow: 5000,  red: 15000 },
  workflow_creation:    { yellow: 2000,  red: 6000  },
  approval_processing:  { yellow: 1000,  red: 3000  },
  chat_response:        { yellow: 4000,  red: 10000 },
  connector_fetch:      { yellow: 1500,  red: 4000  },
};

function classify(cat: LatencyCategory, ms: number): 'green' | 'yellow' | 'red' {
  const t = THRESHOLDS[cat];
  if (ms >= t.red) return 'red';
  if (ms >= t.yellow) return 'yellow';
  return 'green';
}

export function recordLatency(
  category: LatencyCategory,
  latency_ms: number,
  source?: string,
): 'green' | 'yellow' | 'red' {
  const status = classify(category, latency_ms);
  try {
    getOpsDb().prepare(`
      INSERT INTO latency_events (category, latency_ms, threshold_status, source, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(category, latency_ms, status, source ?? null, nowIso());
  } catch { /* non-blocking */ }
  if (status === 'red') {
    console.warn(`[O4-LATENCY] RED ${category}: ${latency_ms}ms (threshold ${THRESHOLDS[category].red}ms)`);
  }
  return status;
}

export function getLatencyStats(hours = 1): Record<LatencyCategory, {
  count: number; avg_ms: number; p95_ms: number; p99_ms: number;
  green: number; yellow: number; red: number;
}> {
  const db = getOpsDb();
  const since = new Date(Date.now() - hours * 3600_000).toISOString();
  const cats = Object.keys(THRESHOLDS) as LatencyCategory[];
  const result: Record<string, any> = {};

  for (const cat of cats) {
    const rows = db.prepare(
      `SELECT latency_ms, threshold_status FROM latency_events WHERE category=? AND created_at>=? ORDER BY latency_ms`
    ).all(cat, since) as Array<{ latency_ms: number; threshold_status: string }>;

    const count = rows.length;
    if (count === 0) {
      result[cat] = { count: 0, avg_ms: 0, p95_ms: 0, p99_ms: 0, green: 0, yellow: 0, red: 0 };
      continue;
    }
    const lats = rows.map(r => r.latency_ms);
    const avg_ms = Math.round(lats.reduce((a, b) => a + b, 0) / count);
    const p95_ms = lats[Math.floor(count * 0.95)] ?? lats[count - 1];
    const p99_ms = lats[Math.floor(count * 0.99)] ?? lats[count - 1];
    const green  = rows.filter(r => r.threshold_status === 'green').length;
    const yellow = rows.filter(r => r.threshold_status === 'yellow').length;
    const red    = rows.filter(r => r.threshold_status === 'red').length;
    result[cat] = { count, avg_ms, p95_ms, p99_ms, green, yellow, red };
  }
  return result as Record<LatencyCategory, any>;
}

export function getLatencyHealth(): { status: 'green' | 'yellow' | 'red'; summary: string } {
  const stats = getLatencyStats(1);
  const totalRed = Object.values(stats).reduce((s, v) => s + (v as any).red, 0);
  const totalYellow = Object.values(stats).reduce((s, v) => s + (v as any).yellow, 0);
  if (totalRed > 0) return { status: 'red', summary: `${totalRed} red latency events in last hour` };
  if (totalYellow > 5) return { status: 'yellow', summary: `${totalYellow} yellow latency events in last hour` };
  return { status: 'green', summary: 'All response times within thresholds' };
}

export function getThresholds(): typeof THRESHOLDS {
  return THRESHOLDS;
}
