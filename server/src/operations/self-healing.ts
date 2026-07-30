/**
 * O9 — Runtime Self-Healing
 * Detects anomalies and takes safe corrective actions.
 * Never touches: database migrations, production deployments, financial ops.
 */

import { execSync } from 'child_process';
import { raiseIncident } from './incident-center';
import { getOpsDb, nowIso } from './ops-db';

export interface HealthCheck {
  name: string;
  ok: boolean;
  detail?: string;
  action_taken?: string;
}

// ── Detection functions ───────────────────────────────────────────────────────

function detectRestartStorm(): HealthCheck {
  try {
    const out = execSync('pm2 jlist', { encoding: 'utf-8', timeout: 5000 });
    const procs = JSON.parse(out) as Array<{ name: string; pm2_env: { restart_time: number } }>;
    const miCore = procs.find(p => p.name === 'mi-core');
    if (!miCore) return { name: 'restart_storm', ok: false, detail: 'mi-core not found in PM2' };

    const currentRestarts = miCore.pm2_env.restart_time;
    
    // V2: Use 24h restart DELTA, not cumulative count
    let restarts24h = currentRestarts;
    try {
      const db = getOpsDb();
      const since = new Date(Date.now() - 86400_000).toISOString();
      const earliest = db.prepare(
        `SELECT pm2_restarts FROM burnin_snapshots WHERE created_at >= ? ORDER BY created_at ASC LIMIT 1`
      ).get(since) as { pm2_restarts: number } | undefined;
      if (earliest) restarts24h = Math.max(0, currentRestarts - earliest.pm2_restarts);
    } catch { /* use cumulative as fallback */ }

    if (restarts24h > 50) {
      raiseIncident('whatsapp_failure', 'PM2 restart storm detected',
        `mi-core has restarted ${restarts24h} times in 24h (cumulative: ${currentRestarts})`, 'self-healing', 'P1');
      return { name: 'restart_storm', ok: false, detail: `${restarts24h} restarts in 24h (cumulative: ${currentRestarts})` };
    }
    if (restarts24h > 20) {
      raiseIncident('whatsapp_failure', 'PM2 restart elevated',
        `mi-core has restarted ${restarts24h} times in 24h`, 'self-healing', 'P2');
      return { name: 'restart_storm', ok: false, detail: `${restarts24h} restarts in 24h (elevated)` };
    }
    return { name: 'restart_storm', ok: true, detail: `${restarts24h} restarts in 24h (normal, cumulative: ${currentRestarts})` };
  } catch (e) {
    return { name: 'restart_storm', ok: false, detail: String(e) };
  }
}

function detectStaleConnectors(): HealthCheck {
  try {
    const { existsSync, readFileSync } = require('fs');
    const { join } = require('path');
    const registryPath = join(
      process.env.MI_DATA_DIR ?? join(process.cwd(), '..', '..', '.local-agent-global'),
      'visibility', 'connector-registry.json',
    );
    if (!existsSync(registryPath)) return { name: 'stale_connectors', ok: true, detail: 'no registry' };
    const reg = JSON.parse(readFileSync(registryPath, 'utf-8'));
    const staleThreshold = 2 * 3600_000; // 2 hours
    const now = Date.now();
    const stale: string[] = [];
    for (const [name, info] of Object.entries(reg as Record<string, any>)) {
      const lastSync = info.last_sync_at ? new Date(info.last_sync_at).getTime() : 0;
      if (now - lastSync > staleThreshold && info.auth_status === 'connected') {
        stale.push(name);
      }
    }
    if (stale.length > 0) {
      raiseIncident('connector_failure', 'Stale connectors detected',
        `Stale: ${stale.join(', ')}`, 'self-healing', 'P2');
      return { name: 'stale_connectors', ok: false, detail: `Stale: ${stale.join(', ')}` };
    }
    return { name: 'stale_connectors', ok: true, detail: 'all connectors fresh' };
  } catch (e) {
    return { name: 'stale_connectors', ok: true, detail: 'check skipped' };
  }
}

