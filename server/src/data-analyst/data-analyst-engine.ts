/**
 * DataAnalystEngine — TypeScript port of DataAnalystEngine.mjs
 * Fixes ESM/CJS incompatibility by using direct TS imports.
 */

import { mapColumns } from './column-mapper';
import { summaryStats, revenueByDay, revenueByHour, revenueByWeekday, itemPerformance, paymentBreakdown, weekOverWeekTrend } from './sales-analytics-engine';
import { generateOpportunities, generateReportText } from './opportunity-engine';
import { checkDataQuality } from './data-quality-checker';
import { ingestFile, getFileRows } from './file-ingestion-service';
import { getDataset, listDatasets, getLastAnalysis, saveAnalysisReport } from './dataset-catalog';

export interface AnalysisRequest {
  file_path?: string;
  dataset_id?: string;
  analysis_type: 'summary' | 'revenue_by_day' | 'revenue_by_hour' | 'revenue_by_weekday' | 'item_performance' | 'payment_breakdown' | 'week_over_week' | 'opportunities' | 'full_report' | 'quality';
  question?: string;
}

export interface AnalysisResponse {
  success: boolean;
  analysis_type?: string;
  result?: unknown;
  error?: string;
}

export class DataAnalystEngine {
  async ingest(filePath: string) {
    return ingestFile(filePath);
  }

