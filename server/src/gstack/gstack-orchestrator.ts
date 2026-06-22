/**
 * GStack Orchestrator — Mi Operating Backend
 * Main pipeline: CEO request → Work Order → Agents → QA → Audit → CEO Report
 *
 * This is the single entry point for all GStack execution.
 * Called from: WhatsApp route, GStack API route, direct invocation.
 */

import { createWorkOrder, updateWoStatus, deliverWorkOrder, WorkOrder, WorkOrderResult } from './work-order-engine';
import { interpret } from './role-agents/ceo-interpreter';
import { planTechnicalWork } from './role-agents/engineering-manager';
import { defineScope, compileCeoReport } from './role-agents/product-manager';
import { runQa } from './role-agents/qa-agent';
import { audit, scanProject } from './role-agents/auditor-agent';
import { prepareRelease } from './role-agents/release-agent';
import { logAction } from './execution-ledger';
import { getRoleForIntent, getRole } from './role-registry';
import { getSkillsForIntent, runSkill } from './skills/skill-registry';
import { recordExecution } from './skills/skill-reliability-tracker';
import { classify } from './approval-engine';
import {
  writeSourceScan, writePm2Status, writeErrorLog, writeQaReport,
  generateEvidencePackage, getEvidenceBundle,
  addCommandRun, addTestOutput, addHealthCheck, addErrorFound, addArtifact,
  EvidencePackage,
} from './evidence-engine';
import { certify } from './qa-certification-engine';
import { quickCeoReport } from './ceo-report';
import { runPmAgent, type PMPackage } from './pm-agent/pm-agent';
import { splitCompoundRequest, SubIntent } from './multi-intent-splitter';
import { handleFinanceQuery } from './finance-truth-layer';

export interface GStackRequest {
  raw_request: string;
  requested_by: string;
  source: 'whatsapp' | 'api' | 'dashboard';
}

export interface GStackResponse {
  work_order_id: string;
  ceo_message: string;        // WhatsApp-formatted reply for CEO
  status: WorkOrder['status'];
  verdict: WorkOrderResult['verdict'];
  confidence_score: number;
  report_path?: string;
  evidence_package?: EvidencePackage;
  pm_package?: PMPackage;     // Phase 13: PM brief attached to every response
  duration_ms: number;
  handled: boolean;
}

// ── Intent detection — should this go to GStack or regular personality? ───────

const GSTACK_TRIGGERS = [
  // Audit + fix
  /\b(kiem tra|kiểm tra|audit|check|inspect|scan)\b.*\b(project|dashboard|he thong|hệ thống|source|code|loi|lỗi)\b/i,
  /\b(tim loi|tìm lỗi|find.*bug|find.*issue|detect.*error)\b/i,
  /\b(fix|sua|sửa)\b.*\b(production|prod|loi|lỗi|bug)\b/i,
  /kiem tra.*fix|kiểm tra.*fix/i,
  // Build
  /\b(build|tao|tạo|them|thêm|implement|phat trien|phát triển)\b.*\b(feature|tinh nang|tính năng|module|chuc nang|chức năng)\b/i,
  // Deploy
  /\b(deploy|release|trien khai|triển khai|phat hanh|phát hành|len production|lên production)\b/i,
  // Report
  /\b(tao bao cao|tạo báo cáo|create report|generate report|tong hop|tổng hợp)\b/i,
  // Full pipeline keywords
  /kiem tra.*tim.*fix.*bao cao/i,
  /kiểm tra.*tìm.*fix.*báo cáo/i,
  /audit.*fix.*test.*report/i,
];

export function shouldUseGStack(text: string): boolean {
  return GSTACK_TRIGGERS.some(p => p.test(text));
}

// ── Tier 1: Fast path — status/health requests ────────────────────────────────

