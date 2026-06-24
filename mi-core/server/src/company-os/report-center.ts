/**
 * Mi Company OS — Report Center
 * CEO does NOT receive: raw logs, workflow IDs, stack traces, internal task names.
 * CEO DOES receive: what was done, result, blockers, evidence, next action.
 *
 * Report Center aggregates all department outputs into one CEO-level response.
 */

import type { QaResult } from './qa-gate';
import type { PipelineRun } from './evidence-store';
import { getStepsForPipeline } from './evidence-store';

export interface DeptReport {
  dept_id: string;
  dept_name: string;
  summary: string;
  result?: unknown;
  status: 'done' | 'failed' | 'blocked' | 'pending_approval';
  evidence_count: number;
  confidence: number;
}

export interface CeoReport {
  pipeline_id: string;
  ceo_command: string;
  timestamp: string;
  what_was_done: string[];
  result: string;
  blockers: string[];
  evidence_summary: string;
  next_action?: string;
  qa_verdict: 'PASS' | 'FAIL' | 'PENDING';
  confidence: number;
  dept_reports: DeptReport[];
}

// Patterns to strip from CEO output
const STRIP_PATTERNS: Array<[RegExp, string]> = [
  [/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/g, ''],  // UUIDs
  [/at .+:\d+:\d+/g, ''],                   // stack trace lines
  [/Error: [^\n]+\n?/g, '[error] '],        // raw errors → sanitized label
  [/\[DEBUG\][^\n]*/g, ''],                 // debug lines
  [/\b(workflow_id|task_id|step_id|pipeline_id)\s*[:=]\s*\S+/gi, ''],  // internal IDs
  [/\bundefined\b/g, ''],
  [/\bnull\b/g, ''],
  [/\[object Object\]/g, ''],
  [/process\.env\.\w+/g, '[env]'],          // never leak env var names
  [/:\d{4,5}\b/g, ''],                      // internal port numbers
  [/127\.0\.0\.1|localhost/g, 'local-server'], // never expose internal host
];

// CEO-visible language that must never appear in reports
const BANNED_CEO_PHRASES = [
  'TODO', 'FIXME', 'PLACEHOLDER', 'PROVISIONAL', 'DESIGNED',
  'FRAMEWORK_COMPLETE', 'REPORT_ONLY_PASS', 'lorem ipsum',
];

function clean(text: string): string {
  let out = text;
  for (const [p, replacement] of STRIP_PATTERNS) {
    out = out.replace(p, replacement);
  }
  // Strip any banned phrases
  for (const phrase of BANNED_CEO_PHRASES) {
    out = out.replace(new RegExp(phrase, 'gi'), '');
  }
  return out.trim().replace(/\s{2,}/g, ' ');
}

function assertNoBannedContent(text: string): void {
  for (const phrase of BANNED_CEO_PHRASES) {
    if (new RegExp(phrase, 'i').test(text)) {
      throw new Error(`Report Center: banned phrase '${phrase}' found in CEO output — report rejected`);
    }
  }
  // No raw UUIDs to CEO
  if (/[0-9a-f]{8}-[0-9a-f]{4}/.test(text)) {
    throw new Error('Report Center: raw UUID found in CEO output — strip before sending');
  }
}

/**
 * Build a CEO-level report from pipeline run + QA result + department outputs.
 */