  async analyze(req: AnalysisRequest): Promise<AnalysisResponse> {
    try {
      let rows: Record<string, string>[] = [];
      let datasetName = 'dataset';
      let mapping: Record<string, string> = {};

      if (req.file_path) {
        const ingestResult = await ingestFile(req.file_path);
        if (!ingestResult.success) return { success: false, error: ingestResult.error };
        rows = getFileRows(req.file_path);
        mapping = ingestResult.mapping || {};
        datasetName = ingestResult.file || 'dataset';
      } else if (req.dataset_id) {
        const dataset = getDataset(req.dataset_id);
        if (!dataset) return { success: false, error: `Dataset not found: ${req.dataset_id}` };
        rows = getFileRows(dataset.file_path);
        mapping = dataset.mapping;
        datasetName = dataset.name;
      } else {
        return { success: false, error: 'Provide file_path or dataset_id' };
      }

      if (rows.length === 0) return { success: false, error: 'No data rows found in file' };

      let result: unknown;
      switch (req.analysis_type) {
        case 'summary':         result = summaryStats(rows, mapping); break;
        case 'revenue_by_day':  result = revenueByDay(rows, mapping); break;
        case 'revenue_by_hour': result = revenueByHour(rows, mapping); break;
        case 'revenue_by_weekday': result = revenueByWeekday(rows, mapping); break;
        case 'item_performance': result = itemPerformance(rows, mapping); break;
        case 'payment_breakdown': result = paymentBreakdown(rows, mapping); break;
        case 'week_over_week':  result = weekOverWeekTrend(rows, mapping); break;
        case 'quality':         result = checkDataQuality(rows, mapping); break;
        case 'opportunities':   result = generateOpportunities(rows, mapping); break;
        case 'full_report': {
          const stats = summaryStats(rows, mapping);
          const opps = generateOpportunities(rows, mapping);
          const report = generateReportText(opps, stats, datasetName);
          result = { stats, opportunities: opps, report_text: report };
          break;
        }
        default: return { success: false, error: `Unknown analysis_type: ${req.analysis_type}` };
      }

      return { success: true, analysis_type: req.analysis_type, result };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  }

  async answerQuestion(filePath: string, question: string): Promise<{ success: boolean; answer?: string; data?: unknown; error?: string }> {
    const ingestResult = await ingestFile(filePath);
    if (!ingestResult.success) return { success: false, error: ingestResult.error };

    const rows = getFileRows(filePath);
    const mapping = ingestResult.mapping || {};
    const q = question.toLowerCase();

    if (/tổng doanh thu|total revenue|total sales|bao nhiêu tiền/.test(q)) {
      const stats = summaryStats(rows, mapping);
      return { success: true, answer: `Tổng doanh thu: $${stats.total_revenue.toFixed(2)} từ ${stats.total_transactions} giao dịch`, data: stats };
    }

    if (/ngày nào.*cao nhất|best day|top day|doanh thu.*ngày/.test(q)) {
      const byDay = revenueByDay(rows, mapping);
      const sorted = Object.entries(byDay).sort(([, a], [, b]) => b - a);
      if (sorted.length === 0) return { success: true, answer: 'Không có dữ liệu ngày' };
      const [day, rev] = sorted[0];
      return { success: true, answer: `Ngày doanh thu cao nhất: ${day} ($${rev.toFixed(2)})`, data: sorted.slice(0, 10) };
    }

    if (/món.*bán chạy|top item|best.*item|item.*nhất/.test(q)) {
      const items = itemPerformance(rows, mapping);
      const top = items.slice(0, 5);
      return { success: true, answer: `Top 5 món bán chạy:\n${top.map((i, n) => `${n + 1}. ${i.item}: $${i.revenue.toFixed(2)} (${i.quantity} lần)`).join('\n')}`, data: top };
    }

    if (/giờ.*cao điểm|peak hour|bận nhất/.test(q)) {
      const byHour = revenueByHour(rows, mapping);
      const sorted = Object.entries(byHour).sort(([, a], [, b]) => b - a);
      if (sorted.length === 0) return { success: true, answer: 'Không có dữ liệu giờ trong file này' };
      const [hour, rev] = sorted[0];
      return { success: true, answer: `Giờ cao điểm: ${hour}:00 ($${rev.toFixed(2)})`, data: sorted.slice(0, 8) };
    }

    if (/thứ.*nào|weekday|ngày trong tuần/.test(q)) {
      const byWeekday = revenueByWeekday(rows, mapping);
      const sorted = Object.entries(byWeekday).sort(([, a], [, b]) => b - a);
      if (sorted.length === 0) return { success: true, answer: 'Không có dữ liệu thứ trong tuần' };
      return { success: true, answer: `Doanh thu theo thứ:\n${sorted.map(([d, v]) => `${d}: $${v.toFixed(2)}`).join('\n')}`, data: sorted };
    }

    if (/cơ hội|opportunity|suggest|đề xuất/.test(q)) {
      const opps = generateOpportunities(rows, mapping);
      return { success: true, answer: `${opps.length} cơ hội phát hiện:\n${opps.map(o => `• ${o.title}: ${o.description}`).join('\n')}`, data: opps };
    }

    // Fallback: full summary
    const stats = summaryStats(rows, mapping);
    return {
      success: true,
      answer: `Tóm tắt dataset:\n- Doanh thu: $${stats.total_revenue.toFixed(2)}\n- Giao dịch: ${stats.total_transactions}\n- Ngày: ${stats.unique_dates}\n- Món: ${stats.unique_items}\n- Doanh thu/ngày TB: $${stats.avg_daily_revenue.toFixed(2)}`,
      data: stats,
    };
  }

  async quickAnalyze(filePath: string) {
    const ingestResult = await ingestFile(filePath);
    if (!ingestResult.success) return ingestResult;
    const rows = getFileRows(filePath);
    const mapping = ingestResult.mapping || {};
    const stats = summaryStats(rows, mapping);
    const opps = generateOpportunities(rows, mapping);
    return { success: true, ingestion: ingestResult, stats, opportunities: opps.slice(0, 5) };
  }

  listDatasets() { return listDatasets(); }
  getLastAnalysis(datasetId: string) { return getLastAnalysis(datasetId); }
  saveReport(datasetId: string, datasetName: string, type: string, result: unknown) {
    return saveAnalysisReport({ dataset_id: datasetId, dataset_name: datasetName, analysis_type: type, result });
  }
}

export default DataAnalystEngine;
