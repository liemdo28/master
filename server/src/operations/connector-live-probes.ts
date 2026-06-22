/**
 * DEV4 — Connector Live Probes
 * 
 * Actual HTTP/network probes to verify connector health.
 * Does NOT rely on registry assumptions or cache freshness alone.
 * Each probe makes a real request and reports live/degraded/down.
 * 
 * Target: BURNIN_MONITOR_TRUSTED
 */

import { execSync } from 'child_process';

// ── Types ──────────────────────────────────────────────────────────────────

export type ProbeStatus = 'live' | 'degraded' | 'down' | 'not_configured' | 'error';

export interface ProbeResult {
  connector_id: string;
  name: string;
  status: ProbeStatus;
  latency_ms: number;
  detail: string;
  probed_at: string;
}

// ── Known service endpoints ────────────────────────────────────────────────

const PROBE_TARGETS: Array<{
  connector_id: string;
  name: string;
  type: 'http' | 'tcp' | 'exec';
  target: string;       // URL, port, or command
  method?: string;      // HTTP method (default GET)
  timeout_ms?: number;  // default 5000
  expect_status?: number; // expected HTTP status (default 200)
  port?: number;        // for TCP probes
}> = [
  {
    connector_id: 'accounting-engine',
    name: 'Accounting Engine',
    type: 'http',
    target: 'http://127.0.0.1:8844/stats',
    timeout_ms: 3000,
    expect_status: 200,
  },
  {
    connector_id: 'mi-core-server',
    name: 'Mi Core Server',
    type: 'http',
    target: 'http://127.0.0.1:4001/api/operations/status',
    timeout_ms: 5000,
    expect_status: 200,
  },
  {
    connector_id: 'pm2-process',
    name: 'PM2 Process',
    type: 'exec',
    target: 'pm2 jlist',
    timeout_ms: 5000,
  },
  {
    connector_id: 'qdrant',
    name: 'Qdrant Vector DB',
    type: 'http',
    target: 'http://127.0.0.1:6333/collections',
    timeout_ms: 3000,
    expect_status: 200,
  },
  {
    connector_id: 'ollama',
    name: 'Ollama Embeddings',
    type: 'http',
    target: 'http://127.0.0.1:11434/api/tags',
    timeout_ms: 3000,
    expect_status: 200,
  },
  {
    connector_id: 'minio',
    name: 'MinIO Object Storage',
    type: 'http',
    target: 'http://127.0.0.1:9000/minio/health/live',
    timeout_ms: 3000,
    expect_status: 200,
  },
  {
    connector_id: 'dashboard-local',
    name: 'Dashboard (bakudanramen.com)',
    type: 'tcp',
    target: 'dashboard.bakudanramen.com',
    port: 443,
    timeout_ms: 5000,
  },
];

// ── Probe implementations ─────────────────────────────────────────────────

function probeHTTP(target: string, method: string, timeout_ms: number, expect_status: number): { status: ProbeStatus; latency_ms: number; detail: string } {
  const start = Date.now();
  try {
    const out = execSync(
      `curl -s -o /dev/null -w "%{http_code}" -X ${method} --max-time ${Math.ceil(timeout_ms / 1000)} "${target}"`,
      { encoding: 'utf-8', timeout: timeout_ms + 2000 },
    );
    const latency_ms = Date.now() - start;
    const code = parseInt(out.trim(), 10);
    if (code === expect_status) {
      return { status: 'live', latency_ms, detail: `HTTP ${code}` };
    }
    if (code > 0 && code < 500) {
      return { status: 'degraded', latency_ms, detail: `HTTP ${code} (expected ${expect_status})` };
    }
    return { status: 'down', latency_ms, detail: `HTTP ${code}` };
  } catch (e) {
    const latency_ms = Date.now() - start;
    const msg = (e instanceof Error ? e.message : String(e)).slice(0, 100);
    if (msg.includes('timed out') || msg.includes('ETIMEDOUT')) {
      return { status: 'down', latency_ms, detail: `Timeout after ${timeout_ms}ms` };
    }
    return { status: 'down', latency_ms, detail: msg };
  }
}