async function runSeoPublishPipeline(wo: WorkOrder, req: GStackRequest): Promise<GStackResponse> {
  const t0 = Date.now();
  updateWoStatus(wo.request_id, 'executing', { role: 'system', level: 'info', message: 'SEO publish pipeline started' });

  // Extract topic/keyword from raw request (best-effort NLP)
  const raw = req.raw_request;
  const topicMatch = raw.match(/(?:cho|for|ve|về|topic|chu de|chủ đề)\s+(.{3,40}?)(?:\s*$|\s*[,.])/i);
  const topic = topicMatch ? topicMatch[1].trim() : 'sushi stockton';
  const location: 'raw_stockton' | 'raw_modesto' = /modesto/i.test(raw) ? 'raw_modesto' : 'raw_stockton';
  const city = location === 'raw_modesto' ? 'Modesto' : 'Stockton';

  // Reality Gate: this skill REQUIRES_APPROVAL — return approval request first
  const approvalRequired = classify({ intent: wo.intent.intent, skill_id: 'raw_seo_publish', action_description: `Publish SEO article about "${topic}" to rawsushibar.com` });
  if (approvalRequired.requires_ceo_approval) {
    deliverWorkOrder(wo.request_id, {
      verdict: 'APPROVAL_REQUIRED',
      summary: `CEO approval required before publishing SEO article about "${topic}" to rawsushibar.com`,
      findings: [`Topic: ${topic}`, `Location: ${city}`, `Site: rawsushibar.com`],
      fixed: [],
      tested: [],
      needs_approval: [`Publish SEO article: "${topic}" on rawsushibar.com/${location}`],
      confidence_score: 90,
    });
    return {
      work_order_id: wo.request_id,
      ceo_message: [
        `📝 *Yêu cầu đăng bài SEO — cần anh approve trước:*`,
        ``,
        `• Chủ đề: *${topic}*`,
        `• Site: rawsushibar.com (${city})`,
        `• Skill: raw_seo_publish`,
        ``,
        `Anh confirm để em tiến hành publish không?`,
        `_(Work order: ${wo.request_id})_`,
      ].join('\n'),
      status: 'approval_pending',
      verdict: 'APPROVAL_REQUIRED',
      confidence_score: 90,
      duration_ms: Date.now() - t0,
      handled: true,
    };
  }

  // Execute publish
  const { runSkill } = require('./skills/skill-registry');
  const skillResult = await runSkill('raw_seo_publish', {
    topic, keyword: topic, location,
    title: `Sushi ${topic} — Raw Sushi Bar ${city}`,
  }, wo.request_id);

  const success = skillResult.success;

  // Reality Gate: NEVER claim "published" without verified evidence
  const { listEvidence } = require('./evidence/evidence-generator');
  const allEvidence = listEvidence();
  const latestEvidence = allEvidence
    .filter((e: any) => e.workflow_id === wo.request_id)
    .sort((a: any, b: any) => b.timestamp.localeCompare(a.timestamp))[0];

  let ceoMessage: string;
  if (success && latestEvidence) {
    const verified = latestEvidence.verified;
    // WhatsApp proof delivery
    const proofLines = [
      `✅ *Bài SEO đã được submit lên rawsushibar.com*`,
      ``,
      `📌 *Chủ đề:* ${topic}`,
      `🔗 *URL:* ${latestEvidence.url}`,
      `🔁 *Git commit:* ${latestEvidence.git_commit || 'pending'}`,
      `📋 *HTTP:* ${latestEvidence.http_status}`,
      `🕐 *Thời gian:* ${latestEvidence.timestamp}`,
      ``,
      verified
        ? `✅ *Reality Gate: URL đã live và xác minh được*`
        : `⏳ *Reality Gate: URL pending — Cloudflare Pages đang build (~60s)*`,
      ``,
      `_(Work order: ${wo.request_id})_`,
    ];
    ceoMessage = proofLines.join('\n');

    // Send WhatsApp proof
    try {
      const { sendToCeo } = require('../services/whatsapp-sender');
      await sendToCeo(ceoMessage);
    } catch { /* WhatsApp delivery is best-effort */ }

  } else if (success && !latestEvidence) {
    // Published but no evidence file — Reality Gate blocks "published" claim
    ceoMessage = [
      `⚠️ *Submit thành công nhưng evidence chưa capture được*`,
      ``,
      `Bài SEO về "${topic}" đã gửi lên site nhưng em chưa xác minh được URL.`,
      `Anh kiểm tra rawsushibar.com sau ~60s để xem Cloudflare Pages đã build xong chưa.`,
      ``,
      `_(Work order: ${wo.request_id})_`,
    ].join('\n');
  } else {
    ceoMessage = [
      `❌ *Publish thất bại*`,
      ``,
      `Lỗi: ${skillResult.output}`,
      ``,
      `Có thể thiếu RAWWEBSITE_ADMIN_SECRET trong server/.env.`,
      `_(Work order: ${wo.request_id})_`,
    ].join('\n');
  }

  deliverWorkOrder(wo.request_id, {
    verdict: success ? 'DELIVERED' : 'FAILED',
    summary: success ? `SEO article published: ${topic}` : `Publish failed: ${skillResult.output}`,
    findings: [skillResult.output],
    fixed: success ? [`Published: ${latestEvidence?.url || 'unknown'}`] : [],
    tested: latestEvidence ? [`URL check: ${latestEvidence.http_status}`] : [],
    needs_approval: [],
    confidence_score: success ? 90 : 0,
  });

  return {
    work_order_id: wo.request_id,
    ceo_message: ceoMessage,
    status: success ? 'delivered' : 'rejected',
    verdict: success ? 'DELIVERED' : 'FAILED',
    confidence_score: success ? 90 : 0,
    duration_ms: Date.now() - t0,
    handled: true,
  };
}