function detectQueueStuck(): HealthCheck {
  try {
    const res = execSync(
      `curl -s --max-time 3 http://localhost:4001/api/chat/metrics`,
      { encoding: 'utf-8', timeout: 5000 },
    );
    const data = JSON.parse(res);
    if (data.queue_depth > 15) {
      raiseIncident('pipeline_failure', 'Chat queue near capacity',
        `Queue depth: ${data.queue_depth}/20`, 'self-healing', 'P2');
      return { name: 'queue_stuck', ok: false, detail: `Queue depth ${data.queue_depth}` };
    }
    return { name: 'queue_stuck', ok: true, detail: `Queue depth ${data.queue_depth ?? 0}` };
  } catch {
    return { name: 'queue_stuck', ok: true, detail: 'metrics endpoint not available' };
  }
}

function detectWorkflowsStuck(): HealthCheck {
  const db = getOpsDb();
  const threshold = new Date(Date.now() - 4 * 3600_000).toISOString(); // >4h in executing
  const stuck = (db.prepare(`
    SELECT COUNT(*) as n FROM workflows
    WHERE status = 'executing' AND updated_at < ?
  `).get(threshold) as any).n;
  if (stuck > 0) {
    raiseIncident('workflow_failure', 'Stuck workflows detected',
      `${stuck} workflows stuck in executing state >4h`, 'self-healing', 'P2');
    return { name: 'workflow_stuck', ok: false, detail: `${stuck} stuck workflows` };
  }
  return { name: 'workflow_stuck', ok: true, detail: 'no stuck workflows' };
}

function detectApprovalStuck(): HealthCheck {
  const db = getOpsDb();
  const threshold = new Date(Date.now() - 24 * 3600_000).toISOString(); // >24h pending approval
  const stuck = (db.prepare(`
    SELECT COUNT(*) as n FROM workflows
    WHERE status = 'pending_approval' AND created_at < ?
  `).get(threshold) as any).n;
  if (stuck > 0) {
    raiseIncident('approval_failure', 'Stale pending approvals',
      `${stuck} workflows waiting >24h for CEO approval`, 'self-healing', 'P3');
    return { name: 'approval_stuck', ok: false, detail: `${stuck} pending >24h` };
  }
  return { name: 'approval_stuck', ok: true, detail: 'no stale approvals' };
}

// ── Safe corrective actions ───────────────────────────────────────────────────

function safeClearMetrics(): string {
  // Only clear in-memory metrics counters — safe, no data loss
  try {
    execSync(`curl -s -X POST http://localhost:4001/api/chat/metrics/reset`, { timeout: 3000 });
    return 'metrics_reset';
  } catch { return 'reset_skipped'; }
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface SelfHealingReport {
  timestamp: string;
  checks: HealthCheck[];
  all_healthy: boolean;
  actions_taken: string[];
}

export function runSelfHealingCheck(): SelfHealingReport {
  const checks: HealthCheck[] = [
    detectRestartStorm(),
    detectStaleConnectors(),
    detectQueueStuck(),
    detectWorkflowsStuck(),
    detectApprovalStuck(),
  ];

  const actions_taken: string[] = [];
  const queueCheck = checks.find(c => c.name === 'queue_stuck');
  if (queueCheck && !queueCheck.ok) {
    const result = safeClearMetrics();
    actions_taken.push(result);
  }

  const all_healthy = checks.every(c => c.ok);
  const report: SelfHealingReport = {
    timestamp: nowIso(),
    checks,
    all_healthy,
    actions_taken,
  };

  if (!all_healthy) {
    const failing = checks.filter(c => !c.ok).map(c => c.name).join(', ');
    console.warn(`[O9-SELFHEAL] Unhealthy: ${failing}`);
  }

  return report;
}

// ── Scheduled check (call from index.ts) ─────────────────────────────────────
let _healingInterval: NodeJS.Timeout | null = null;

export function startSelfHealingScheduler(intervalMinutes = 5): void {
  if (_healingInterval) return;
  _healingInterval = setInterval(() => {
    try { runSelfHealingCheck(); } catch { /* never crash the server */ }
  }, intervalMinutes * 60_000);
  console.log(`[O9-SELFHEAL] Scheduler started — every ${intervalMinutes}min`);
}

export function stopSelfHealingScheduler(): void {
  if (_healingInterval) { clearInterval(_healingInterval); _healingInterval = null; }
}
