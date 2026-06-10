/**
 * DataAnalystEngine — main entry point for Mi data analysis.
 *
 * Usage:
 *   const engine = new DataAnalystEngine();
 *   const result = await engine.analyze(filePath);
 *   const report = engine.report();
 */

import { ingestFile } from './FileDataIngestionService.mjs';
import {
  revenueByDay, revenueByHour, revenueByWeekday,
  itemPerformance, revenueByCategory, paymentBreakdown,
  weekOverWeekTrend, summaryStats,
} from './SalesAnalyticsEngine.mjs';
import { generateOpportunities, generateReportText } from './OpportunityEngine.mjs';
import { saveAnalysisReport, getLastAnalysis, getLatestDataset } from './DatasetCatalog.mjs';

export class DataAnalystEngine {
  constructor() {
    this.currentDataset = null;
    this.analytics = null;
  }

  /**
   * Load and analyze a file
   */
  async analyze(filePath, options = {}) {
    const ingest = await ingestFile(filePath, options);

    if (!ingest.success) {
      return { success: false, error: ingest.error, status: ingest.status };
    }

    if (ingest.quality.quality_score < 40) {
      return {
        success: false,
        error: `Data quality too low (score: ${ingest.quality.quality_score}/100)`,
        quality: ingest.quality,
        suggestion: 'Check column mapping — key fields (date, sales) may not be detected correctly.',
      };
    }

    this.currentDataset = ingest;
    const { rows, mapping } = ingest;

    // Run all analytics
    const analytics = {
      summary: summaryStats(rows, mapping),
      byDay: revenueByDay(rows, mapping),
      byHour: revenueByHour(rows, mapping),
      byWeekday: revenueByWeekday(rows, mapping),
      items: itemPerformance(rows, mapping),
      categories: revenueByCategory(rows, mapping),
      payments: paymentBreakdown(rows, mapping),
      wow: weekOverWeekTrend(rows, mapping),
    };

    analytics.opportunities = generateOpportunities(analytics, {
      store: ingest.store,
      source: ingest.file,
      confidence: ingest.confidence,
    });

    this.analytics = analytics;

    // Save to catalog
    saveAnalysisReport(ingest.dataset_id, analytics);

    return {
      success: true,
      dataset_id: ingest.dataset_id,
      file: ingest.file,
      row_count: ingest.row_count,
      confidence: ingest.confidence,
      quality_score: ingest.quality.quality_score,
      mapping: ingest.mapping,
      unmapped: ingest.unmapped,
      analytics,
    };
  }

