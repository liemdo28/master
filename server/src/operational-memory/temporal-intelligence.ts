/**
 * Temporal Intelligence Runtime — Phase 15.5
 * Answers questions about last week / last month / last quarter.
 * Trend analysis: improving, stable, or degrading?
 */

import { getDb } from './operational-memory-db';

export type TimePeriod = 'week' | 'month' | 'quarter';

export interface PeriodStats {
  period: TimePeriod;
  period_start: string;
  period_end: string;
  target_project: string;
  total_execs: number;
  pass_count: number;
  fail_count: number;
  incident_count: number;
  success_rate: number;
  avg_duration_ms: number;
}

export interface TrendResult {
  target_project: string;
  week_stats: PeriodStats | null;
  month_stats: PeriodStats | null;
  quarter_stats: PeriodStats | null;
  trend: 'IMPROVING' | 'STABLE' | 'DEGRADING' | 'INSUFFICIENT_DATA';
  trend_notes: string;
}

export interface BlockerReport {
  target_project: string;
  blocker_count: number;
  period: TimePeriod;
  last_blocker: string | null;
}

function rowToStats(row: any, period: TimePeriod): PeriodStats {
  return {
    period,
    period_start: row.period_start,
    period_end: row.period_end,
    target_project: row.target_project,
    total_execs: row.total_execs,
    pass_count: row.pass_count,
    fail_count: row.fail_count,
    incident_count: row.incident_count,
    success_rate: row.total_execs ? Math.round((row.pass_count / row.total_execs) * 100) : 0,
    avg_duration_ms: Math.round(row.avg_duration_ms || 0),
  };
}

// ── Public API ──────────────────────────────────────────────────────────────

/** Stats for a period across all projects */
export function getPeriodStats(period: TimePeriod): PeriodStats[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT * FROM period_summaries WHERE period = ? ORDER BY fail_count DESC, total_execs DESC
  `).all(period) as any[];
  return rows.map(r => rowToStats(r, period));
}

/** Stats for a specific project across a period */
export function getProjectPeriodStats(targetProject: string, period: TimePeriod): PeriodStats | null {
  const db = getDb();
  const norm = targetProject.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  const row = db.prepare(`
    SELECT * FROM period_summaries
    WHERE period = ? AND lower(target_project) LIKE ?
  `).get(period, `%${norm}%`) as any;
  return row ? rowToStats(row, period) : null;
}

/** Trend analysis for a project — compares week vs month vs quarter */
export function getTrend(targetProject: string): TrendResult {
  const week = getProjectPeriodStats(targetProject, 'week');
  const month = getProjectPeriodStats(targetProject, 'month');
  const quarter = getProjectPeriodStats(targetProject, 'quarter');

  let trend: TrendResult['trend'] = 'INSUFFICIENT_DATA';
  let notes = '';

  if (week && month) {
    const weekRate = week.success_rate;
    const monthRate = month.success_rate;

    if (weekRate >= monthRate + 10) {
      trend = 'IMPROVING';
      notes = `Tuần này success rate ${weekRate}% cao hơn tháng trước ${monthRate}% (+${weekRate - monthRate}%).`;
    } else if (weekRate <= monthRate - 10) {
      trend = 'DEGRADING';
      notes = `Tuần này success rate ${weekRate}% thấp hơn tháng trước ${monthRate}% (${weekRate - monthRate}%).`;
    } else {
      trend = 'STABLE';
      notes = `Success rate ổn định — tuần ${weekRate}%, tháng ${monthRate}%.`;
    }

    if (week.incident_count > month.incident_count * 0.5) {
      notes += ` ⚠️ Tỷ lệ incident tuần này cao bất thường.`;
    }
  } else if (month) {
    trend = 'STABLE';
    notes = `Chỉ có dữ liệu tháng — ${month.total_execs} lần thực thi, success rate ${month.success_rate}%.`;
  }

  return { target_project: targetProject, week_stats: week, month_stats: month, quarter_stats: quarter, trend, trend_notes: notes };
}

/** Which projects had the most blockers (failures) in a time period */
export function getTopBlockerProjects(period: TimePeriod, topN = 10): BlockerReport[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT target_project, fail_count + incident_count as blocker_count, period_end as last_blocker, period
    FROM period_summaries
    WHERE period = ?
    ORDER BY blocker_count DESC
    LIMIT ?
  `).all(period, topN) as any[];

  return rows.map(r => ({
    target_project: r.target_project,
    blocker_count: r.blocker_count,
    period: r.period as TimePeriod,
    last_blocker: r.last_blocker,
  }));
}

/** Compute blockers from raw executions (fallback if period_summaries is sparse) */
export function getTopBlockerProjectsRaw(days = 90, topN = 10): BlockerReport[] {
  const db = getDb();
  const cutoff = new Date(Date.now() - days * 86400_000).toISOString();
  const period: TimePeriod = days <= 7 ? 'week' : days <= 30 ? 'month' : 'quarter';

  // Count FAILs from executions + incidents combined
  const execFails = db.prepare(`
    SELECT target_project, COUNT(*) as c, MAX(created_at) as last
    FROM executions
    WHERE final_verdict = 'FAIL' AND created_at >= ? AND target_project IS NOT NULL
    GROUP BY target_project
  `).all(cutoff) as any[];

  const incFails = db.prepare(`
    SELECT target, COUNT(*) as c
    FROM incidents
    WHERE ts >= ?
    GROUP BY target
  `).all(cutoff) as any[];

  // Merge by project
  const combined: Record<string, { count: number; last: string }> = {};
  for (const r of execFails) {
    combined[r.target_project] = { count: r.c, last: r.last };
  }
  for (const r of incFails) {
    if (combined[r.target]) {
      combined[r.target].count += r.c;
    } else {
      combined[r.target] = { count: r.c, last: cutoff };
    }
  }

  return Object.entries(combined)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, topN)
    .map(([proj, v]) => ({
      target_project: proj,
      blocker_count: v.count,
      period,
      last_blocker: v.last,
    }));
}

/** System-wide health snapshot across all periods */
export function getSystemHealthSnapshot(): {
  week: { total_execs: number; success_rate: number; incident_count: number };
  month: { total_execs: number; success_rate: number; incident_count: number };
  quarter: { total_execs: number; success_rate: number; incident_count: number };
} {
  const db = getDb();

  function periodAgg(period: string) {
    const r = db.prepare(`
      SELECT SUM(total_execs) as t, SUM(pass_count) as p, SUM(incident_count) as i
      FROM period_summaries WHERE period = ?
    `).get(period) as any;
    const t = r?.t || 0;
    return { total_execs: t, success_rate: t ? Math.round((r.p / t) * 100) : 0, incident_count: r?.i || 0 };
  }

  return { week: periodAgg('week'), month: periodAgg('month'), quarter: periodAgg('quarter') };
}
