/**
 * Risk Prediction Engine — Phase 13.6
 * Predicts deployment, dependency, blocker, and approval risks before execution.
 */

import type { IntentResult } from '../intent-router';
import type { RequirementPackage } from './requirement-analysis';
import type { EffortEstimate } from './effort-estimation';

// ── Types ──────────────────────────────────────────────────────────────────────

export type RiskLevel = 'SAFE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface Risk {
  type: 'DEPLOYMENT' | 'DEPENDENCY' | 'BLOCKER' | 'APPROVAL' | 'DATA' | 'REGRESSION';
  description: string;
  score: number;          // 0–100 for this risk type
  mitigation: string;
}

export interface RiskAssessment {
  overall_risk_score: number;    // 0–100
  risk_level: RiskLevel;
  deployment_risk: number;
  dependency_risk: number;
  blocker_risk: number;
  approval_risk: number;
  risks: Risk[];
  safe_to_proceed: boolean;
  recommendation: string;
  recommended_workflow: string[];
}

// ── Risk scoring ───────────────────────────────────────────────────────────────

function deploymentRisk(intent: IntentResult, effort: EffortEstimate): number {
  let score = 0;
  if (intent.intent === 'deploy_release') score += 60;
  if (intent.intent === 'fix_bug') score += 25;
  if (intent.intent === 'rollback') score += 40;
  if (effort.size === 'LARGE') score += 15;
  if (effort.size === 'CRITICAL') score += 25;
  if (effort.complexity === 'HIGH') score += 10;
  if (effort.complexity === 'CRITICAL') score += 20;
  return Math.min(100, score);
}

function dependencyRisk(intent: IntentResult, req: RequirementPackage): number {
  let score = 20; // baseline — all requests have some dependency risk
  if (intent.target_project === 'dashboard') score += 10; // depends on mi-core
  if (req.scope.length >= 3) score += 15; // wide scope = more deps
  if (req.assumptions.some(a => /pm2|port 4001/i.test(a))) score += 5;
  if (intent.intent === 'build_feature') score += 20;
  return Math.min(100, score);
}

function blockerRisk(intent: IntentResult, req: RequirementPackage): number {
  let score = 0;
  if (req.risks.some(r => /approval/i.test(r))) score += 30;
  if (intent.requires_approval) score += 35;
  if (intent.intent === 'deploy_release') score += 20;
  if (req.constraints.some(c => /ceo.*approve/i.test(c))) score += 15;
  return Math.min(100, score);
}

function approvalRisk(intent: IntentResult): number {
  if (!intent.requires_approval && intent.risk_level === 1) return 5;
  if (intent.risk_level === 2) return 30;
  if (intent.risk_level === 3) return 70;
  return 10;
}

function overallRisk(dep: number, dependency: number, blocker: number, approval: number): number {
  // Weighted average: deployment 40%, blocker 30%, approval 20%, dependency 10%
  return Math.round(dep * 0.4 + blocker * 0.3 + approval * 0.2 + dependency * 0.1);
}

function riskLevelFromScore(score: number): RiskLevel {
  if (score >= 75) return 'CRITICAL';
  if (score >= 55) return 'HIGH';
  if (score >= 35) return 'MEDIUM';
  if (score >= 15) return 'LOW';
  return 'SAFE';
}

// ── Risk catalogue ─────────────────────────────────────────────────────────────