async function runStatusPipeline(wo: WorkOrder): Promise<GStackResponse> {
  const t0 = Date.now();
  updateWoStatus(wo.request_id, 'executing', { role: 'system', level: 'info', message: 'Running status pipeline' });

  const [interpretResult, engResult] = await Promise.all([
    interpret(wo),
    planTechnicalWork(wo),
  ]);

  const pm2Summary = engResult.tasks.find(t => t.task_id === 'T1')?.result || 'No PM2 data';
  const portSummary = engResult.tasks.find(t => t.task_id === 'T2')?.result || '';

  const lines = [
    '📊 *Báo cáo trạng thái hệ thống:*',
    '',
    pm2Summary.includes('┌') || pm2Summary.includes('id') || pm2Summary.includes('name')
      ? parsePm2Summary(pm2Summary)
      : pm2Summary.slice(0, 300),
    portSummary ? `\n🔌 Ports: ${portSummary.slice(0, 100)}` : '',
    `\n_Confidence: 95%_`,
  ].filter(Boolean).join('\n');

  const result: WorkOrderResult = {
    verdict: 'DELIVERED',
    summary: 'Status check complete',
    findings: [pm2Summary.slice(0, 100)],
    fixed: [],
    tested: [],
    needs_approval: [],
    confidence_score: 95,
  };

  deliverWorkOrder(wo.request_id, result);

  return {
    work_order_id: wo.request_id,
    ceo_message: lines,
    status: 'delivered',
    verdict: 'DELIVERED',
    confidence_score: 95,
    duration_ms: Date.now() - t0,
    handled: true,
  };
}

function parsePm2Summary(pm2out: string): string {
  // Extract key info from PM2 list output
  const lines = pm2out.split('\n').filter(l => l.includes('│') && !l.includes('┌') && !l.includes('└') && !l.includes('├'));
  const procs = lines.map(l => {
    const cols = l.split('│').map(c => c.trim()).filter(Boolean);
    if (cols.length < 6) return null;
    return `• ${cols[1]}: ${cols[5]} | ↺${cols[7] || '0'} | ${cols[9] || '?'}`;
  }).filter(Boolean);
  return procs.length > 0 ? procs.join('\n') : pm2out.slice(0, 200);
}

// ── Tier 2: Full pipeline — audit, fix, report ───────────────────────────────

