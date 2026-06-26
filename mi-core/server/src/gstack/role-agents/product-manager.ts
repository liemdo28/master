/**
 * Product Manager Agent
 * Defines scope, acceptance criteria, and formats CEO-facing reports.
 * Owns communication quality — CEO output is always in Vietnamese.
 */

import fs from 'fs';
import path from 'path';

import { WorkOrder, WorkOrderResult } from '../work-order-engine';
import { InterpretResult } from './ceo-interpreter';
import { EngManagerResult } from './engineering-manager';
import { QaResult } from './qa-agent';
import { AuditResult } from './auditor-agent';
import { logAction } from '../execution-ledger';


const MI_CORE_ROOT = process.env.MI_CORE_ROOT || 'D:/Project/Master/mi-core';
const REPORTS_DIR = path.join(MI_CORE_ROOT, 'reports/gstack');

export interface PmResult {
  acceptance_criteria: string[];
  scope_confirmed: boolean;
  report_path: string;
  ceo_summary: string;
}

function ensureReportsDir() {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

export async function defineScope(wo: WorkOrder, interpret: InterpretResult): Promise<PmResult> {
  const criteria = [
    ...interpret.scope.map(s => `✓ ${s}`),
    ...wo.acceptance_criteria,
  ];

  logAction({
    work_order_id: wo.request_id,
    requested_by: wo.requested_by,
    agent_role: 'product_manager',
    action_type: 'define_scope',
    target: wo.target_project || 'all',
    evidence: criteria.join(' | '),
    verdict: 'PASS',
  });

  return {
    acceptance_criteria: criteria,
    scope_confirmed: interpret.clarifications_needed.length === 0,
    report_path: '',
    ceo_summary: interpret.understood_request,
  };
}

export async function compileCeoReport(params: {
  wo: WorkOrder;
  interpret: InterpretResult;
  eng: EngManagerResult;
  qa: QaResult;
  audit: AuditResult;
}): Promise<PmResult> {
  const { wo, interpret, eng, qa, audit } = params;
  ensureReportsDir();

  const now = new Date().toISOString();
  const dateStr = now.slice(0, 10);
  const reportFile = path.join(REPORTS_DIR, `${wo.request_id}.md`);

  // Build findings list
  const findings: string[] = [];
  const fixed: string[] = [];
  const tested: string[] = [];
  const needsApproval: string[] = [];

  // Collect from engineering tasks
  for (const task of eng.tasks) {
    if (task.status === 'done' && task.type === 'scan' && task.result) {
      findings.push(`${task.title}: ${task.result.trim().split('\n')[0]?.slice(0, 100) || 'completed'}`);
    }
    if (task.status === 'done' && (task.type === 'fix' || task.type === 'build')) {
      fixed.push(task.title);
    }
    if (!task.auto_executable) {
      needsApproval.push(task.title);
    }
  }

  // QA results
  for (const check of qa.checks) {
    tested.push(`${check.name}: ${check.status} (${check.evidence.slice(0, 60)})`);
  }

  if (eng.blockers.length > 0) {
    needsApproval.push(...eng.blockers);
  }

  // Build result object
  const verdict: WorkOrderResult['verdict'] = needsApproval.length > 0 && qa.overall !== 'FAIL'
    ? 'APPROVAL_REQUIRED'
    : audit.verdict === 'REJECTED'
    ? 'FAILED'
    : qa.overall === 'PASS'
    ? 'DELIVERED'
    : 'PARTIAL';

  const confidenceScore = Math.round((qa.confidence_score + audit.confidence_score) / 2);

  // Build CEO-facing WhatsApp summary (concise, Vietnamese)
  const ceoSummary = buildCeoWhatsAppSummary({
    wo, verdict, findings, fixed, tested, needsApproval,
    confidenceScore, audit, qa,
  });

  // Write full report
  const reportContent = buildFullReport({
    wo, dateStr, interpret, eng, qa, audit,
    findings, fixed, tested, needsApproval, verdict, confidenceScore,
  });

  fs.writeFileSync(reportFile, reportContent);

  logAction({
    work_order_id: wo.request_id,
    requested_by: wo.requested_by,
    agent_role: 'product_manager',
    action_type: 'compile_report',
    target: wo.target_project || 'all',
    evidence: `Report: ${reportFile}`,
    verdict: verdict === 'DELIVERED' ? 'PASS' : verdict === 'FAILED' ? 'FAIL' : 'PENDING',
    detail: `Confidence: ${confidenceScore}% | Needs approval: ${needsApproval.length}`,
  });

  return {
    acceptance_criteria: wo.acceptance_criteria,
    scope_confirmed: true,
    report_path: reportFile,
    ceo_summary: ceoSummary,
  };
}

function buildCeoWhatsAppSummary(p: {
  wo: WorkOrder;
  verdict: WorkOrderResult['verdict'];
  findings: string[];
  fixed: string[];
  tested: string[];
  needsApproval: string[];
  confidenceScore: number;
  audit: AuditResult;
  qa: QaResult;
}): string {
  const { wo, verdict, findings, fixed, tested, needsApproval, confidenceScore, audit, qa } = p;
  const target = wo.target_project || 'hệ thống';
  const lines: string[] = [];

  const icon = verdict === 'DELIVERED' ? '✅' : verdict === 'APPROVAL_REQUIRED' ? '⏳' : verdict === 'PARTIAL' ? '⚠️' : '❌';

  lines.push(`${icon} *Work Order ${wo.request_id}* — ${target.toUpperCase()}`);
  lines.push('');

  // What was found
  if (findings.length > 0) {
    lines.push('*🔍 Đã kiểm tra:*');
    findings.slice(0, 3).forEach(f => lines.push(`• ${f.slice(0, 80)}`));
    if (findings.length > 3) lines.push(`• ... và ${findings.length - 3} mục khác`);
    lines.push('');
  }

  // What was fixed
  if (fixed.length > 0) {
    lines.push('*🔧 Đã fix:*');
    fixed.forEach(f => lines.push(`• ${f}`));
    lines.push('');
  }

  // QA results
  lines.push('*🧪 QA kết quả:*');
  const passCount = qa.checks.filter(c => c.status === 'PASS').length;
  lines.push(`• ${passCount}/${qa.checks.length} checks PASS`);
  if (qa.blocking_issues.length > 0) {
    lines.push(`• ⚠️ Blocking: ${qa.blocking_issues[0].slice(0, 60)}`);
  }
  lines.push('');

  // Certification
  if (audit.certification_id) {
    lines.push(`*🏆 Auditor:* ${audit.verdict} — ${audit.certification_id}`);
  } else {
    lines.push(`*🔍 Auditor:* ${audit.verdict}`);
  }
  lines.push('');

  // Needs approval
  if (needsApproval.length > 0) {
    lines.push('*⏳ Cần anh approve:*');
    needsApproval.slice(0, 3).forEach(n => lines.push(`• ${n.slice(0, 80)}`));
    lines.push('');
    lines.push('Reply "approve" để tiếp tục hoặc "cancel" để hủy.');
  } else {
    lines.push(`*Confidence: ${confidenceScore}%*`);
    lines.push(verdict === 'DELIVERED' ? 'Đã hoàn thành và deploy. Không cần anh làm gì thêm.' : '');
  }

  return lines.join('\n');
}

function buildFullReport(p: {
  wo: WorkOrder; dateStr: string; interpret: InterpretResult;
  eng: EngManagerResult; qa: QaResult; audit: AuditResult;
  findings: string[]; fixed: string[]; tested: string[];
  needsApproval: string[]; verdict: string; confidenceScore: number;
}): string {
  const { wo, dateStr, interpret, eng, qa, audit, findings, fixed, tested, needsApproval, verdict, confidenceScore } = p;

  return [
    `# GStack Work Order Report — ${wo.request_id}`,
    `**Date:** ${dateStr}  `,
    `**Status:** ${verdict}  `,
    `**Confidence:** ${confidenceScore}%  `,
    `**Target:** ${wo.target_project || 'general'}  `,
    `**Priority:** ${wo.priority}  `,
    '',
    '## CEO Request',
    `> ${wo.raw_request}`,
    '',
    '## Mi Understood',
    interpret.understood_request,
    '',
    '## What Was Found',
    ...findings.map(f => `- ${f}`),
    findings.length === 0 ? '- No critical issues found' : '',
    '',
    '## What Was Fixed',
    ...fixed.map(f => `- ${f}`),
    fixed.length === 0 ? '- No automatic fixes applied' : '',
    '',
    '## What Was Tested',
    ...tested.map(t => `- ${t}`),
    '',
    '## QA Summary',
    `**Overall:** ${qa.overall}  `,
    `**Health:** ${qa.health_summary}  `,
    `**Checks:** ${qa.checks.length} total  `,
    ...qa.checks.map(c => `- [${c.status}] ${c.name}: ${c.evidence.slice(0, 100)}`),
    '',
    '## Audit Certification',
    `**Verdict:** ${audit.verdict}  `,
    audit.certification_id ? `**Cert ID:** ${audit.certification_id}  ` : '',
    '',
    '### Confirmed Claims',
    ...audit.confirmed_claims.map(c => `- ${c}`),
    '',
    audit.rejected_claims.length > 0 ? '### Rejected Claims' : '',
    ...audit.rejected_claims.map(c => `- ${c}`),
    '',
    '## Engineering Tasks',
    ...eng.tasks.map(t => `- [${t.status.toUpperCase()}] ${t.task_id}: ${t.title}${t.result ? ` → ${t.result.slice(0, 80)}` : ''}`),
    '',
    needsApproval.length > 0 ? '## Needs CEO Approval' : '',
    ...needsApproval.map(n => `- ${n}`),
    '',
    '---',
    `*Generated by Mi GStack Layer — ${new Date().toISOString()}*`,
  ].filter(l => l !== undefined).join('\n');
}
