/**
 * Mi Company OS — Reporting Department
 * Handles: daily briefing, KPI summary, weekly summary, status reports.
 *
 * Data sources:
 *   - executive-briefing: getLastBriefing()
 *   - strategic-memory: long-term trends
 *   - agenview: dashboard snapshot
 *   - visibility: connector health
 *   - pipeline history: recent Company OS runs
 *
 * Brain: qwen3:8b — produces CEO-level narrative from aggregated data.
 * Output: CEO gets result summary, NOT raw logs.
 */

import { runDepartment, type RuntimeOutput } from './department-runtime';
import { recordStep, completeStep, recentPipelineRuns } from './evidence-store';
import type { DeptReport } from './report-center';

const DEPT_ID = 'report-center';

function getLastBriefingData(): unknown {
  try {
    const { getLastBriefing } = require('../executive-briefing/briefing-engine');
    return getLastBriefing();
  } catch {
    return null;
  }
}

function getStrategicTrends(): unknown {
  try {
    const { getRecentInsights } = require('../strategic-memory/strategic-memory-engine');
    return getRecentInsights(5);
  } catch {
    return null;
  }
}

function getAgenviewSnapshot(): unknown {
  try {
    const { buildAgenviewSnapshot } = require('../agenview/agenview-engine');
    return buildAgenviewSnapshot();
  } catch {
    return null;
  }
}

export interface ReportingRequest {
  pipeline_id: string;
  intent: string;
  command: string;
  report_type?: 'daily' | 'weekly' | 'kpi' | 'status' | 'auto';
}

export interface ReportingDeptReport extends DeptReport {
  report_type: string;
  data_sources: string[];
  recent_pipeline_count: number;
}

export async function executeReportingRequest(req: ReportingRequest): Promise<ReportingDeptReport> {
  const { pipeline_id, intent, command, report_type = 'auto' } = req;

  // Gather report data
  const dataStep = recordStep(pipeline_id, DEPT_ID, 'report_data_gather', { intent, report_type });

  const [briefing, trends, agenview] = await Promise.all([
    Promise.resolve(getLastBriefingData()),
    Promise.resolve(getStrategicTrends()),
    Promise.resolve(getAgenviewSnapshot()),
  ]);

  const recentPipelines = recentPipelineRuns(10);
  const dataSources: string[] = [];
  const contextParts: string[] = [];

  if (briefing) {
    dataSources.push('Executive Briefing');
    const b = briefing as Record<string, unknown>;
    contextParts.push(`Latest Daily Briefing:\n${JSON.stringify({
      briefing_id: b.briefing_id,
      generated_at: b.generated_at,
      severity: b.severity,
      summary: String(b.summary || b.full_text || '').substring(0, 800),
    }, null, 2)}`);
  } else {
    contextParts.push('Executive Briefing: not yet generated today');
  }

  if (trends) {
    dataSources.push('Strategic Memory');
    contextParts.push(`Strategic Trends:\n${JSON.stringify(trends, null, 2).substring(0, 800)}`);
  }

  if (agenview) {
    dataSources.push('AgenView Dashboard');
    contextParts.push(`System Dashboard:\n${JSON.stringify(agenview, null, 2).substring(0, 800)}`);
  }

  contextParts.push(`Recent Company OS Pipelines (last 10):\n${JSON.stringify(
    recentPipelines.map(r => ({
      command: r.ceo_command.substring(0, 60),
      status: r.status,
      confidence: r.confidence,
      created_at: r.created_at,
    })), null, 2
  )}`);

  completeStep(dataStep.id, {
    sources: dataSources,
    pipeline_count: recentPipelines.length,
  }, dataSources.length >= 2 ? 0.90 : 0.65);

  // Detect report type from intent
  const detectedType = report_type === 'auto'
    ? command.match(/week|tuần/i) ? 'weekly'
    : command.match(/kpi/i) ? 'kpi'
    : command.match(/status|trạng thái/i) ? 'status'
    : 'daily'
    : report_type;

  const runtimeResult: RuntimeOutput = await runDepartment({
    pipeline_id,
    dept_id: DEPT_ID,
    intent,
    command: `Generate a ${detectedType} report. ${command}`,
    extra_context: contextParts.join('\n\n'),
  });

  return {
    ...runtimeResult,
    dept_id: DEPT_ID,
    dept_name: 'Reporting Center',
    report_type: detectedType,
    data_sources: dataSources,
    recent_pipeline_count: recentPipelines.length,
    summary: `${detectedType.toUpperCase()} report generated from ${dataSources.length} source(s). ${recentPipelines.length} recent pipeline(s) included.`,
  };
}
