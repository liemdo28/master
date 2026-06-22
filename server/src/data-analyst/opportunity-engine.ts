/**
 * OpportunityEngine — TypeScript port of OpportunityEngine.mjs
 */

import { ColumnMapping } from './column-mapper';
import {
  revenueByDay, revenueByHour, revenueByWeekday,
  itemPerformance, weekOverWeekTrend,
} from './sales-analytics-engine';

export interface Opportunity {
  type: string;
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  data?: unknown;
}

export function generateOpportunities(rows: Record<string, string>[], mapping: ColumnMapping): Opportunity[] {
  const opportunities: Opportunity[] = [];

  const byDay = revenueByDay(rows, mapping);
  const byHour = revenueByHour(rows, mapping);
  const byWeekday = revenueByWeekday(rows, mapping);
  const items = itemPerformance(rows, mapping);
  const weekTrend = weekOverWeekTrend(rows, mapping);

  // low_day — worst revenue day
  const dayEntries = Object.entries(byDay);
  if (dayEntries.length >= 7) {
    const sorted = [...dayEntries].sort(([, a], [, b]) => a - b);
    const worst = sorted.slice(0, 3);
    opportunities.push({
      type: 'low_day',
      title: `Ngày doanh thu thấp nhất: ${worst[0][0]}`,
      description: `3 ngày có doanh thu thấp nhất: ${worst.map(([d, v]) => `${d} ($${v.toFixed(0)})`).join(', ')}. Xem xét promotion vào những ngày này.`,
      impact: 'medium',
      data: worst,
    });
  }

  // peak_hour — best revenue hour
  const hourEntries = Object.entries(byHour);
  if (hourEntries.length >= 3) {
    const sorted = [...hourEntries].sort(([, a], [, b]) => b - a);
    const peak = sorted[0];
    opportunities.push({
      type: 'peak_hour',
      title: `Giờ cao điểm: ${peak[0]}:00`,
      description: `Giờ ${peak[0]}:00 có doanh thu cao nhất ($${Number(peak[1]).toFixed(0)}). Đảm bảo đủ nhân lực vào khung giờ này.`,
      impact: 'high',
      data: sorted.slice(0, 5),
    });
  }

  // weak_hour — lowest revenue hours
  if (hourEntries.length >= 5) {
    const sorted = [...hourEntries].sort(([, a], [, b]) => a - b);
    const weak = sorted.slice(0, 2);
    opportunities.push({
      type: 'weak_hour',
      title: `Giờ yếu nhất: ${weak[0][0]}:00`,
      description: `Giờ ${weak[0][0]}:00 có doanh thu thấp ($${Number(weak[0][1]).toFixed(0)}). Cân nhắc happy hour hoặc giảm giờ mở cửa.`,
      impact: 'low',
      data: weak,
    });
  }

  // top_items_promote — top 5 items
  if (items.length >= 3) {
    const top = items.slice(0, 5);
    opportunities.push({
      type: 'top_items_promote',
      title: `Top ${top.length} món bán chạy nhất`,
      description: `${top.map(i => `${i.item} ($${i.revenue.toFixed(0)})`).join(', ')}. Đặt featured/spotlight để tăng visibility.`,
      impact: 'high',
      data: top,
    });
  }

  // slow_items_review — bottom items
  if (items.length >= 10) {
    const slow = items.slice(-5);
    opportunities.push({
      type: 'slow_items_review',
      title: `${slow.length} món bán chậm cần xem xét`,
      description: `${slow.map(i => i.item).join(', ')} có doanh thu thấp nhất. Cân nhắc điều chỉnh giá, recipe, hoặc remove khỏi menu.`,
      impact: 'medium',
      data: slow,
    });
  }

  // weekday_gap — best vs worst weekday
  const weekdayEntries = Object.entries(byWeekday);
  if (weekdayEntries.length >= 5) {
    const sorted = [...weekdayEntries].sort(([, a], [, b]) => b - a);
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];
    const gap = ((Number(best[1]) - Number(worst[1])) / Number(best[1]) * 100).toFixed(0);
    opportunities.push({
      type: 'weekday_gap',
      title: `${best[0]} vs ${worst[0]}: chênh lệch ${gap}%`,
      description: `${best[0]} ($${Number(best[1]).toFixed(0)}) tốt hơn ${worst[0]} ($${Number(worst[1]).toFixed(0)}) tới ${gap}%. Chiến lược đặc biệt cho ${worst[0]}?`,
      impact: 'medium',
      data: sorted,
    });
  }

  // declining_trend / growing_trend
  if (weekTrend.length >= 3) {
    const recent = weekTrend.slice(-4);
    const declining = recent.filter(w => w.change_pct !== null && w.change_pct < -5);
    const growing = recent.filter(w => w.change_pct !== null && w.change_pct > 5);
    if (declining.length >= 2) {
      opportunities.push({
        type: 'declining_trend',
        title: `Xu hướng giảm ${declining.length} tuần liên tiếp`,
        description: `Doanh thu đang giảm: ${declining.map(w => `${w.week} (${w.change_pct}%)`).join(', ')}. Cần hành động khẩn.`,
        impact: 'high',
        data: declining,
      });
    }
    if (growing.length >= 2) {
      opportunities.push({
        type: 'growing_trend',
        title: `Xu hướng tăng trưởng ${growing.length} tuần`,
        description: `Doanh thu tăng: ${growing.map(w => `${w.week} (+${w.change_pct}%)`).join(', ')}. Duy trì đà!`,
        impact: 'high',
        data: growing,
      });
    }
  }

  return opportunities;
}

export function generateReportText(
  opportunities: Opportunity[],
  stats: { total_revenue: number; total_transactions: number; avg_daily_revenue: number; date_range: { start: string; end: string } | null; unique_items: number },
  datasetName: string,
): string {
  const lines: string[] = [
    `# Báo Cáo Phân Tích: ${datasetName}`,
    ``,
    `## Tổng Quan`,
    `- **Tổng doanh thu:** $${stats.total_revenue.toFixed(2)}`,
    `- **Tổng giao dịch:** ${stats.total_transactions.toLocaleString()}`,
    `- **Doanh thu trung bình/ngày:** $${stats.avg_daily_revenue.toFixed(2)}`,
    stats.date_range ? `- **Khoảng thời gian:** ${stats.date_range.start} → ${stats.date_range.end}` : '',
    `- **Số món:** ${stats.unique_items}`,
    ``,
    `## Cơ Hội Phát Triển (${opportunities.length} phát hiện)`,
    ``,
  ];

  for (const opp of opportunities) {
    const impactIcon = opp.impact === 'high' ? '🔴' : opp.impact === 'medium' ? '🟡' : '🟢';
    lines.push(`### ${impactIcon} ${opp.title}`);
    lines.push(opp.description);
    lines.push('');
  }

  const high = opportunities.filter(o => o.impact === 'high').length;
  const medium = opportunities.filter(o => o.impact === 'medium').length;
  lines.push(`---`);
  lines.push(`*${high} phát hiện mức độ cao, ${medium} mức độ trung bình. Generated by Mi Data Analyst.*`);

  return lines.filter(l => l !== null).join('\n');
}
