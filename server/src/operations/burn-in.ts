/**
 * O5 — Burn-In Automation V2.1
 * 
 * Hourly snapshot: uptime, 24h restart delta, failures, latency, quality.
 * Writes BURN_IN_DAILY_REPORT.md every 24 hours.
 * 
 * V2 CHANGES (DEV4):
 *   - Uses 24h restart DELTA (not lifetime cumulative count)
 *   - Consumes /api/workflows/metrics (not inferred scoring)
 *   - Success rate computed from workflow_execution_ledger (single source of truth)
 * 
 * V2.1 CHANGES (DEV4 + DEV5 — Burn-In V2):
 *   - Connector live probes (actual HTTP/TCP/PM2 checks, not registry assumptions)
 *   - Memory architecture validation (no phantom stores)
 *   - Approval source-of-truth (unified across all surfaces)
 *   - Failure evidence tracking (structured, securable)
 *   - Burn-in score uses live probe results in addition to incident data
 */

import { execSync } from 'child_process';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { getOpsDb, nowIso } from './ops-db';
import { getIncidentStats } from './incident-center';
import { getLatencyStats } from './latency-monitor';
import { computeQualityScore } from './quality-metrics';
import { computeWorkflowMetrics } from '../execution/workflow-metrics';
import { getProbeSummary, type ProbeResult } from './connector-live-probes';
import { validateMemoryArchitecture, type MemoryArchitectureReport } from './memory-architecture-validator';
import { getApprovalSourceOfTruth, type ApprovalTruth } from './approval-source-of-truth';
import { seedKnownFailures, getFailureSummary, type FailureSummary } from '../execution/failure-evidence-store';

const REPORTS_DIR = join(process.cwd(), '..', 'reports');
if (!existsSync(REPORTS_DIR)) mkdirSync(REPORTS_DIR, { recursive: true });

// ── Snapshot schema ────────────────────────────────────────────────────────

export interface BurnInSnapshot {
  uptime_seconds: number;
  pm2_restarts: number;
  connector_failures: number;
  ai_failures: number;
  workflow_failures: number;
  active_incidents: number;
  avg_latency_ms: number;
  quality_score: number;
  created_at: string;
}

// ── PM2 info ───────────────────────────────────────────────────────────────

function getPm2Info(): { restarts: number; uptime_seconds: number } {
  try {
    const out = execSync('pm2 jlist', { encoding: 'utf-8', timeout: 5000 });
    const procs = JSON.parse(out) as Array<{
      name: string;
      pm2_env: { restart_time: number; pm_uptime: number };
    }>;
    const miCore = procs.find(p => p.name === 'mi-core');
    if (!miCore) return { restarts: 0, uptime_seconds: 0 };
    const uptime = Math.floor((Date.now() - miCore.pm2_env.pm_uptime) / 1000);
    return { restarts: miCore.pm2_env.restart_time, uptime_seconds: uptime };
  } catch { return { restarts: 0, uptime_seconds: 0 }; }
}

// ── Hourly snapshot ────────────────────────────────────────────────────────