function probeTCP(host: string, port: number, timeout_ms: number): { status: ProbeStatus; latency_ms: number; detail: string } {
  const start = Date.now();
  try {
    execSync(
      `curl -s --max-time ${Math.ceil(timeout_ms / 1000)} -o /dev/null https://${host}:${port}/`,
      { encoding: 'utf-8', timeout: timeout_ms + 2000 },
    );
    const latency_ms = Date.now() - start;
    return { status: 'live', latency_ms, detail: `TCP ${host}:${port} reachable` };
  } catch (e) {
    const latency_ms = Date.now() - start;
    const msg = (e instanceof Error ? e.message : String(e)).slice(0, 100);
    if (msg.includes('timed out') || msg.includes('ETIMEDOUT')) {
      return { status: 'down', latency_ms, detail: `Timeout connecting to ${host}:${port}` };
    }
    // Connection refused might still mean port is open but TLS fails
    if (msg.includes('SSL') || msg.includes('certificate')) {
      return { status: 'degraded', latency_ms, detail: `TCP reachable, TLS issue` };
    }
    return { status: 'down', latency_ms, detail: msg };
  }
}

function probeExec(command: string, timeout_ms: number): { status: ProbeStatus; latency_ms: number; detail: string; raw?: any } {
  const start = Date.now();
  try {
    const out = execSync(command, { encoding: 'utf-8', timeout: timeout_ms });
    const latency_ms = Date.now() - start;
    try {
      const procs = JSON.parse(out) as Array<{
        name: string;
        pm2_env: { status: string; restart_time: number; pm_uptime: number };
      }>;
      const miCore = procs.find(p => p.name === 'mi-core');
      if (miCore) {
        const status = miCore.pm2_env.status;
        const uptime = Math.floor((Date.now() - miCore.pm2_env.pm_uptime) / 1000);
        return {
          status: status === 'online' ? 'live' : 'down',
          latency_ms,
          detail: `PM2 mi-core: status=${status}, restarts=${miCore.pm2_env.restart_time}, uptime=${uptime}s`,
          raw: { status, restarts: miCore.pm2_env.restart_time, uptime_seconds: uptime },
        };
      }
      return { status: 'down', latency_ms, detail: 'mi-core not found in PM2' };
    } catch {
      return { status: 'live', latency_ms, detail: `Command succeeded` };
    }
  } catch (e) {
    const latency_ms = Date.now() - start;
    const msg = e instanceof Error ? e.message : String(e);
    return { status: 'down', latency_ms, detail: msg.slice(0, 100) };
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Probe a single connector by ID.
 */
export function probeConnector(connector_id: string): ProbeResult {
  const target = PROBE_TARGETS.find(t => t.connector_id === connector_id);
  if (!target) {
    return {
      connector_id,
      name: connector_id,
      status: 'not_configured',
      latency_ms: 0,
      detail: 'No probe target configured',
      probed_at: new Date().toISOString(),
    };
  }

  let result: { status: ProbeStatus; latency_ms: number; detail: string; raw?: any };

  switch (target.type) {
    case 'http':
      result = probeHTTP(target.target, target.method || 'GET', target.timeout_ms || 5000, target.expect_status || 200);
      break;
    case 'tcp':
      result = probeTCP(target.target, target.port || 443, target.timeout_ms || 5000);
      break;
    case 'exec':
      result = probeExec(target.target, target.timeout_ms || 5000);
      break;
    default:
      result = { status: 'error', latency_ms: 0, detail: `Unknown probe type: ${target.type}` };
  }

  return {
    connector_id,
    name: target.name,
    status: result.status,
    latency_ms: result.latency_ms,
    detail: result.detail,
    probed_at: new Date().toISOString(),
  };
}

/**
 * Probe all configured connectors.
 */
export function probeAllConnectors(): ProbeResult[] {
  return PROBE_TARGETS.map(t => probeConnector(t.connector_id));
}

/**
 * Get quick health summary from live probes.
 */
export function getProbeSummary(): {
  total: number;
  live: number;
  degraded: number;
  down: number;
  not_configured: number;
  probe_results: ProbeResult[];
  probed_at: string;
} {
  const results = probeAllConnectors();
  return {
    total: results.length,
    live: results.filter(r => r.status === 'live').length,
    degraded: results.filter(r => r.status === 'degraded').length,
    down: results.filter(r => r.status === 'down').length,
    not_configured: results.filter(r => r.status === 'not_configured' || r.status === 'error').length,
    probe_results: results,
    probed_at: new Date().toISOString(),
  };
}