  /**
   * Answer a natural-language question about the loaded data.
   * Returns structured answer object with value, explanation, chart_data.
   */
  answerQuestion(question) {
    if (!this.analytics) {
      return { answer: 'Chưa có dữ liệu. Vui lòng upload file doanh thu trước.' };
    }

    const q = question.toLowerCase();
    const a = this.analytics;

    // "ngày nào doanh thu cao nhất"
    if (/ngày.*cao nhất|best.*day|highest.*day|top.*day/i.test(q)) {
      const top = a.byDay.top_day;
      if (!top) return { answer: 'Không tìm thấy dữ liệu theo ngày.' };
      return {
        answer: `Ngày doanh thu cao nhất: **${top.date} (${top.weekday})** — $${top.total}`,
        value: top.total,
        date: top.date,
        chart_type: 'bar',
        chart_data: a.byDay.data,
      };
    }

    // "giờ nào bán tốt nhất"
    if (/giờ.*bán tốt|peak.*hour|best.*hour|giờ cao điểm/i.test(q)) {
      const peak = a.byHour.peak_hour;
      if (!peak) return { answer: 'Không có dữ liệu giờ bán.' };
      return {
        answer: `Giờ bán tốt nhất: **${peak.label}** — $${peak.total} (${peak.transactions} giao dịch)`,
        value: peak.total,
        hour: peak.hour,
        chart_type: 'bar',
        chart_data: a.byHour.data,
      };
    }

    // "món nào bán chạy nhất"
    if (/món.*chạy nhất|bán chạy|top.*item|best.*sell|top sell/i.test(q)) {
      const top = a.items.top?.slice(0, 5) || [];
      if (!top.length) return { answer: 'Không có dữ liệu sản phẩm.' };
      return {
        answer: `Top 5 món bán chạy:\n${top.map((i, n) => `${n + 1}. **${i.name}** — $${i.revenue} (${i.quantity} phần)`).join('\n')}`,
        items: top,
        chart_type: 'bar',
        chart_data: top,
      };
    }

    // "món nào bán chậm"
    if (/món.*chậm|slow.*sell|thấp nhất/i.test(q)) {
      const slow = a.items.slow?.slice(0, 5) || [];
      if (!slow.length) return { answer: 'Không có dữ liệu sản phẩm chậm.' };
      return {
        answer: `Món bán chậm:\n${slow.map((i, n) => `${n + 1}. ${i.name} — $${i.revenue}`).join('\n')}`,
        items: slow,
      };
    }

    // "store nào đang giảm"
    if (/store.*giảm|decline|giảm.*doanh/i.test(q)) {
      const trend = a.wow?.trend;
      if (trend === null || trend === undefined) return { answer: 'Không đủ dữ liệu so sánh tuần.' };
      const dir = trend < 0 ? `giảm ${Math.abs(trend)}%` : `tăng ${trend}%`;
      return {
        answer: `Doanh thu tuần này **${dir}** so với tuần trước.`,
        trend,
        chart_type: 'line',
        chart_data: a.wow.data,
      };
    }

    // "cơ hội tăng doanh thu"
    if (/cơ hội|opportunity|tăng.*doanh|nên làm/i.test(q)) {
      const opps = a.opportunities.opportunities || [];
      if (!opps.length) return { answer: 'Không tìm thấy cơ hội rõ ràng trong dữ liệu.' };
      return {
        answer: `Top cơ hội:\n${opps.slice(0, 3).map(o => `**[${o.priority.toUpperCase()}]** ${o.title}\n→ ${o.recommendation}`).join('\n\n')}`,
        opportunities: opps,
      };
    }

    // "tổng doanh thu / summary"
    if (/tổng|summary|tóm tắt|overview|báo cáo/i.test(q)) {
      const s = a.summary;
      return {
        answer: `📊 Tổng doanh thu: **$${s.total_revenue}** | ${s.date_range?.days || 0} ngày | ${s.unique_orders} đơn | TB/đơn $${s.avg_order_value}`,
        summary: s,
      };
    }

    // "weekday nào tốt nhất"
    if (/thứ.*tốt|weekday.*best|ngày trong tuần/i.test(q)) {
      const best = a.byWeekday.best_day;
      if (!best) return { answer: 'Không đủ dữ liệu ngày trong tuần.' };
      return {
        answer: `Ngày tốt nhất trong tuần: **${best.weekday}** — TB $${best.avg_per_day}/ngày`,
        best,
        chart_data: a.byWeekday.data,
      };
    }

    // Default: return summary
    const s = a.summary;
    return {
      answer: `Dữ liệu: **$${s.total_revenue}** tổng | ${s.total_rows} rows | ${s.date_range?.days || '?'} ngày | ${s.unique_items} items.\n\nHỏi gì cụ thể hơn: "ngày nào cao nhất?", "giờ nào tốt nhất?", "món nào bán chạy?"`,
      summary: s,
    };
  }

  /**
   * Generate full text report
   */
  report(options = {}) {
    if (!this.analytics || !this.currentDataset) return 'Chưa có dữ liệu phân tích.';
    return generateReportText(this.analytics, {
      store: this.currentDataset.store,
      source: this.currentDataset.file,
      confidence: this.currentDataset.confidence,
    });
  }

  /**
   * Get chart data for specific metric
   */
  chartData(type) {
    if (!this.analytics) return null;
    switch (type) {
      case 'revenue_by_day': return this.analytics.byDay?.data;
      case 'revenue_by_hour': return this.analytics.byHour?.data;
      case 'revenue_by_weekday': return this.analytics.byWeekday?.data;
      case 'top_items': return this.analytics.items?.top;
      case 'categories': return this.analytics.categories?.data;
      case 'payments': return this.analytics.payments?.data;
      case 'wow_trend': return this.analytics.wow?.data;
      default: return null;
    }
  }
}

/**
 * Quick analyze function (no class instantiation needed)
 */
export async function quickAnalyze(filePath, question = null) {
  const engine = new DataAnalystEngine();
  const result = await engine.analyze(filePath);
  if (!result.success) return result;

  const answer = question ? engine.answerQuestion(question) : null;
  const report = engine.report();

  return { ...result, answer, report };
}

/**
 * Load last analysis (no re-ingestion)
 */
export function loadLastAnalysis() {
  return getLastAnalysis();
}
