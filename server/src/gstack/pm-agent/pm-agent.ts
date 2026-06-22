/**
 * PM Agent — Phase 13.1
 * Orchestrates all PM sub-engines: requirement analysis → scope boundary →
 * acceptance criteria → effort estimation → risk prediction → PM report.
 *
 * Runs BEFORE the Work Order Engine creates tasks.
 * Output (PMPackage) is attached to the Work Order and consumed by all downstream agents.
 */

import type { IntentResult } from '../intent-router';
import { analyzeRequirements, type RequirementPackage } from './requirement-analysis';
import { analyzeScopeBoundary, type ScopeBoundaryResult } from './scope-boundary';
import { generateAcceptanceCriteria, formatCriteriaForCeo, type AcceptanceCriteriaPackage } from './acceptance-criteria';
import { estimateEffort, type EffortEstimate } from './effort-estimation';
import { predictRisk, type RiskAssessment } from './risk-prediction';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface PMPackage {
  request_id: string;
  generated_at: string;

  requirements: RequirementPackage;
  boundary: ScopeBoundaryResult;
  criteria: AcceptanceCriteriaPackage;
  effort: EffortEstimate;
  risk: RiskAssessment;

  pm_summary: string;        // WhatsApp-ready PM brief for CEO
  pm_brief: string;          // Markdown PM report (full)
  proceed: boolean;          // false = REJECT or CLARIFY needed
  proceed_reason: string;
}

// ── PM Summary builder ─────────────────────────────────────────────────────────

function buildPmSummary(pkg: Omit<PMPackage, 'pm_summary' | 'pm_brief' | 'proceed' | 'proceed_reason'>): string {
  const { requirements: req, boundary, criteria, effort, risk } = pkg;
  const lines: string[] = [];

  const riskIcon = risk.risk_level === 'SAFE' ? '🟢' : risk.risk_level === 'LOW' ? '🟡' : risk.risk_level === 'MEDIUM' ? '🟠' : '🔴';

  lines.push(`📋 *PM Brief — ${req.request_id}*`);
  lines.push('');
  lines.push(`*🎯 Business Goal:*`);
  lines.push(req.objective);
  lines.push('');

  lines.push(`*📦 Scope:*`);
  req.scope.slice(0, 3).forEach(s => lines.push(`• ${s}`));
  lines.push('');

  lines.push(`*🚫 Out of Scope:*`);
  req.out_of_scope.slice(0, 3).forEach(s => lines.push(`• ${s}`));
  lines.push('');

  lines.push(`*✅ Acceptance Criteria (${criteria.total} total, ${criteria.blocking_count} blocking):*`);
  criteria.criteria.filter(c => c.blocking).slice(0, 4).forEach(c =>
    lines.push(`🔴 ${c.description}`)
  );
  if (criteria.criteria.filter(c => !c.blocking).length > 0) {
    criteria.criteria.filter(c => !c.blocking).slice(0, 2).forEach(c =>
      lines.push(`🟡 ${c.description}`)
    );
  }
  lines.push('');

  lines.push(`*⏱ Effort Estimate:*`);
  lines.push(`• Size: ${effort.size} | ${effort.estimated_duration_min} phút`);
  lines.push(`• Phases: ${effort.phase_count} | Skills: ${effort.skill_count}`);
  lines.push(`• Confidence: ${effort.confidence}%`);
  lines.push('');

  lines.push(`*${riskIcon} Risk Score: ${risk.overall_risk_score}/100 (${risk.risk_level})*`);
  if (risk.risks.length > 0) {
    risk.risks.slice(0, 2).forEach(r => lines.push(`• [${r.type}] ${r.description.slice(0, 60)}`));
  }
  lines.push('');

  lines.push(`*🗺 Recommended Workflow:*`);
  risk.recommended_workflow.forEach(w => lines.push(w));
  lines.push('');

  if (boundary.recommendation === 'CLARIFY') {
    lines.push(`*❓ Cần làm rõ:*`);
    boundary.clarification_questions.forEach(q => lines.push(`• ${q}`));
  } else {
    lines.push(risk.recommendation);
  }

  return lines.join('\n');
}

