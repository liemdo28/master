/**
 * Temporal Trend Engine — Phase 18
 * Detects patterns over time: velocity, reliability, workload shifts.
 */

import { getMonthlySnapshots, getOwnerHistory, getTopBlockerProjects } from './strategic-memory-engine';

export interface TrendInsight {
  type: 'velocity' | 'reliability' | 'blocker' | 'owner_load';
  severity: 'info' | 'warn' | 'critical';
  message_vi: string;
  data: Record<string, unknown>;
}

export interface TemporalTrendReport {
  generated_at: string;
  period_months: number;
  insights: TrendInsight[];
  best_month: string;
  worst_month: string;
  overall_direction: 'IMPROVING' | 'STABLE' | 'DEGRADING';
}

export function analyzeTemporalTrends(months: number = 6): TemporalTrendReport {
  const snapshots = getMonthlySnapshots(months);
  const insights: TrendInsight[] = [];

  if (snapshots.length === 0) {
    return {
      generated_at: new Date().toISOString(),
      period_months: months,
      insights: [{ type: 'reliability', severity: 'info', message_vi: 'Chưa có đủ dữ liệu để phân tích xu hướng.', data: {} }],
      best_month: 'N/A', worst_month: 'N/A', overall_direction: 'STABLE',
    };
  }

  // Velocity: are we doing more or fewer executions?
  const first = snapshots[0];
  const last = snapshots[snapshots.length - 1];
  if (last.total_executions > first.total_executions * 1.3) {
    insights.push({ type: 'velocity', severity: 'info',
      message_vi: `Khối lượng công việc tăng ${Math.round((last.total_executions/Math.max(first.total_executions,1)-1)*100)}% so với ${first.month}`,
      data: { from: first.total_executions, to: last.total_executions } });
  } else if (last.total_executions < first.total_executions * 0.7 && first.total_executions > 0) {
    insights.push({ type: 'velocity', severity: 'warn',
      message_vi: `Khối lượng công việc giảm ${Math.round((1-last.total_executions/first.total_executions)*100)}% so với ${first.month}`,
      data: { from: first.total_executions, to: last.total_executions } });
  }

  // Reliability trend
  const rates = snapshots.map(s => s.success_rate).filter(r => r > 0);
  if (rates.length >= 2) {
    const avg = rates.reduce((a, b) => a + b, 0) / rates.length;
    const declining = snapshots.filter(s => s.trend === 'DEGRADING').length;
    if (declining >= 2) {
      insights.push({ type: 'reliability', severity: 'warn',
        message_vi: `Success rate giảm ${declining} tháng liên tiếp — cần xem lại quy trình`,
        data: { declining_months: declining, avg_rate: Math.round(avg) } });
    }
    if (avg < 70) {
      insights.push({ type: 'reliability', severity: 'critical',
        message_vi: `Success rate trung bình chỉ ${Math.round(avg)}% — dưới ngưỡng an toàn 70%`,
        data: { avg_rate: Math.round(avg) } });
    }
  }

  // Blocker pattern
  const blockers = getTopBlockerProjects(months * 30, 3);
  for (const b of blockers) {
    if (b.total_incidents >= 3) {
      insights.push({ type: 'blocker', severity: b.open_incidents > 0 ? 'warn' : 'info',
        message_vi: `${b.target}: ${b.total_incidents} incidents trong ${months} tháng (${b.open_incidents} còn mở)`,
        data: { target: b.target, total: b.total_incidents, open: b.open_incidents, risk_score: b.risk_score } });
    }
  }

  // Owner load
  const dev1 = getOwnerHistory('dev1', months * 30);
  if (dev1.total_actions > 0 && dev1.pass_rate < 60) {
    insights.push({ type: 'owner_load', severity: 'warn',
      message_vi: `Dev1 pass rate ${dev1.pass_rate}% trong ${months} tháng — có thể overloaded`,
      data: { actions: dev1.total_actions, pass_rate: dev1.pass_rate } });
  }

  const rated = snapshots.filter(s => s.success_rate > 0);
  const best = rated.reduce((a, b) => a.success_rate > b.success_rate ? a : b, rated[0] || snapshots[0]);
  const worst = rated.reduce((a, b) => a.success_rate < b.success_rate ? a : b, rated[0] || snapshots[0]);

  const improvingCount = snapshots.filter(s => s.trend === 'IMPROVING').length;
  const degradingCount = snapshots.filter(s => s.trend === 'DEGRADING').length;
  const overall: TemporalTrendReport['overall_direction'] =
    improvingCount > degradingCount ? 'IMPROVING' : degradingCount > improvingCount ? 'DEGRADING' : 'STABLE';

  return {
    generated_at: new Date().toISOString(),
    period_months: months,
    insights,
    best_month: best?.month || 'N/A',
    worst_month: worst?.month || 'N/A',
    overall_direction: overall,
  };
}