async function runFullPipeline(wo: WorkOrder): Promise<GStackResponse> {
  const t0 = Date.now();
  updateWoStatus(wo.request_id, 'executing', { role: 'system', level: 'info', message: 'Running full GStack pipeline' });

  // Stage 1: Interpret + Plan (parallel)
  const [interpretResult, engResult] = await Promise.all([
    interpret(wo),
    planTechnicalWork(wo),
  ]);
  updateWoStatus(wo.request_id, 'executing', {
    role: 'engineering_manager', level: 'info',
    message: `Technical plan: ${engResult.tech_summary}`,
  });

  // Phase 6: Skills write evidence files directly (pass wo.request_id)
  // Engineering manager tasks already ran — capture their output as evidence files
  for (const task of engResult.tasks) {
    if (!task.result) continue;
    const output = task.result;
    const success = task.status === 'done';
    // Route to named evidence writers based on task type
    if (/pm2|process/i.test(task.title)) {
      writePm2Status(wo.request_id, output, 'engineering_manager');
      recordExecution('pm2_status', '1.0.0', success, 0, wo.request_id);
    } else if (/source|scan/i.test(task.title)) {
      writeSourceScan(wo.request_id, output, 'engineering_manager');
      recordExecution('source_scan', '1.0.0', success, 0, wo.request_id);
    } else if (/log|error/i.test(task.title)) {
      writeErrorLog(wo.request_id, output, 'engineering_manager');
      recordExecution('log_scan', '1.0.0', success, 0, wo.request_id);
    } else {
      addCommandRun(wo.request_id, task.title, output, success, 'engineering_manager');
    }
  }

  // Stage 2: QA + health skill (parallel) — health skill writes health_check.json evidence
  updateWoStatus(wo.request_id, 'qa_pending', { role: 'system', level: 'info', message: 'Running QA sweep + health check' });
  const [qaResult] = await Promise.all([
    runQa(wo),
    runSkill('health', {}, wo.request_id),  // writes health_check.json
  ]);

  // Phase 11: record QA skills metrics
  recordExecution('regression_suite', '1.0.0', qaResult.overall !== 'FAIL', 0, wo.request_id);

  // QA checks also accumulate into test_results.json
  const testRows = qaResult.checks.map(c => ({
    id: c.check_id,
    name: c.name,
    passed: c.status === 'PASS',
    output: (c.evidence || c.status).slice(0, 200),
    duration_ms: c.duration_ms || 0,
  }));
  const { writeTestResults: wtr } = require('./evidence-engine');
  wtr(wo.request_id, testRows, 'qa_agent');

  // Log QA failures as error evidence
  for (const check of qaResult.checks) {
    if (check.status === 'FAIL' && check.evidence) {
      const isDeployIntent = ['deploy_release', 'rollback'].includes(wo.intent.intent);
      const severity = (check.check_id === 'QA2' && isDeployIntent) ? 'critical' : check.check_id === 'QA2' ? 'warning' : 'error';
      addErrorFound(wo.request_id, check.evidence, check.name, severity as any, 'qa_agent');
    }
  }

  // Stage 3: Audit
  const auditResult = await audit(wo, qaResult);

  // Stage 4: Release readiness (if deploy intent)
  let releaseResult = null;
  if (wo.intent.intent === 'deploy_release') {
    releaseResult = await prepareRelease(wo, qaResult.overall !== 'FAIL');
  }

  // Phase 5: PM report (still needed for report_path + markdown artifact)
  const pmResult = await compileCeoReport({
    wo, interpret: interpretResult, eng: engResult, qa: qaResult, audit: auditResult,
  });

  // Phase 7: QA Certification Engine (formal 5-gate check)
  const qaPassCount = qaResult.checks.filter(c => c.status === 'PASS').length;
  const qaTotalCount = qaResult.checks.length;
  const legacyConfidence = Math.round((qaResult.confidence_score + auditResult.confidence_score) / 2);
  const certification = certify(wo, { qa_pass_count: qaPassCount, qa_total_count: qaTotalCount, base_confidence: legacyConfidence });

  // Phase 6: Write qa_report.md evidence file (required by G2 gate)
  const qaReportContent = [
    `# QA Report — ${wo.request_id}`,
    `**Date:** ${new Date().toISOString()}`,
    `**Verdict:** ${certification.verdict}`,
    `**Cert ID:** ${certification.cert_id || 'NONE'}`,
    `**Confidence:** ${certification.confidence_score}%`,
    '',
    '## Gates',
    ...certification.gates.map(g => `- ${g.status === 'PASS' ? '✅' : g.status === 'FAIL' ? '❌' : '⚠️'} **${g.name}**: ${g.details}`),
    '',
    '## QA Checks',
    ...qaResult.checks.map(c => `- ${c.status === 'PASS' ? '✅' : '❌'} **${c.check_id} ${c.name}**: ${c.evidence || c.status}`),
    '',
    `## Evidence Files`,
    `Directory: .local-agent-global/evidence/${wo.request_id}/`,
  ].join('\n');
  writeQaReport(wo.request_id, qaReportContent, 'auditor_agent');

  // Derive verdict from certification
  const hasApprovalNeeded = engResult.blockers.length > 0 || (releaseResult && !releaseResult.ready);
  let verdict: WorkOrderResult['verdict'];
  if (hasApprovalNeeded) {
    verdict = 'APPROVAL_REQUIRED';
  } else if (certification.verdict === 'REJECTED') {
    verdict = 'FAILED';
  } else if (certification.verdict === 'CONDITIONAL_PASS') {
    verdict = 'PARTIAL';
  } else {
    verdict = 'DELIVERED';
  }

  const workOrderResult: WorkOrderResult = {
    verdict,
    summary: certification.summary,
    findings: engResult.tasks.filter(t => t.result).map(t => t.result!.slice(0, 80)),
    fixed: engResult.tasks.filter(t => t.status === 'done' && t.type === 'fix').map(t => t.title),
    tested: qaResult.checks.map(c => `${c.name}: ${c.status}`),
    needs_approval: engResult.blockers,
    confidence_score: certification.confidence_score,
    report_path: pmResult.report_path,
  };

  deliverWorkOrder(wo.request_id, workOrderResult);

  // Phase 6: Generate final Evidence Package (manifest of all files)
  const evidencePackage = generateEvidencePackage(wo.request_id);

  // Phase 9: 8-section CEO report
  const evidenceBundle = getEvidenceBundle(wo.request_id);
  const ceoMessage = quickCeoReport(wo, workOrderResult, evidenceBundle, certification);

  logAction({
    work_order_id: wo.request_id,
    requested_by: wo.requested_by,
    agent_role: 'system',
    action_type: 'pipeline_complete',
    target: wo.target_project || 'all',
    evidence: `Cert: ${certification.cert_id || 'REJECTED'} | Files: ${evidencePackage.files.length} | QA: ${qaResult.overall}`,
    verdict: verdict === 'DELIVERED' ? 'PASS' : verdict === 'FAILED' ? 'FAIL' : 'APPROVAL_REQUIRED',
    detail: `Duration: ${Date.now() - t0}ms | Confidence: ${certification.confidence_score}%`,
  });

  return {
    work_order_id: wo.request_id,
    ceo_message: ceoMessage,
    status: verdict === 'APPROVAL_REQUIRED' ? 'approval_pending' : 'delivered',
    verdict,
    confidence_score: certification.confidence_score,
    report_path: pmResult.report_path,
    evidence_package: evidencePackage,
    duration_ms: Date.now() - t0,
    handled: true,
  };
}

