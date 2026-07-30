/**
 * Executive Brief Generator — Phase 21G
 * Compresses complexity into CEO-ready briefs.
 *
 * NEVER dumps raw logs or technical noise.
 * ALWAYS: What changed → Why it matters → Risks → Actions → Confidence
 */

import { IntentAnalysis } from './executive-intent-engine';
import { ExecutionPlan } from './executive-planner';
import { ReflectionResult } from './executive-reflection';
import { BusinessAnalysis } from './business-reasoning-engine';
import { DecisionMatrix } from './executive-decision-engine';
import { ContextSnapshot } from './executive-memory-layer';

// ── Types ─────────────────────────────────────────────────────────────────────

export type BriefType = 'quick_status' | 'full_analysis' | 'emergency' | 'strategic' | 'incident_report';

export interface BriefSection {
  title: string;
  content: string;
  priority: 'must_read' | 'should_read' | 'optional';
}

export interface ExecutiveBrief {
  id: string;
  type: BriefType;
  generated_at: string;
  title_vi: string;
  sections: BriefSection[];
  what_changed: string;
  why_it_matters: string;
  risks: string[];
  recommended_actions: string[];
  confidence: number;
  formatted_whatsapp: string;   // ready-to-send WhatsApp message
  formatted_markdown: string;   // detailed markdown version
}

// ── Brief generation from various inputs ───────────────────────────────────────

let briefCounter = 0;

function generateBriefId(): string {
  briefCounter++;
  return `brief-${Date.now()}-${briefCounter}`;
}

export function generateQuickStatusBrief(
  snapshot: ContextSnapshot,
): ExecutiveBrief {
  const sections: BriefSection[] = [];
  const risks: string[] = [];
  const actions: string[] = [];

  // Section: Company Status
  sections.push({
    title: 'Tình trạng công ty',
    content: snapshot.summary,
    priority: 'must_read',
  });

  // Section: Department Health
  if (Object.keys(snapshot.department_health).length > 0) {
    const deptLines = Object.entries(snapshot.department_health)
      .map(([dept, score]) => `• ${dept}: ${score}/100`)
      .join('\n');
    sections.push({
      title: 'Sức khỏe bộ phận',
      content: deptLines,
      priority: 'should_read',
    });
  }

  // Risks
  if (snapshot.active_incidents > 0) {
    risks.push(`${snapshot.active_incidents} sự cố đang active`);
    actions.push('Xử lý sự cố đang chờ');
  }
  if (snapshot.open_risks > 0) {
    risks.push(`${snapshot.open_risks} rủi ro đang mở`);
    actions.push('Review và mitigate rủi ro');
  }

  const statusIcon = snapshot.overall_status === 'healthy' ? '✅' :
    snapshot.overall_status === 'warning' ? '⚠️' : '🔴';

  const title = `${statusIcon} Tổng quan nhanh`;

  return buildBrief({
    type: 'quick_status',
    title_vi: title,
    sections,
    what_changed: snapshot.summary,
    why_it_matters: `Tình trạng tổng thể: ${snapshot.overall_status}`,
    risks,
    recommended_actions: actions,
    confidence: 0.8,
  });
}

export function generateFullAnalysisBrief(
  intent: IntentAnalysis,
  plan: ExecutionPlan,
  reflection: ReflectionResult,
  businessAnalysis?: BusinessAnalysis,
  decisionMatrix?: DecisionMatrix,
): ExecutiveBrief {
  const sections: BriefSection[] = [];

  // Section 1: Intent
  sections.push({
    title: '🎯 Phân tích ý định',
    content: [
      `CEO muốn: ${intent.primary_intent.label_vi}`,
      `Confidence: ${Math.round(intent.primary_intent.confidence * 100)}%`,
      intent.is_ambiguous ? '⚠️ Tin nhắn mơ hồ — đã phân tích nhiều giả thuyết' : '',
      intent.alternatives.length > 0
        ? `Giá thay thế: ${intent.alternatives.map(a => a.label_vi).join(', ')}`
        : '',
    ].filter(Boolean).join('\n'),
    priority: 'must_read',
  });

  // Section 2: Plan
  sections.push({
    title: '📋 Kế hoạch',
    content: [
      `${plan.title}`,
      `${plan.total_steps} bước, ước tính ~${Math.ceil(plan.estimated_total_seconds / 60)} phút`,
      ...plan.steps.map(s => `  ⬜ Step ${s.order}: ${s.title}`),
    ].join('\n'),
    priority: 'must_read',
  });

  // Section 3: Reflection
  sections.push({
    title: '🔍 Phản chiếu (Reflection)',
    content: [
      `Confidence: ${Math.round(reflection.overall_confidence * 100)}% (${reflection.confidence_level})`,
      `Evidence quality: ${reflection.evidence_quality}`,
      reflection.assumptions.length > 0
        ? `Assumptions: ${reflection.assumptions.map(a => a.description).join('; ')}`
        : '',
      reflection.missing_evidence.length > 0
        ? `Missing: ${reflection.missing_evidence.join('; ')}`
        : '',
    ].filter(Boolean).join('\n'),
    priority: 'should_read',
  });

  // Section 4: Business Analysis (if available)
  if (businessAnalysis) {
    const topHyp = businessAnalysis.hypotheses.slice(0, 3);
    sections.push({
      title: '📊 Phân tích kinh doanh',
      content: [
        `Signal: ${businessAnalysis.signal.type} (${businessAnalysis.signal.magnitude}%)`,
        ...topHyp.map(h => `• ${h.title_vi} (${Math.round(h.probability_score * 100)}%) — ${h.description}`),
        `Top action: ${businessAnalysis.top_3_actions[0] || 'N/A'}`,
      ].join('\n'),
      priority: 'should_read',
    });
  }

  // Section 5: Decision Matrix (if available)
  if (decisionMatrix) {
    sections.push({
      title: '🎯 Ma trận quyết định',
      content: decisionMatrix.summary,
      priority: 'should_read',
    });
  }

  // Risks from reflection
  const risks = reflection.risks.map(r => r.description);
  if (reflection.alternative_explanations.length > 0) {
    risks.push(`${reflection.alternative_explanations.length} giải thích thay thế tồn tại`);
  }

  // Actions
  const actions = businessAnalysis?.top_3_actions || [];
  if (reflection.recommendation_to_ceo.urgency === 'needs_more_info') {
    actions.unshift('⚠️ Cần thêm thông tin trước khi quyết định');
  }

  return buildBrief({
    type: 'full_analysis',
    title_vi: `📊 Phân tích đầy đủ — ${intent.primary_intent.label_vi}`,
    sections,
    what_changed: intent.raw_message,
    why_it_matters: `CEO concern: ${intent.primary_intent.label_vi} | Confidence: ${Math.round(reflection.overall_confidence * 100)}%`,
    risks,
    recommended_actions: actions,
    confidence: reflection.overall_confidence,
  });
}

