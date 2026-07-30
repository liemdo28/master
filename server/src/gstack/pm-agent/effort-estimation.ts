/**
 * Effort Estimation Engine — Phase 13.5
 * Estimates size, duration, complexity, and confidence for a CEO request.
 */

import type { IntentResult } from '../intent-router';
import type { RequirementPackage } from './requirement-analysis';

// ── Types ──────────────────────────────────────────────────────────────────────

export type EffortSize = 'SMALL' | 'MEDIUM' | 'LARGE' | 'CRITICAL';
export type Complexity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface EffortEstimate {
  size: EffortSize;
  estimated_duration_min: number;
  complexity: Complexity;
  confidence: number;          // 0–100
  rationale: string;
  skill_count: number;         // estimated number of skills needed
  phase_count: number;         // number of execution phases
  breakdown: PhaseEstimate[];
}

export interface PhaseEstimate {
  phase: string;
  duration_min: number;
  skills: string[];
}

// ── Complexity scoring ─────────────────────────────────────────────────────────

function scoreComplexity(intent: IntentResult, req: RequirementPackage): number {
  let score = 0;

  // Intent base complexity
  const intentComplexity: Record<string, number> = {
    check_status: 1,
    monitor_runtime: 1,
    search_knowledge: 1,
    create_report: 2,
    audit_project: 3,
    fix_bug: 4,
    build_feature: 6,
    deploy_release: 7,
    rollback: 5,
    unknown: 2,
  };
  score += intentComplexity[intent.intent] || 2;

  // Multi-phase bonus (audit + fix + test = multi-phase)
  if (req.scope.length >= 3) score += 2;
  if (req.deliverables.length >= 4) score += 1;
  if (req.risks.length >= 2) score += 1;

  // Approval required = more coordination overhead
  if (intent.requires_approval) score += 2;

  // Risk level
  score += intent.risk_level * 1.5;

  return score;
}

function complexityFromScore(score: number): Complexity {
  if (score >= 12) return 'CRITICAL';
  if (score >= 8)  return 'HIGH';
  if (score >= 5)  return 'MEDIUM';
  return 'LOW';
}

function sizeFromComplexity(complexity: Complexity, phaseCount: number): EffortSize {
  if (complexity === 'CRITICAL') return 'CRITICAL';
  if (complexity === 'HIGH' || phaseCount >= 3) return 'LARGE';
  if (complexity === 'MEDIUM' || phaseCount >= 2) return 'MEDIUM';
  return 'SMALL';
}

// ── Phase breakdown ────────────────────────────────────────────────────────────

const PHASE_LIBRARY: Record<string, PhaseEstimate[]> = {
  audit_project: [
    { phase: 'Health & Status Check', duration_min: 1, skills: ['health', 'pm2_status'] },
    { phase: 'Source & Log Scan', duration_min: 2, skills: ['source_scan', 'log_scan'] },
    { phase: 'Dashboard Audit', duration_min: 2, skills: ['dashboard_audit'] },
    { phase: 'QA Certification', duration_min: 1, skills: ['regression_suite'] },
  ],
  fix_bug: [
    { phase: 'Diagnosis Scan', duration_min: 2, skills: ['source_scan', 'log_scan', 'health'] },
    { phase: 'Auto-Fix Application', duration_min: 3, skills: ['build_check'] },
    { phase: 'Post-Fix Validation', duration_min: 2, skills: ['regression_suite', 'health'] },
    { phase: 'QA Certification', duration_min: 1, skills: ['build_check'] },
  ],
  deploy_release: [
    { phase: 'Pre-Deploy Validation', duration_min: 3, skills: ['build_check', 'regression_suite', 'health'] },
    { phase: 'CEO Approval Wait', duration_min: 0, skills: [] },
    { phase: 'Deployment', duration_min: 2, skills: ['pm2_restart'] },
    { phase: 'Post-Deploy Health', duration_min: 2, skills: ['health', 'pm2_status', 'dashboard_audit'] },
  ],
  check_status: [
    { phase: 'Status Check', duration_min: 1, skills: ['health', 'pm2_status'] },
  ],
  monitor_runtime: [
    { phase: 'Runtime Monitor', duration_min: 1, skills: ['health', 'pm2_status', 'log_scan'] },
  ],
  build_feature: [
    { phase: 'Knowledge Research', duration_min: 2, skills: ['knowledge_search'] },
    { phase: 'Development', duration_min: 10, skills: ['build_check'] },
    { phase: 'Testing', duration_min: 3, skills: ['regression_suite'] },
    { phase: 'CEO Review', duration_min: 0, skills: [] },
  ],
  create_report: [
    { phase: 'Data Collection', duration_min: 2, skills: ['health', 'source_scan', 'dashboard_audit'] },
    { phase: 'Report Generation', duration_min: 1, skills: ['knowledge_search'] },
  ],
};

const DEFAULT_PHASES: PhaseEstimate[] = [
  { phase: 'Execution', duration_min: 3, skills: ['health', 'source_scan'] },
  { phase: 'QA', duration_min: 1, skills: ['regression_suite'] },
];

// ── Duration from duration hints in text ───────────────────────────────────────

function durationMultiplier(raw_request: string): number {
  const n = raw_request.toLowerCase();
  if (/ngay bay gio|immediately|asap|khẩn cấp/i.test(n)) return 0.8; // user expects fast
  if (/toan bo|tat ca|everything|all.*components/i.test(n)) return 1.5; // wider scope
  return 1.0;
}

// ── Main API ──────────────────────────────────────────────────────────────────

export function estimateEffort(intent: IntentResult, req: RequirementPackage): EffortEstimate {
  const complexityScore = scoreComplexity(intent, req);
  const complexity = complexityFromScore(complexityScore);

  const phases = PHASE_LIBRARY[intent.intent] || DEFAULT_PHASES;
  const phaseCount = phases.length;

  // Is this a multi-phase pipeline? (audit + fix + test = more phases)
  const raw = req.raw_request.toLowerCase();
  const isMultiPhase = raw.includes('fix') && (raw.includes('kiem tra') || raw.includes('test'));
  const effectivePhases = isMultiPhase && phases.length < 4
    ? [...phases, { phase: 'Post-Fix Regression', duration_min: 2, skills: ['regression_suite', 'build_check'] }]
    : phases;

  const baseDuration = effectivePhases.reduce((sum, p) => sum + p.duration_min, 0);
  const mult = durationMultiplier(req.raw_request);
  const estimatedDuration = Math.round(baseDuration * mult);

  const size = sizeFromComplexity(complexity, effectivePhases.length);
  const skillCount = [...new Set(effectivePhases.flatMap(p => p.skills))].length;

  // Confidence: higher when intent is clear, lower for complex/multi-phase
  const confidence = Math.min(95, Math.max(50,
    90 - (complexityScore * 3) + (intent.confidence > 80 ? 10 : 0)
  ));

  const rationale = [
    `Intent: ${intent.intent} (confidence: ${intent.confidence}%)`,
    `Phases: ${effectivePhases.length} | Skills: ${skillCount}`,
    `Complexity score: ${Math.round(complexityScore)} → ${complexity}`,
    isMultiPhase ? 'Multi-phase pipeline detected (audit → fix → test)' : '',
  ].filter(Boolean).join(' | ');

  return {
    size,
    estimated_duration_min: estimatedDuration,
    complexity,
    confidence,
    rationale,
    skill_count: skillCount,
    phase_count: effectivePhases.length,
    breakdown: effectivePhases,
  };
}