// ── Public entry point ────────────────────────────────────────────────────────

export async function processGStackRequest(req: GStackRequest): Promise<GStackResponse> {
  const t0 = Date.now();

  // Phase 16: Personal Task Intelligence fast-path — no work order, no LLM needed
  {
    const { dispatchTaskQuery } = require('./task-intelligence/task-query-engine-shim');
    const taskAnswer = dispatchTaskQuery(req.raw_request);
    if (taskAnswer) {
      return {
        work_order_id: `TQ-${Date.now()}`,
        ceo_message: taskAnswer.answer_vi,
        status: 'delivered',
        verdict: 'DELIVERED',
        confidence_score: 100,
        duration_ms: Date.now() - t0,
        handled: true,
      };
    }
  }

  // ── Multi-intent split: compound CEO requests run as child work orders ───────
  const split = splitCompoundRequest(req.raw_request);
  if (split.is_compound && split.sub_intents.length >= 2) {
    return processCompoundRequest(req, split.sub_intents, t0);
  }

  // Create work order
  const wo = createWorkOrder(req);

  // ── D1: Finance Truth Layer — intercept before full pipeline ────────────────
  // query_finance never runs through runFullPipeline (which could fabricate).
  // Always returns honest source-stamped data or explicit "unavailable".
  if (wo.intent.intent === 'query_finance') {
    const finResult = await handleFinanceQuery(req.raw_request);
    deliverWorkOrder(wo.request_id, {
      verdict: finResult.answered ? 'DELIVERED' : 'FAILED',
      summary: finResult.answered ? `Finance data from ${finResult.source_label}` : 'Finance data unavailable — no certified source',
      findings: [],
      fixed: [],
      tested: [],
      needs_approval: [],
      confidence_score: finResult.answered ? 85 : 0,
    });
    return {
      work_order_id: wo.request_id,
      ceo_message: finResult.ceo_message,
      status: finResult.answered ? 'delivered' : 'rejected',
      verdict: finResult.answered ? 'DELIVERED' : 'FAILED',
      confidence_score: finResult.answered ? 85 : 0,
      duration_ms: Date.now() - t0,
      handled: finResult.answered,
    };
  }

  // Phase 13: PM Agent — runs before any execution
  // Produces: objective, scope, acceptance criteria, effort estimate, risk score, workflow
  const pmPackage = runPmAgent(req.raw_request, wo.intent, wo.request_id);
  updateWoStatus(wo.request_id, 'assigned', {
    role: 'product_manager', level: 'info',
    message: `PM Brief: ${pmPackage.requirements.objective.slice(0, 80)} | Risk: ${pmPackage.risk.risk_level} (${pmPackage.risk.overall_risk_score}/100) | Proceed: ${pmPackage.proceed}`,
  });

  // Block execution if PM Agent rejects (conflicting scope or CRITICAL risk)
  if (!pmPackage.proceed && pmPackage.boundary.recommendation === 'REJECT') {
    return {
      work_order_id: wo.request_id,
      ceo_message: `🚫 *PM Agent — Yêu cầu bị từ chối*\n\n${pmPackage.pm_summary}`,
      status: 'rejected',
      verdict: 'FAILED',
      confidence_score: 0,
      pm_package: pmPackage,
      duration_ms: Date.now() - t0,
      handled: true,
    };
  }

  try {
    // Phase 2: resolve role via Role Registry
    const resolvedRole = getRoleForIntent(wo.intent.intent);
    const roleDef = getRole(resolvedRole);

    // Phase 3: resolve skills via Skill Registry
    const skillIds = getSkillsForIntent(wo.intent.intent);

    // Phase 4: classify each skill via Approval Engine
    const safeSkills: string[] = [];
    const approvalSkills: string[] = [];
    for (const sid of skillIds) {
      const approval = classify({ skill_id: sid, intent: wo.intent.intent, role_id: resolvedRole });
      if (approval.verdict === 'SAFE') safeSkills.push(sid);
      else approvalSkills.push(sid);
    }

    updateWoStatus(wo.request_id, 'assigned', {
      role: 'system', level: 'info',
      message: `Role: ${roleDef.name_vi} | Skills: ${safeSkills.join(',')} | Approval needed: ${approvalSkills.join(',') || 'none'} | Intent: ${wo.intent.intent}`,
    });

    // Route to appropriate pipeline
    const isQuickStatus = ['check_status', 'monitor_runtime'].includes(wo.intent.intent);

    // Security block: bypass/override commands are always rejected before any pipeline runs.
    if (wo.intent.intent === 'security_block') {
      deliverWorkOrder(wo.request_id, {
        verdict: 'FAILED',
        summary: 'Security block — approval bypass commands are not permitted',
        findings: [],
        fixed: [],
        tested: [],
        needs_approval: [],
        confidence_score: 0,
      });
      return {
        work_order_id: wo.request_id,
        ceo_message: '🔒 Lệnh này bị chặn. Hệ thống không cho phép bypass, skip hoặc override approval. Mọi tác vụ cần qua đúng luồng CEO approval.',
        status: 'rejected',
        verdict: 'FAILED',
        confidence_score: 0,
        pm_package: pmPackage,
        duration_ms: Date.now() - t0,
        handled: true,
      };
    }

    // Unknown intent: never run the full fabrication pipeline.
    // Return an honest clarification instead of a fake "CERTIFIED 90%" response.
    if (wo.intent.intent === 'unknown') {
      const clarification = buildUnknownIntentReply(req.raw_request, wo.request_id);
      deliverWorkOrder(wo.request_id, {
        verdict: 'FAILED',
        summary: 'Intent not recognized — clarification requested',
        findings: [],
        fixed: [],
        tested: [],
        needs_approval: [],
        confidence_score: 0,
      });
      return {
        work_order_id: wo.request_id,
        ceo_message: clarification,
        status: 'rejected',
        verdict: 'FAILED',
        confidence_score: 0,
        pm_package: pmPackage,
        duration_ms: Date.now() - t0,
        handled: false,   // signals caller that intent was not understood
      };
    }

    // Raw SEO publish fast-path: detected by build_feature + raw/seo keywords
    const isSeoPublish = wo.intent.intent === 'build_feature' &&
      /\b(raw|rawsushi|rawsushibar|seo|bai viet|bai seo|content|dang bai)\b/i.test(req.raw_request);

    let pipelineResult: GStackResponse;
    if (isSeoPublish) {
      pipelineResult = await runSeoPublishPipeline(wo, req);
    } else if (isQuickStatus) {
      pipelineResult = await runStatusPipeline(wo);
    } else {
      pipelineResult = await runFullPipeline(wo);
    }

    // Phase 13: attach PM package to all pipeline responses
    return { ...pipelineResult, pm_package: pmPackage };

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    updateWoStatus(wo.request_id, 'rejected', {
      role: 'system', level: 'error',
      message: `Pipeline error: ${msg.slice(0, 200)}`,
    });

    logAction({
      work_order_id: wo.request_id,
      requested_by: req.requested_by,
      agent_role: 'system',
      action_type: 'pipeline_error',
      target: 'gstack',
      evidence: msg.slice(0, 300),
      verdict: 'FAIL',
    });

    return {
      work_order_id: wo.request_id,
      ceo_message: `Em đang gặp lỗi khi xử lý yêu cầu "${req.raw_request.slice(0, 50)}". Đã ghi log work order ${wo.request_id} để anh kiểm tra.`,
      status: 'rejected',
      verdict: 'FAILED',
      confidence_score: 0,
      duration_ms: Date.now() - t0,
      handled: true,
    };
  }
}

