/**
 * Strategic Memory Engine — Phase 18
 * Extends Phase 15 operational memory to months/years.
 * Answers: "Tháng trước team làm gì?", "Quý nào fail nhiều nhất?", "Dev1 xử lý gì 6 tháng qua?"
 *
 * Uses same memory.db from Phase 15 — adds aggregation layer on top.
 * No new schema needed: queries period_summaries + incidents + owner_actions with time windows.
 */

import path from 'path';

const GLOBAL_DIR = path.join(
  process.env.MI_CORE_ROOT || 'E:/Project/Master/mi-core',
  '.local-agent-global'
);
const MEM_DB = path.join(GLOBAL_DIR, 'operational-memory/memory.db');

function getDb() {
  const Database = require('better-sqlite3');
  return new Database(MEM_DB, { readonly: true });
}

function isoAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MonthlySnapshot {
  month: string;         // "2026-05"
  total_executions: number;
  success_rate: number;
  total_incidents: number;
  top_project: string;
  top_role: string;
  trend: 'IMPROVING' | 'STABLE' | 'DEGRADING';
}

export interface OwnerHistory {
  owner_role: string;
  period_days: number;
  total_actions: number;
  pass_rate: number;
  top_actions: Array<{ action_type: string; count: number }>;
  top_projects: Array<{ target: string; count: number }>;
  busiest_period: string;
}

export interface ProjectBlockerHistory {
  target: string;
  total_incidents: number;
  open_incidents: number;
  recur_count_total: number;
  last_incident: string;
  risk_score: number;     // incidents * 10 + recur_count * 5
}

export interface StrategicSummary {
  period_label: string;
  period_days: number;
  generated_at: string;
  total_executions: number;
  overall_success_rate: number;
  top_blocker_project: string;
  top_performer_role: string;
  monthly_snapshots: MonthlySnapshot[];
  trend_direction: 'IMPROVING' | 'STABLE' | 'DEGRADING';
}

// ── Monthly aggregation ───────────────────────────────────────────────────────

export function getMonthlySnapshots(months: number = 6): MonthlySnapshot[] {
  try {
    const db = getDb();
    const snapshots: MonthlySnapshot[] = [];

    for (let m = months - 1; m >= 0; m--) {
      const d = new Date();
      d.setMonth(d.getMonth() - m);
      const monthKey = d.toISOString().slice(0, 7);   // "2026-05"
      const start = `${monthKey}-01T00:00:00.000Z`;
      const endDate = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      const end = endDate.toISOString();

      const execs = db.prepare(
        `SELECT COUNT(*) as total, SUM(CASE WHEN verdict='PASS' THEN 1 ELSE 0 END) as passed
         FROM owner_actions WHERE ts >= ? AND ts < ?`
      ).get(start, end) as any;

      const incs = db.prepare(
        `SELECT COUNT(*) as c FROM incidents WHERE ts >= ? AND ts < ?`
      ).get(start, end) as any;

      const topProj = db.prepare(
        `SELECT target, COUNT(*) as c FROM owner_actions WHERE ts >= ? AND ts < ?
         GROUP BY target ORDER BY c DESC LIMIT 1`
      ).get(start, end) as any;

      const topRole = db.prepare(
        `SELECT agent_role, COUNT(*) as c FROM owner_actions WHERE ts >= ? AND ts < ?
         GROUP BY agent_role ORDER BY c DESC LIMIT 1`
      ).get(start, end) as any;

      const total = execs?.total || 0;
      const passed = execs?.passed || 0;
      const rate = total > 0 ? Math.round((passed / total) * 100) : 0;

      // Trend vs previous month
      let trend: MonthlySnapshot['trend'] = 'STABLE';
      if (snapshots.length > 0) {
        const prev = snapshots[snapshots.length - 1].success_rate;
        if (rate - prev >= 10) trend = 'IMPROVING';
        else if (rate - prev <= -10) trend = 'DEGRADING';
      }

      snapshots.push({
        month: monthKey,
        total_executions: total,
        success_rate: rate,
        total_incidents: incs?.c || 0,
        top_project: topProj?.target || 'N/A',
        top_role: topRole?.agent_role || 'N/A',
        trend,
      });
    }

    db.close();
    return snapshots;
  } catch { return []; }
}

// ── Owner history ─────────────────────────────────────────────────────────────