function buildRisks(intent: IntentResult, req: RequirementPackage, effort: EffortEstimate): Risk[] {
  const risks: Risk[] = [];
  const raw = req.raw_request.toLowerCase();

  if (intent.intent === 'deploy_release') {
    risks.push({ type: 'DEPLOYMENT', description: 'Production deployment — service downtime possible', score: 60, mitigation: 'Run health check pre/post deploy; have rollback ready' });
  }

  if (intent.intent === 'fix_bug' || raw.includes('fix')) {
    risks.push({ type: 'REGRESSION', description: 'Bug fix may introduce regression in adjacent code', score: 35, mitigation: 'Run regression suite after fix; compare pre/post evidence' });
  }

  if (intent.requires_approval || intent.risk_level >= 2) {
    risks.push({ type: 'APPROVAL', description: 'CEO approval required — pipeline blocks until approved', score: approvalRisk(intent), mitigation: 'Queue approval request early; notify CEO via WhatsApp' });
  }

  if (req.scope.length >= 3 || raw.includes('dashboard')) {
    risks.push({ type: 'DEPENDENCY', description: 'Dashboard depends on mi-core API being online', score: 25, mitigation: 'Verify mi-core health before dashboard audit' });
  }

  if (raw.includes('fix') && !raw.includes('test') && !raw.includes('kiem tra')) {
    risks.push({ type: 'BLOCKER', description: 'Post-fix test not explicitly requested — may miss regressions', score: 20, mitigation: 'Mi will automatically run regression suite after any fix' });
  }

  if (effort.size === 'LARGE' || effort.size === 'CRITICAL') {
    risks.push({ type: 'BLOCKER', description: 'Large scope — execution time may exceed 10 minutes', score: 30, mitigation: 'Split into phases; report progress to CEO at each milestone' });
  }

  return risks;
}

// ── Workflow recommendation ────────────────────────────────────────────────────

function recommendWorkflow(intent: IntentResult, req: RequirementPackage, riskLevel: RiskLevel): string[] {
  const raw = req.raw_request.toLowerCase();
  const isMultiPhase = raw.includes('fix') && (raw.includes('kiem tra') || raw.includes('test') || raw.includes('bao cao'));

  if (isMultiPhase) {
    return [
      '1. PM Agent → Scope & Criteria',
      '2. Audit (health + source_scan + pm2_status + dashboard_audit)',
      '3. Safety gate → "if safe then fix"',
      '4. Auto-fix (SAFE boundary only)',
      '5. Regression suite',
      '6. QA Certification',
      '7. CEO Report',
    ];
  }

  const workflows: Record<string, string[]> = {
    audit_project: ['1. PM Agent', '2. Skills: health + source_scan + pm2_status + dashboard_audit', '3. QA Certification', '4. CEO Report'],
    fix_bug: ['1. PM Agent', '2. Diagnosis scan', '3. Auto-fix (SAFE)', '4. Build check', '5. Regression suite', '6. CEO Report'],
    deploy_release: ['1. PM Agent', '2. Pre-deploy validation', '3. CEO approval', '4. PM2 restart', '5. Post-deploy health', '6. CEO Report'],
    check_status: ['1. Health check', '2. PM2 status', '3. CEO Report'],
    build_feature: ['1. PM Agent', '2. Knowledge research', '3. Development', '4. Build check', '5. Regression suite', '6. CEO review', '7. Deploy'],
  };

  return workflows[intent.intent] || ['1. PM Agent', '2. Execute', '3. QA', '4. CEO Report'];
}

// ── Main API ──────────────────────────────────────────────────────────────────

export function predictRisk(intent: IntentResult, req: RequirementPackage, effort: EffortEstimate): RiskAssessment {
  const dep = deploymentRisk(intent, effort);
  const dependency = dependencyRisk(intent, req);
  const blocker = blockerRisk(intent, req);
  const approval = approvalRisk(intent);
  const overall = overallRisk(dep, dependency, blocker, approval);
  const level = riskLevelFromScore(overall);

  const risks = buildRisks(intent, req, effort);
  const workflow = recommendWorkflow(intent, req, level);

  const recommendation = level === 'SAFE' || level === 'LOW'
    ? '✅ An toàn để thực thi — không cần thêm xác nhận'
    : level === 'MEDIUM'
    ? '⚠️ Rủi ro trung bình — Mi sẽ thực thi với monitoring chặt chẽ'
    : level === 'HIGH'
    ? '🔴 Rủi ro cao — cần CEO xác nhận trước khi thực thi'
    : '🚨 Rủi ro nghiêm trọng — KHÔNG thực thi, cần CEO review toàn bộ kế hoạch';

  return {
    overall_risk_score: overall,
    risk_level: level,
    deployment_risk: dep,
    dependency_risk: dependency,
    blocker_risk: blocker,
    approval_risk: approval,
    risks,
    safe_to_proceed: level !== 'CRITICAL',
    recommendation,
    recommended_workflow: workflow,
  };
}