// ── Compound request processor ────────────────────────────────────────────────

async function processCompoundRequest(
  req: GStackRequest,
  subIntents: SubIntent[],
  t0: number,
): Promise<GStackResponse> {
  // Create parent work order to track all children
  const parentWo = createWorkOrder({
    ...req,
    raw_request: `[COMPOUND] ${req.raw_request}`,
  });

  const results: Array<{ seq: number; text: string; response: GStackResponse }> = [];
  const completed = new Set<number>();

  // Execute sub-intents in dependency order (topological — simple sequential for now)
  for (const sub of subIntents) {
    // Wait for dependencies
    const allDepsDone = sub.depends_on.every(d => completed.has(d));
    if (!allDepsDone) {
      // Dependency not met — skip and mark as blocked
      results.push({
        seq: sub.sequence,
        text: sub.text,
        response: {
          work_order_id: `${parentWo.request_id}-S${sub.sequence}-BLOCKED`,
          ceo_message: `⚠️ Blocked — chờ task ${sub.depends_on.join(', ')} hoàn thành`,
          status: 'rejected',
          verdict: 'FAILED',
          confidence_score: 0,
          duration_ms: 0,
          handled: false,
        },
      });
      continue;
    }

    // Execute this sub-intent
    const subReq: GStackRequest = {
      raw_request: sub.text,
      requested_by: req.requested_by,
      source: req.source,
    };
    const subResult = await processGStackRequest(subReq);
    results.push({ seq: sub.sequence, text: sub.text, response: subResult });
    if (subResult.status !== 'rejected') completed.add(sub.sequence);
  }

  // Build combined CEO report
  const handledCount = results.filter(r => r.response.handled !== false && r.response.status !== 'rejected').length;
  const failedCount = results.filter(r => r.response.status === 'rejected').length;
  const totalCount = results.length;

  const childLines = results.map((r, i) => {
    const icon = r.response.status === 'delivered' ? '✅' : r.response.status === 'rejected' ? '❌' : '⏳';
    const label = `*${i + 1}. ${r.text.slice(0, 50)}${r.text.length > 50 ? '…' : ''}*`;
    // Extract the first non-header line of the sub-reply as summary
    const subMsg = r.response.ceo_message || '';
    const summary = subMsg.split('\n').find(l => l.trim() && !l.startsWith('📋') && !l.startsWith('─'))?.trim() ?? '';
    return `${icon} ${label}\n   ${summary.slice(0, 120)}`;
  });

  const overallVerdict = failedCount === 0 ? 'DELIVERED' : handledCount > 0 ? 'PARTIAL' : 'FAILED';
  const overallConfidence = results.reduce((sum, r) => sum + r.response.confidence_score, 0) / Math.max(results.length, 1);

  const ceoMessage = [
    `📋 *Compound Work Order — ${parentWo.request_id}*`,
    `*Yêu cầu:* "${req.raw_request.slice(0, 80)}${req.raw_request.length > 80 ? '…' : ''}"`,
    `*Tổng:* ${totalCount} tasks | ✅ ${handledCount} done | ❌ ${failedCount} failed`,
    ``,
    ...childLines,
    ``,
    `*Confidence:* ${Math.round(overallConfidence)}% | *Verdict:* ${overallVerdict}`,
  ].join('\n');

  deliverWorkOrder(parentWo.request_id, {
    verdict: overallVerdict,
    summary: `${handledCount}/${totalCount} sub-tasks completed`,
    findings: results.map(r => r.text.slice(0, 60)),
    fixed: [],
    tested: [],
    needs_approval: [],
    confidence_score: Math.round(overallConfidence),
  });

  return {
    work_order_id: parentWo.request_id,
    ceo_message: ceoMessage,
    status: overallVerdict === 'DELIVERED' ? 'delivered' : overallVerdict === 'PARTIAL' ? 'delivered' : 'rejected',
    verdict: overallVerdict,
    confidence_score: Math.round(overallConfidence),
    duration_ms: Date.now() - t0,
    handled: handledCount > 0,
  };
}

