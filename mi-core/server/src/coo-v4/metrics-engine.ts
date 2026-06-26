/**
 * B2 — Metrics Dashboard Engine
 * Aggregates burn-in data into daily dashboard snapshots.
 * Writes to .local-agent-global/coo-v4/metrics/
 */

import fs   from 'fs';
import path from 'path';
import {
  getAllDays, getBurnInSummary, getBurnInStartDate,
  getCurrentBurnInDay, BurnInDay, recordEvent,
} from './burn-in-tracker';
import { detectFlowGaps, runBurnInCheck } from './production-hardening';

const GLOBAL      = process.env.GLOBAL_DIR || 'D:/Project/Master/.local-agent-global';
const METRICS_DIR = path.join(GLOBAL, 'coo-v4', 'metrics');

export interface DailyMetricsSnapshot {
  date:          string;
  day:           number;
  generated_at:  string;
  // Rates
  success_rate:  number;
  failure_rate:  number;
  retry_rate:    number;
  avg_runtime_ms: number;
  // Counts
  total_actions: number;
  orphan_workflows: number;
  missing_evidence: number;
  // Flow
  flow_gaps:     number;
  flow_gap_detail: Array<{ type: string; severity: string; target: string }>;
  // Burn-in health
  burn_in_score: number;
  burn_in_status: string;
  // Domain breakdown
  domains: Record<string, { total: number; success: number; failure: number; rate: number }>;
  // Alerts
  alerts: string[];
}

export interface WeeklyMetricsSummary {
  week_start:    string;
  week_end:      string;
  days_recorded: number;
  days:          DailyMetricsSnapshot[];
  totals: {
    actions:       number;
    success:       number;
    failure:       number;
    retry:         number;
    orphans:       number;
    missing_ev:    number;
  };
  averages: {
    success_rate:  number;
    failure_rate:  number;
    retry_rate:    number;
    avg_ms:        number;
  };
  trend: 'improving' | 'stable' | 'degrading' | 'insufficient_data';
  alerts: string[];
}

// ══════════════════════════════════════════════════════════════════════════
// Daily snapshot
// ══════════════════════════════════════════════════════════════════════════

export function generateDailySnapshot(day?: number): DailyMetricsSnapshot {
  const targetDay = day ?? getCurrentBurnInDay();
  const dayData   = getAllDays().find(d => d.day === targetDay) ?? {
    day: targetDay, date: new Date().toISOString().slice(0,10),
    total: 0, success: 0, failure: 0, retry: 0, pending: 0,
    success_rate: 0, failure_rate: 0, retry_rate: 0, avg_ms: 0,
    orphans: 0, missing_ev: 0, by_domain: {} as any,
  };

  const gaps   = detectFlowGaps();
  const burnIn = runBurnInCheck();

  const alerts: string[] = [];
  if (dayData.failure_rate > 0.1) alerts.push(`HIGH FAILURE RATE: ${Math.round(dayData.failure_rate*100)}%`);
  if (dayData.retry_rate   > 0.2) alerts.push(`HIGH RETRY RATE: ${Math.round(dayData.retry_rate*100)}%`);
  if (dayData.orphans      > 0)   alerts.push(`${dayData.orphans} ORPHAN WORKFLOW(S) DETECTED`);
  if (gaps.filter(g => g.severity === 'high').length > 0) alerts.push(`${gaps.filter(g=>g.severity==='high').length} HIGH-SEVERITY FLOW GAPS`);
  if (burnIn.score < 80) alerts.push(`BURN-IN SCORE LOW: ${burnIn.score}/100`);

  const domains: Record<string, { total: number; success: number; failure: number; rate: number }> = {};
  const domainOrder = ['work_order','approval','gmail','drive','browser','website','finance'];
  for (const d of domainOrder) {
    const bd = (dayData.by_domain as any)[d] || { total: 0, success: 0, failure: 0 };
    domains[d] = {
      total:   bd.total,
      success: bd.success,
      failure: bd.failure,
      rate:    bd.total > 0 ? bd.success / bd.total : 0,
    };
  }

  return {
    date:            dayData.date,
    day:             targetDay,
    generated_at:    new Date().toISOString(),
    success_rate:    dayData.success_rate,
    failure_rate:    dayData.failure_rate,
    retry_rate:      dayData.retry_rate,
    avg_runtime_ms:  dayData.avg_ms,
    total_actions:   dayData.total,
    orphan_workflows: dayData.orphans,
    missing_evidence: gaps.filter(g => g.type === 'missing_evidence').length,
    flow_gaps:       gaps.length,
    flow_gap_detail: gaps.map(g => ({ type: g.type, severity: g.severity, target: g.target })),
    burn_in_score:   burnIn.score,
    burn_in_status:  burnIn.status,
    domains,
    alerts,
  };
}

// ══════════════════════════════════════════════════════════════════════════
// Weekly summary
// ══════════════════════════════════════════════════════════════════════════