export function buildCeoReport(
  run: PipelineRun,
  deptOutputs: DeptReport[],
  qa: QaResult
): CeoReport {
  const steps = getStepsForPipeline(run.id);
  const evidenceCount = steps.filter(s => s.status === 'done').length;

  const done = deptOutputs.filter(d => d.status === 'done');
  const blocked = deptOutputs.filter(d => d.status === 'blocked' || d.status === 'pending_approval');
  const failed = deptOutputs.filter(d => d.status === 'failed');

  const whatWasDone: string[] = done.map(d => clean(d.summary));

  const blockers: string[] = [
    ...blocked.map(d => `${d.dept_name}: pending approval`),
    ...failed.map(d => `${d.dept_name}: ${clean(d.summary)}`),
  ];

  const avgConf = deptOutputs.length
    ? deptOutputs.reduce((s, d) => s + d.confidence, 0) / deptOutputs.length
    : 0;

  const result = qa.verdict === 'PASS'
    ? `Completed. ${done.length} department(s) executed successfully.`
    : qa.verdict === 'FAIL'
    ? `Blocked. ${qa.blocking_reason ? clean(qa.blocking_reason) : 'QA check failed.'}`
    : 'Pending verification.';

  const nextAction = blockers.length > 0
    ? `CEO approval needed: ${blockers[0]}`
    : avgConf < 0.95
    ? `Confidence ${(avgConf * 100).toFixed(0)}% — Mi recommends CEO review before acting`
    : undefined;

  const report: CeoReport = {
    pipeline_id: run.id,
    ceo_command: run.ceo_command,
    timestamp: new Date().toISOString(),
    what_was_done: whatWasDone,
    result,
    blockers,
    evidence_summary: `${evidenceCount} step(s) completed with evidence stored`,
    next_action: nextAction,
    qa_verdict: qa.verdict,
    confidence: avgConf,
    dept_reports: deptOutputs,
  };

  // Final guard: assert no banned content in the report text fields
  const allText = [result, ...whatWasDone, ...blockers, nextAction || ''].join(' ');
  assertNoBannedContent(allText);

  return report;
}

/**
 * Format CeoReport as a WhatsApp-friendly message.
 */
export function formatCeoMessage(report: CeoReport): string {
  const lines: string[] = [];

  const icon = report.qa_verdict === 'PASS' ? '✅' : report.qa_verdict === 'FAIL' ? '❌' : '⏳';
  lines.push(`${icon} *Mi Report*`);
  lines.push('');

  if (report.what_was_done.length) {
    lines.push('*Done:*');
    for (const item of report.what_was_done) {
      lines.push(`• ${item}`);
    }
    lines.push('');
  }

  lines.push(`*Result:* ${report.result}`);

  if (report.blockers.length) {
    lines.push('');
    lines.push('*Blockers:*');
    for (const b of report.blockers) {
      lines.push(`⚠️ ${b}`);
    }
  }

  lines.push('');
  lines.push(`*Evidence:* ${report.evidence_summary}`);
  lines.push(`*QA:* ${report.qa_verdict} — confidence ${(report.confidence * 100).toFixed(0)}%`);

  if (report.next_action) {
    lines.push('');
    lines.push(`*Next:* ${report.next_action}`);
  }

  const out = lines.join('\n');
  // Final assertion before transmission
  assertNoBannedContent(out);
  return out;
}

/**
 * Low-confidence fallback message — tells CEO exactly what is done,
 * blocked, missing evidence, and what CEO must decide.
 */
export function buildLowConfidenceReport(
  command: string,
  done: string[],
  blocked: string[],
  missingEvidence: string[],
  ceoMustDecide: string[]
): string {
  const lines = [
    `⚠️ *Mi — Confidence < 95%*`,
    `Request: "${command}"`,
    '',
  ];

  if (done.length) {
    lines.push('*✅ Done:*');
    done.forEach(d => lines.push(`• ${d}`));
    lines.push('');
  }

  if (blocked.length) {
    lines.push('*🔴 Blocked:*');
    blocked.forEach(b => lines.push(`• ${b}`));
    lines.push('');
  }

  if (missingEvidence.length) {
    lines.push('*❓ Missing evidence:*');
    missingEvidence.forEach(m => lines.push(`• ${m}`));
    lines.push('');
  }

  if (ceoMustDecide.length) {
    lines.push('*👤 CEO must decide:*');
    ceoMustDecide.forEach(c => lines.push(`• ${c}`));
  }

  return lines.join('\n');
}