// ── Unknown intent: honest clarification (no fabrication) ────────────────────

function buildUnknownIntentReply(rawRequest: string, woId: string): string {
  const preview = rawRequest.slice(0, 80);

  // Try to suggest the closest known intent category
  const suggestions: string[] = [];
  if (/doanh thu|revenue|oanh|bán|ban hang|oanh thu/i.test(rawRequest)) {
    suggestions.push('📊 Dữ liệu doanh thu — cần kết nối QuickBooks hoặc POS (chưa sync)');
  }
  if (/ton kho|inventory|kho|hang ton|stock/i.test(rawRequest)) {
    suggestions.push('📦 Tồn kho — cần kết nối hệ thống POS/inventory (chưa có dữ liệu)');
  }
  if (/nhan vien|staff|maria|employee|nghi phep|leave/i.test(rawRequest)) {
    suggestions.push('👥 Nhân sự — cần kết nối HR system (chưa có connector)');
  }
  if (/lich|calendar|meeting|hop/i.test(rawRequest)) {
    suggestions.push('📅 Lịch họp — thử "kiểm tra lịch hôm nay" để dùng Google Calendar connector');
  }
  if (/email|gmail/i.test(rawRequest)) {
    suggestions.push('✉️ Email — thử "kiểm tra email hôm nay" để dùng Gmail connector');
  }
  if (/seo|bai viet|article|content/i.test(rawRequest)) {
    suggestions.push('✍️ Tạo nội dung SEO — thử "tạo bài SEO cho [chủ đề]" để trigger build_feature pipeline');
  }
  if (/qb|quickbooks|ke toan|accounting/i.test(rawRequest)) {
    suggestions.push('💼 QuickBooks — thử "kiểm tra QB sync" để check connector status');
  }

  const hint = suggestions.length > 0
    ? `\n\n💡 *Gợi ý:*\n${suggestions.join('\n')}`
    : '\n\n💡 *Thử:* "kiểm tra dashboard", "tạo báo cáo", "kiểm tra email", "tạo bài SEO [chủ đề]"';

  return [
    `❓ *Mi chưa hiểu yêu cầu này*`,
    ``,
    `*Anh hỏi:* "${preview}${rawRequest.length > 80 ? '…' : ''}"`,
    `*WO:* ${woId} | *Kết quả:* Không đủ dữ liệu để xử lý`,
    ``,
    `Mi không tự bịa kết quả. Nếu dữ liệu chưa có trong hệ thống, Mi sẽ nói thẳng.`,
    hint,
  ].join('\n');
}

// ── Quick scan (no work order) ────────────────────────────────────────────────

export async function quickScan(targetProject?: string) {
  return scanProject(targetProject);
}