function buildPmBrief(pkg: Omit<PMPackage, 'pm_summary' | 'pm_brief' | 'proceed' | 'proceed_reason'>): string {
  const { requirements: req, boundary, criteria, effort, risk } = pkg;
  const now = new Date().toISOString().slice(0, 10);

  return [
    `# PM Brief — ${req.request_id}`,
    `**Date:** ${now}  `,
    `**Risk Level:** ${risk.risk_level} (${risk.overall_risk_score}/100)  `,
    `**Effort:** ${effort.size} — ${effort.estimated_duration_min} min  `,
    `**Proceed:** ${boundary.recommendation}`,
    '',
    '## CEO Request',
    `> ${req.raw_request}`,
    '',
    '## Business Objective',
    req.objective,
    '',
    '## Scope',
    ...req.scope.map(s => `- ${s}`),
    '',
    '## Out of Scope',
    ...req.out_of_scope.map(s => `- ${s}`),
    '',
    '## Acceptance Criteria',
    ...criteria.criteria.map(c => `- [${c.gate}] ${c.blocking ? '🔴' : '🟡'} ${c.description} → \`${c.measurement}\``),
    '',
    '## Effort Estimate',
    `**Size:** ${effort.size}  `,
    `**Duration:** ~${effort.estimated_duration_min} minutes  `,
    `**Complexity:** ${effort.complexity}  `,
    `**Confidence:** ${effort.confidence}%  `,
    `**Phases:** ${effort.phase_count} | **Skills:** ${effort.skill_count}  `,
    '',
    '### Phase Breakdown',
    ...effort.breakdown.map(p => `- ${p.phase}: ~${p.duration_min}min — skills: [${p.skills.join(', ')}]`),
    '',
    '## Risk Assessment',
    `**Overall Risk:** ${risk.overall_risk_score}/100 (${risk.risk_level})  `,
    `**Deployment Risk:** ${risk.deployment_risk}/100  `,
    `**Dependency Risk:** ${risk.dependency_risk}/100  `,
    `**Blocker Risk:** ${risk.blocker_risk}/100  `,
    `**Approval Risk:** ${risk.approval_risk}/100  `,
    '',
    '### Risk Items',
    ...risk.risks.map(r => `- [${r.type}] ${r.description} → ${r.mitigation}`),
    '',
    '## Recommended Workflow',
    ...risk.recommended_workflow.map(w => `${w}`),
    '',
    '## Stakeholders',
    ...req.stakeholders.map(s => `- ${s}`),
    '',
    '## Assumptions',
    ...req.assumptions.map(a => `- ${a}`),
    '',
    '## Constraints',
    ...req.constraints.map(c => `- ${c}`),
    '',
    boundary.recommendation !== 'PROCEED' ? '## ⚠️ Scope Issues' : '',
    boundary.recommendation !== 'PROCEED' ? `**Recommendation:** ${boundary.recommendation}` : '',
    ...boundary.clarification_questions.map(q => `- ${q}`),
    ...boundary.missing_requirements.map(r => `- Missing: ${r}`),
    '',
    '---',
    `*Generated by PM Agent — Phase 13 — ${new Date().toISOString()}*`,
  ].filter(l => l !== undefined).join('\n');
}

// ── Main API ──────────────────────────────────────────────────────────────────

export function runPmAgent(raw_request: string, intent: IntentResult, requestId: string): PMPackage {
  // 1. Requirement Analysis
  const requirements = analyzeRequirements(raw_request, intent, requestId);

  // 2. Scope Boundary
  const boundary = analyzeScopeBoundary(raw_request, intent);

  // 3. Acceptance Criteria
  const criteria = generateAcceptanceCriteria(intent, requirements);

  // 4. Effort Estimation
  const effort = estimateEffort(intent, requirements);

  // 5. Risk Prediction
  const risk = predictRisk(intent, requirements, effort);

  // 6. Proceed decision
  const proceed = boundary.recommendation !== 'REJECT' && risk.safe_to_proceed;
  const proceed_reason = !proceed
    ? boundary.recommendation === 'REJECT'
      ? `Scope conflicts: ${boundary.conflicts.join('; ')}`
      : `Risk level CRITICAL (${risk.overall_risk_score}/100) — requires CEO review`
    : boundary.recommendation === 'CLARIFY'
    ? `CLARIFY recommended but proceeding with defaults — ${boundary.clarification_questions.length} open question(s)`
    : 'All checks pass — safe to execute';

  const partial: Omit<PMPackage, 'pm_summary' | 'pm_brief' | 'proceed' | 'proceed_reason'> = {
    request_id: requestId,
    generated_at: new Date().toISOString(),
    requirements,
    boundary,
    criteria,
    effort,
    risk,
  };

  return {
    ...partial,
    pm_summary: buildPmSummary(partial),
    pm_brief: buildPmBrief(partial),
    proceed,
    proceed_reason,
  };
}

export type { RequirementPackage, ScopeBoundaryResult, AcceptanceCriteriaPackage, EffortEstimate, RiskAssessment };