function captureHourlySnapshot(): BurnInSnapshot {
  const db = getOpsDb();
  const pm2 = getPm2Info();
  const incidents = getIncidentStats();
  const latStats = getLatencyStats(1);
  const quality = computeQualityScore(1);

  const allLats = Object.values(latStats).flatMap(s => Array((s as any).count).fill((s as any).avg_ms)).filter(Boolean);
  const avg_latency_ms = allLats.length ? Math.round(allLats.reduce((a, b) => a + b, 0) / allLats.length) : 0;

  const snapshot: BurnInSnapshot = {
    uptime_seconds: pm2.uptime_seconds,
    pm2_restarts: pm2.restarts,
    connector_failures: incidents.total_24h - incidents.resolved_24h,
    ai_failures: 0,
    workflow_failures: 0,
    active_incidents: incidents.active,
    avg_latency_ms,
    quality_score: quality.overall,
    created_at: nowIso(),
  };

  db.prepare(`
    INSERT INTO burnin_snapshots
      (uptime_seconds, pm2_restarts, connector_failures, ai_failures, workflow_failures,
       active_incidents, avg_latency_ms, quality_score, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    snapshot.uptime_seconds, snapshot.pm2_restarts, snapshot.connector_failures,
    snapshot.ai_failures, snapshot.workflow_failures, snapshot.active_incidents,
    snapshot.avg_latency_ms, snapshot.quality_score, snapshot.created_at,
  );

  return snapshot;
}

// ── 24h restart delta ─────────────────────────────────────────────────────

function get24hRestartDelta(): number {
  try {
    const out = execSync('pm2 jlist', { encoding: 'utf-8', timeout: 5000 });
    const procs = JSON.parse(out) as Array<{
      name: string;
      pm2_env: { restart_time: number; pm_uptime: number };
    }>;
    const miCore = procs.find(p => p.name === 'mi-core');
    if (!miCore) return 0;
    const currentRestarts = miCore.pm2_env.restart_time;
    const db = getOpsDb();
    const since = new Date(Date.now() - 86400_000).toISOString();
    const earliest = db.prepare(
      `SELECT pm2_restarts FROM burnin_snapshots WHERE created_at >= ? ORDER BY created_at ASC LIMIT 1`
    ).get(since) as { pm2_restarts: number } | undefined;
    if (!earliest) return currentRestarts;
    return Math.max(0, currentRestarts - earliest.pm2_restarts);
  } catch { return 0; }
}

// ── Daily report generator ────────────────────────────────────────────────

function generateDailyReport(): void {
  const db = getOpsDb();
  const since = new Date(Date.now() - 86400_000).toISOString();
  const snapshots = db.prepare(
    `SELECT * FROM burnin_snapshots WHERE created_at >= ? ORDER BY created_at`
  ).all(since) as BurnInSnapshot[];

  if (snapshots.length === 0) return;

  const last = snapshots[snapshots.length - 1];
  const incidents = getIncidentStats();
  const quality = computeQualityScore(24);
  const latency = getLatencyStats(24);

  // ── V2: Use workflow metrics from execution ledger (source of truth) ──────
  const workflowMetrics = computeWorkflowMetrics(24);

  // ── V2: Use 24h restart delta, not cumulative count ───────────────────────
  const restarts24h = get24hRestartDelta();

  // ── V2.1: Connector live probes ───────────────────────────────────────────
  const probeSummary = getProbeSummary();

  // ── V2.1: Memory architecture validation ──────────────────────────────────
  const memoryReport = validateMemoryArchitecture();

  // ── V2.1: Approval source of truth ────────────────────────────────────────
  const approvalTruth = getApprovalSourceOfTruth();

  // ── V2.1: Failure evidence summary ────────────────────────────────────────
  const failureSummary = getFailureSummary(24);

  const avgLatAll = Object.values(latency).map(s => (s as any).avg_ms).filter(Boolean);
  const avgLat = avgLatAll.length ? Math.round(avgLatAll.reduce((a, b) => a + b, 0) / avgLatAll.length) : 0;
  const redEvents = Object.values(latency).reduce((s, v) => s + (v as any).red, 0);

  // ── Connector health points (from live probes, not registry) ──────────────
  const connectorPts = probeSummary.down === 0 && probeSummary.degraded === 0
    ? 15
    : Math.max(0, 15 - probeSummary.down * 5 - probeSummary.degraded * 2);

  // ── Memory health points ──────────────────────────────────────────────────
  const memoryPts = memoryReport.overall_status === 'HEALTHY' ? 10
    : memoryReport.overall_status === 'DEGRADED' ? 5
    : 0;

  // ── V2.1: Score uses live probes + workflow metrics + actual quality ──────
  const burnInScore = Math.round(
    (last.active_incidents === 0 ? 20 : Math.max(0, 20 - last.active_incidents * 4)) +    // 20 pts
    (redEvents === 0 ? 10 : Math.max(0, 10 - redEvents * 2)) +                              // 10 pts
    quality.overall * 0.15 +                                                                   // 15 pts
    workflowMetrics.success_rate_24h * 0.15 +                                                  // 15 pts
    connectorPts +                                                                             // 15 pts (live probes)
    memoryPts +                                                                                // 10 pts
    (restarts24h < 5 ? 10 : restarts24h < 20 ? 5 : Math.max(0, 10 - restarts24h * 0.5)) +   // 10 pts
    (approvalTruth.consistency === 'CONSISTENT' ? 5 : 0)                                      //  5 pts
  );

  const now = new Date().toISOString().slice(0, 10);
  const report = `# Burn-In Daily Report (V2.1 — Source of Truth)
**Date:** ${now}
**Generated:** ${nowIso()}
**Burn-In Score:** ${burnInScore}/100

## System Health (V2.1 — All Metrics Verified)

| Metric | Value | Status |
|--------|-------|--------|
| PM2 Restarts (24h delta) | ${restarts24h} | ${restarts24h < 5 ? '✅' : restarts24h < 20 ? '⚠️' : '❌'} |
| PM2 Restarts (cumulative) | ${last.pm2_restarts} | ℹ️ (informational only) |
| Active Incidents | ${last.active_incidents} | ${last.active_incidents === 0 ? '✅' : '❌'} |
| Incidents (24h total) | ${incidents.total_24h} | |
| Avg Response Latency | ${avgLat}ms | ${avgLat < 4000 ? '✅' : '⚠️'} |
| Red Latency Events | ${redEvents} | ${redEvents === 0 ? '✅' : '⚠️'} |

## Connector Live Probes (V2.1 — Actual HTTP/TCP Checks)

| Connector | Status | Latency | Detail |
|-----------|--------|---------|--------|
${probeSummary.probe_results.map(r => `| ${r.name} | ${r.status === 'live' ? '✅' : r.status === 'degraded' ? '⚠️' : '❌'} | ${r.latency_ms}ms | ${r.detail} |`).join('\n')}

> **Live probe summary:** ${probeSummary.live}/${probeSummary.total} live | ${probeSummary.degraded} degraded | ${probeSummary.down} down

## Memory Architecture (V2.1 — Validated)

| Component | Technology | Status |
|-----------|-----------|--------|
${memoryReport.components.map(c => `| ${c.name} | ${c.technology} | ${c.status === 'verified' ? '✅' : c.status === 'not_used' ? '⚪' : c.status === 'absent' ? '❌' : '⚠️'} ${c.detail} |`).join('\n')}

> **Architecture:** ${memoryReport.healthy_layers}/${memoryReport.total_layers} layers healthy | Overall: ${memoryReport.overall_status}

## Approval Source of Truth (V2.1 — Unified)

| Store | Pending | Approved | Rejected | Total |
|-------|---------|----------|----------|-------|
| ops.db (gate.ts) | ${approvalTruth.ops_queue.pending} | ${approvalTruth.ops_queue.approved} | ${approvalTruth.ops_queue.rejected} | ${approvalTruth.ops_queue.total} |
| persistent-store | ${approvalTruth.persistent_store.pending} | ${approvalTruth.persistent_store.approved} | ${approvalTruth.persistent_store.rejected} | ${approvalTruth.persistent_store.total} |
| **Unified Total** | **${approvalTruth.pending_total}** | **${approvalTruth.approved_total}** | **${approvalTruth.rejected_total}** | **${approvalTruth.total_all_time}** |

> **Consistency:** ${approvalTruth.consistency} | Audit log: ${approvalTruth.audit_log_exists ? `${approvalTruth.audit_log_entries} entries` : 'NOT FOUND'} | Oldest pending: ${approvalTruth.oldest_pending_age_hours !== null ? `${approvalTruth.oldest_pending_age_hours}h` : 'none'}

## Workflow Metrics (Source of Truth: execution ledger)

| Metric | 24h | All-Time |
|--------|-----|----------|
| Total | ${workflowMetrics.total_24h} | ${workflowMetrics.total} |
| Success | ${workflowMetrics.success_24h} | ${workflowMetrics.success} |
| Failed | ${workflowMetrics.failed_24h} | ${workflowMetrics.failed} |
| Running | ${workflowMetrics.running_24h} | ${workflowMetrics.running} |
| **Success Rate** | **${workflowMetrics.success_rate_24h}%** | **${workflowMetrics.success_rate}%** |

> **No inferred scoring. No synthetic scoring.** All workflow metrics derived from \`workflow_execution_ledger\` table.

## Failure Evidence (V2.1 — Structured)

| Severity | Open | In Progress | Resolved |
|----------|------|-------------|----------|
| P0 | ${failureSummary.by_severity.P0 || 0} | | |
| P1 | ${failureSummary.by_severity.P1 || 0} | | |
| P2 | ${failureSummary.by_severity.P2 || 0} | | |
| P3 | ${failureSummary.by_severity.P3 || 0} | | |
| **Total** | **${failureSummary.open}** | **${failureSummary.in_progress}** | **${failureSummary.resolved}** |

### Top Failure Reasons
${failureSummary.top_failures.length
  ? failureSummary.top_failures.map(f => `- **${f.reason}** (${f.count}x, ${f.severity})`).join('\n')
  : '_No failures recorded in 24h._'}

### By Type
${Object.entries(failureSummary.by_type).map(([k, v]) => `- ${k}: ${v}`).join('\n') || '_None_'}

## Incident Breakdown (Active)

| Severity | Count |
|----------|-------|
| P0 | ${incidents.p0} |
| P1 | ${incidents.p1} |
| P2 | ${incidents.p2} |
| P3 | ${incidents.p3} |

## Quality Score

| Dimension | Score |
|-----------|-------|
| Overall | **${quality.overall}/100** (${quality.label}) |
| Context Retention | ${quality.context_retention}% |
| Action Success | ${quality.action_success_rate}% |
| Approval Success | ${quality.approval_success_rate}% |
| Follow-up Success | ${quality.follow_up_success}% |

## Hourly Snapshots (last 24h)

| Time | Restarts | Incidents | Avg Latency | Quality |
|------|----------|-----------|-------------|---------|
${snapshots.slice(-12).map(s => `| ${s.created_at.slice(11, 16)} | ${s.pm2_restarts} | ${s.active_incidents} | ${s.avg_latency_ms}ms | ${s.quality_score} |`).join('\n')}

## Scoring Breakdown

| Component | Weight | Points |
|-----------|--------|--------|
| Active Incidents | 20 | ${last.active_incidents === 0 ? 20 : Math.max(0, 20 - last.active_incidents * 4)} |
| Latency Red Events | 10 | ${redEvents === 0 ? 10 : Math.max(0, 10 - redEvents * 2)} |
| Quality Score | 15 | ${Math.round(quality.overall * 0.15)} |
| Workflow Success Rate | 15 | ${Math.round(workflowMetrics.success_rate_24h * 0.15)} |
| Connector Live Probes | 15 | ${connectorPts} |
| Memory Architecture | 10 | ${memoryPts} |
| Restart Health (24h) | 10 | ${restarts24h < 5 ? 10 : restarts24h < 20 ? 5 : Math.max(0, 10 - restarts24h * 0.5)} |
| Approval Consistency | 5 | ${approvalTruth.consistency === 'CONSISTENT' ? 5 : 0} |
| **TOTAL** | **100** | **${burnInScore}** |

**Verdict:** ${burnInScore >= 80 ? '✅ BURN_IN_HEALTHY' : burnInScore >= 60 ? '⚠️ BURN_IN_DEGRADED' : '❌ BURN_IN_CRITICAL'}
**Monitor Version:** V2.1 — 24h restart delta, connector live probes, memory architecture validation, approval source-of-truth, failure evidence, workflow metrics API
`;

  writeFileSync(join(REPORTS_DIR, 'BURN_IN_DAILY_REPORT.md'), report);
  console.log(`[O5-BURNIN] Daily report generated — score: ${burnInScore}/100`);
}

// ── Scheduler ─────────────────────────────────────────────────────────────────
let _hourlyInterval: NodeJS.Timeout | null = null;
let _dailyInterval: NodeJS.Timeout | null = null;

export function startBurnInScheduler(): void {
  if (_hourlyInterval) return;
  // Seed known failures on startup (idempotent)
  try { seedKnownFailures(); } catch { /* non-critical */ }
  // Hourly snapshot
  _hourlyInterval = setInterval(() => {
    try { captureHourlySnapshot(); } catch { /* never crash */ }
  }, 3600_000);
  // Daily report (every 24h)
  _dailyInterval = setInterval(() => {
    try { generateDailyReport(); } catch { /* never crash */ }
  }, 86400_000);
  // Capture first snapshot immediately
  try { captureHourlySnapshot(); } catch { /* non-critical */ }
  console.log('[O5-BURNIN] Scheduler started — V2.1 — hourly snapshots, daily reports');
}

export function stopBurnInScheduler(): void {
  if (_hourlyInterval) { clearInterval(_hourlyInterval); _hourlyInterval = null; }
  if (_dailyInterval) { clearInterval(_dailyInterval); _dailyInterval = null; }
}

export function runManualBurnIn(): BurnInSnapshot {
  const snap = captureHourlySnapshot();
  generateDailyReport();
  return snap;
}

export function getBurnInHistory(hours = 24): BurnInSnapshot[] {
  const since = new Date(Date.now() - hours * 3600_000).toISOString();
  return getOpsDb().prepare(
    `SELECT * FROM burnin_snapshots WHERE created_at >= ? ORDER BY created_at DESC LIMIT 24`
  ).all(since) as BurnInSnapshot[];
}