export function generateEmergencyBrief(
  intent: IntentAnalysis,
  findings: string[],
  immediateActions: string[],
): ExecutiveBrief {
  const sections: BriefSection[] = [];

  sections.push({
    title: '🚨 EMERGENCY',
    content: [
      `Intent: ${intent.primary_intent.label_vi}`,
      ...findings.map(f => `• ${f}`),
    ].join('\n'),
    priority: 'must_read',
  });

  sections.push({
    title: '⚡ HÀNH ĐỘNG NGAY',
    content: immediateActions.map((a, i) => `${i + 1}. ${a}`).join('\n'),
    priority: 'must_read',
  });

  return buildBrief({
    type: 'emergency',
    title_vi: '🚨 CAN THIỆP KHẨN CẤP',
    sections,
    what_changed: findings.join('; '),
    why_it_matters: 'Tình huống khẩn cấp cần hành động ngay',
    risks: findings,
    recommended_actions: immediateActions,
    confidence: 0.7,
  });
}

// ── Builder ────────────────────────────────────────────────────────────────────

interface BriefParams {
  type: BriefType;
  title_vi: string;
  sections: BriefSection[];
  what_changed: string;
  why_it_matters: string;
  risks: string[];
  recommended_actions: string[];
  confidence: number;
}

function buildBrief(params: BriefParams): ExecutiveBrief {
  const id = generateBriefId();

  // WhatsApp format (concise)
  const whatsappLines: string[] = [
    `*${params.title_vi}*`,
    '',
  ];

  for (const section of params.sections) {
    if (section.priority === 'must_read' || section.priority === 'should_read') {
      whatsappLines.push(`*${section.title}*`);
      whatsappLines.push(section.content);
      whatsappLines.push('');
    }
  }

  if (params.risks.length > 0) {
    whatsappLines.push('⚠️ *Risks:*');
    for (const r of params.risks) {
      whatsappLines.push(`• ${r}`);
    }
    whatsappLines.push('');
  }

  if (params.recommended_actions.length > 0) {
    whatsappLines.push('👉 *Actions:*');
    for (const a of params.recommended_actions) {
      whatsappLines.push(`• ${a}`);
    }
    whatsappLines.push('');
  }

  whatsappLines.push(`📊 Confidence: ${Math.round(params.confidence * 100)}%`);

  // Markdown format (detailed)
  const markdownLines: string[] = [
    `# ${params.title_vi}`,
    '',
    `> Generated: ${new Date().toISOString()} | Type: ${params.type}`,
    '',
    '## What Changed',
    params.what_changed,
    '',
    '## Why It Matters',
    params.why_it_matters,
    '',
  ];

  for (const section of params.sections) {
    markdownLines.push(`## ${section.title}`);
    markdownLines.push(section.content);
    markdownLines.push('');
  }

  if (params.risks.length > 0) {
    markdownLines.push('## Risks');
    for (const r of params.risks) {
      markdownLines.push(`- ${r}`);
    }
    markdownLines.push('');
  }

  if (params.recommended_actions.length > 0) {
    markdownLines.push('## Recommended Actions');
    for (const a of params.recommended_actions) {
      markdownLines.push(`1. ${a}`);
    }
    markdownLines.push('');
  }

  markdownLines.push(`## Confidence: ${Math.round(params.confidence * 100)}%`);

  return {
    id,
    type: params.type,
    generated_at: new Date().toISOString(),
    title_vi: params.title_vi,
    sections: params.sections,
    what_changed: params.what_changed,
    why_it_matters: params.why_it_matters,
    risks: params.risks,
    recommended_actions: params.recommended_actions,
    confidence: params.confidence,
    formatted_whatsapp: whatsappLines.join('\n'),
    formatted_markdown: markdownLines.join('\n'),
  };
}