export function generateWeeklySummary(): WeeklyMetricsSummary {
  const days      = getAllDays();
  const snapshots = days.map(d => generateDailySnapshot(d.day));

  const totals = {
    actions:    days.reduce((s,d) => s + d.total, 0),
    success:    days.reduce((s,d) => s + d.success, 0),
    failure:    days.reduce((s,d) => s + d.failure, 0),
    retry:      days.reduce((s,d) => s + d.retry, 0),
    orphans:    days.reduce((s,d) => s + d.orphans, 0),
    missing_ev: snapshots.reduce((s,s2) => s + s2.missing_evidence, 0),
  };

  const avgSuccessRate = days.length > 0
    ? days.reduce((s,d) => s + d.success_rate, 0) / days.length : 0;
  const avgFailRate    = days.length > 0
    ? days.reduce((s,d) => s + d.failure_rate, 0) / days.length : 0;
  const avgRetryRate   = days.length > 0
    ? days.reduce((s,d) => s + d.retry_rate, 0) / days.length : 0;
  const avgMs          = days.length > 0
    ? Math.round(days.reduce((s,d) => s + d.avg_ms, 0) / days.length) : 0;

  // Trend: compare last 2 days vs first 2 days success rate
  let trend: WeeklyMetricsSummary['trend'] = 'insufficient_data';
  if (days.length >= 4) {
    const early = days.slice(0,2).reduce((s,d) => s + d.success_rate, 0) / 2;
    const late  = days.slice(-2).reduce((s,d) => s + d.success_rate, 0) / 2;
    if      (late - early >  0.05) trend = 'improving';
    else if (early - late >  0.05) trend = 'degrading';
    else                           trend = 'stable';
  } else if (days.length >= 1) {
    trend = 'insufficient_data';
  }

  const allAlerts = [...new Set(snapshots.flatMap(s => s.alerts))];

  const startDate = getBurnInStartDate();
  const endDate   = new Date(new Date(startDate).getTime() + 6 * 86_400_000).toISOString().slice(0,10);

  return {
    week_start:    startDate.slice(0,10),
    week_end:      endDate,
    days_recorded: days.length,
    days:          snapshots,
    totals,
    averages: { success_rate: avgSuccessRate, failure_rate: avgFailRate, retry_rate: avgRetryRate, avg_ms: avgMs },
    trend,
    alerts: allAlerts,
  };
}

// ══════════════════════════════════════════════════════════════════════════
// Persist & format
// ══════════════════════════════════════════════════════════════════════════

export function persistDailySnapshot(snapshot: DailyMetricsSnapshot): string {
  if (!fs.existsSync(METRICS_DIR)) fs.mkdirSync(METRICS_DIR, { recursive: true });
  const file = path.join(METRICS_DIR, `day-${snapshot.day}.json`);
  fs.writeFileSync(file, JSON.stringify(snapshot, null, 2));
  return file;
}

export function formatDailyDashboard(s: DailyMetricsSnapshot): string {
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const bar = (v: number, w = 20) => '█'.repeat(Math.round(v * w)) + '░'.repeat(w - Math.round(v * w));

  const lines = [
    `📊 *Metrics Dashboard — Day ${s.day} / 7 (${s.date})*`,
    ``,
    `*Rates:*`,
    `✅ Success  ${bar(s.success_rate)} ${pct(s.success_rate)}`,
    `❌ Failure  ${bar(s.failure_rate)} ${pct(s.failure_rate)}`,
    `🔄 Retry    ${bar(s.retry_rate)}  ${pct(s.retry_rate)}`,
    ``,
    `*Counters:*`,
    `• Total actions:   ${s.total_actions}`,
    `• Avg runtime:     ${s.avg_runtime_ms}ms`,
    `• Orphan workflows: ${s.orphan_workflows}`,
    `• Missing evidence: ${s.missing_evidence}`,
    `• Flow gaps:        ${s.flow_gaps}`,
    `• Burn-in score:    ${s.burn_in_score}/100 (${s.burn_in_status})`,
    ``,
    `*Domain Breakdown:*`,
    ...Object.entries(s.domains).map(([d, v]) =>
      `  ${d.padEnd(12)} ${v.total.toString().padStart(3)} actions  ${pct(v.rate)} ok`
    ),
  ];

  if (s.alerts.length > 0) {
    lines.push('', `*⚠️ Alerts (${s.alerts.length}):*`);
    s.alerts.forEach(a => lines.push(`  • ${a}`));
  }

  return lines.join('\n');
}

export function formatWeeklyDashboard(w: WeeklyMetricsSummary): string {
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const trendIcon = { improving: '📈', stable: '➡️', degrading: '📉', insufficient_data: '📊' };

  const lines = [
    `📊 *7-Day Burn-In Summary — ${w.week_start} → ${w.week_end}*`,
    ``,
    `*Progress:* ${w.days_recorded}/7 days recorded`,
    `*Trend:*    ${trendIcon[w.trend]} ${w.trend.toUpperCase()}`,
    ``,
    `*Weekly Totals:*`,
    `• Total actions: ${w.totals.actions}`,
    `• Success:       ${w.totals.success}`,
    `• Failure:       ${w.totals.failure}`,
    `• Retry:         ${w.totals.retry}`,
    `• Orphans:       ${w.totals.orphans}`,
    ``,
    `*Weekly Averages:*`,
    `• Success rate:  ${pct(w.averages.success_rate)}`,
    `• Failure rate:  ${pct(w.averages.failure_rate)}`,
    `• Retry rate:    ${pct(w.averages.retry_rate)}`,
    `• Avg runtime:   ${w.averages.avg_ms}ms`,
  ];

  if (w.alerts.length > 0) {
    lines.push('', `*⚠️ Week Alerts (${w.alerts.length}):*`);
    w.alerts.slice(0, 5).forEach(a => lines.push(`  • ${a}`));
  }

  return lines.join('\n');
}