export function getOwnerHistory(roleOrAlias: string, days: number = 180): OwnerHistory {
  const ROLE_MAP: Record<string, string[]> = {
    dev1: ['developer', 'engineering_manager'],
    developer: ['developer', 'engineering_manager'],
    qa: ['qa_agent', 'qa'],
    pm: ['product_manager'],
    release: ['release_agent'],
    auditor: ['auditor_agent'],
  };

  const roles = ROLE_MAP[roleOrAlias.toLowerCase()] || [roleOrAlias];
  const placeholders = roles.map(() => '?').join(',');
  const since = isoAgo(days);

  try {
    const db = getDb();

    const stats = db.prepare(
      `SELECT COUNT(*) as total, SUM(CASE WHEN verdict='PASS' THEN 1 ELSE 0 END) as passed
       FROM owner_actions WHERE agent_role IN (${placeholders}) AND ts >= ?`
    ).get(...roles, since) as any;

    const topActions = db.prepare(
      `SELECT action_type, COUNT(*) as count FROM owner_actions
       WHERE agent_role IN (${placeholders}) AND ts >= ?
       GROUP BY action_type ORDER BY count DESC LIMIT 5`
    ).all(...roles, since) as any[];

    const topProjects = db.prepare(
      `SELECT target, COUNT(*) as count FROM owner_actions
       WHERE agent_role IN (${placeholders}) AND ts >= ?
       GROUP BY target ORDER BY count DESC LIMIT 5`
    ).all(...roles, since) as any[];

    // Find busiest month
    const busiest = db.prepare(
      `SELECT strftime('%Y-%m', ts) as month, COUNT(*) as c FROM owner_actions
       WHERE agent_role IN (${placeholders}) AND ts >= ?
       GROUP BY month ORDER BY c DESC LIMIT 1`
    ).get(...roles, since) as any;

    const total = stats?.total || 0;
    const passed = stats?.passed || 0;

    db.close();
    return {
      owner_role: roleOrAlias,
      period_days: days,
      total_actions: total,
      pass_rate: total > 0 ? Math.round((passed / total) * 100) : 0,
      top_actions: topActions.map(r => ({ action_type: r.action_type, count: r.count })),
      top_projects: topProjects.map(r => ({ target: r.target, count: r.count })),
      busiest_period: busiest?.month || 'N/A',
    };
  } catch {
    return { owner_role: roleOrAlias, period_days: days, total_actions: 0, pass_rate: 0, top_actions: [], top_projects: [], busiest_period: 'N/A' };
  }
}

// ── Project blocker history ───────────────────────────────────────────────────

export function getTopBlockerProjects(days: number = 90, topN: number = 5): ProjectBlockerHistory[] {
  const since = isoAgo(days);
  try {
    const db = getDb();
    const rows = db.prepare(
      `SELECT target,
              COUNT(*) as total_incidents,
              SUM(CASE WHEN resolved=0 THEN 1 ELSE 0 END) as open_incidents,
              SUM(recur_count) as recur_total,
              MAX(ts) as last_incident
       FROM incidents WHERE ts >= ?
       GROUP BY target ORDER BY total_incidents DESC LIMIT ?`
    ).all(since, topN) as any[];
    db.close();
    return rows.map(r => ({
      target: r.target,
      total_incidents: r.total_incidents,
      open_incidents: r.open_incidents,
      recur_count_total: r.recur_total || 0,
      last_incident: r.last_incident,
      risk_score: r.total_incidents * 10 + (r.recur_total || 0) * 5,
    }));
  } catch { return []; }
}

// ── Strategic summary ─────────────────────────────────────────────────────────

export function getStrategicSummary(days: number = 90): StrategicSummary {
  const since = isoAgo(days);
  const label = days <= 30 ? 'Tháng này' : days <= 90 ? 'Quý này' : `${Math.round(days / 30)} tháng gần đây`;

  try {
    const db = getDb();
    const totals = db.prepare(
      `SELECT COUNT(*) as total, SUM(CASE WHEN verdict='PASS' THEN 1 ELSE 0 END) as passed
       FROM owner_actions WHERE ts >= ?`
    ).get(since) as any;

    const topProject = db.prepare(
      `SELECT target, COUNT(*) as c FROM incidents WHERE ts >= ? GROUP BY target ORDER BY c DESC LIMIT 1`
    ).get(since) as any;

    const topRole = db.prepare(
      `SELECT agent_role, SUM(CASE WHEN verdict='PASS' THEN 1 ELSE 0 END) as p, COUNT(*) as t
       FROM owner_actions WHERE ts >= ? GROUP BY agent_role
       HAVING t > 0 ORDER BY CAST(p AS FLOAT)/t DESC LIMIT 1`
    ).get(since) as any;

    db.close();

    const total = totals?.total || 0;
    const passed = totals?.passed || 0;
    const rate = total > 0 ? Math.round((passed / total) * 100) : 0;

    const monthly = getMonthlySnapshots(Math.ceil(days / 30));
    const firstRate = monthly[0]?.success_rate ?? rate;
    const lastRate = monthly[monthly.length - 1]?.success_rate ?? rate;
    const trend: StrategicSummary['trend_direction'] =
      lastRate - firstRate >= 10 ? 'IMPROVING' : lastRate - firstRate <= -10 ? 'DEGRADING' : 'STABLE';

    return {
      period_label: label,
      period_days: days,
      generated_at: new Date().toISOString(),
      total_executions: total,
      overall_success_rate: rate,
      top_blocker_project: topProject?.target || 'N/A',
      top_performer_role: topRole?.agent_role || 'N/A',
      monthly_snapshots: monthly,
      trend_direction: trend,
    };
  } catch {
    return {
      period_label: label, period_days: days, generated_at: new Date().toISOString(),
      total_executions: 0, overall_success_rate: 0,
      top_blocker_project: 'N/A', top_performer_role: 'N/A',
      monthly_snapshots: [], trend_direction: 'STABLE',
    };
  }
}
