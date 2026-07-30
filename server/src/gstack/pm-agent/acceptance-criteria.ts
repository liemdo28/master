/**
 * Acceptance Criteria Engine — Phase 13.3
 * Generates measurable, gate-linked acceptance criteria for each request.
 */

import type { IntentResult } from '../intent-router';
import type { RequirementPackage } from './requirement-analysis';

// ── Types ──────────────────────────────────────────────────────────────────────

export type CriteriaGate = 'G1' | 'G2' | 'G3' | 'G4' | 'G5' | 'BUSINESS';
export type CriteriaStatus = 'PASS' | 'FAIL' | 'PENDING';

export interface AcceptanceCriterion {
  id: string;
  description: string;
  measurable: boolean;
  gate: CriteriaGate;
  measurement: string;      // how to verify: e.g. "health_check.ok === true"
  blocking: boolean;        // if false, failure → WARN not FAIL
}

export interface AcceptanceCriteriaPackage {
  request_id: string;
  generated_at: string;
  criteria: AcceptanceCriterion[];
  total: number;
  blocking_count: number;
}

// ── Criteria libraries per intent ──────────────────────────────────────────────

const CRITERIA_LIBRARY: Record<string, AcceptanceCriterion[]> = {
  audit_project: [
    { id: 'AC-A1', description: 'Không có lỗi P0 (hệ thống sập hoặc crash loop)', measurable: true, gate: 'G3', measurement: 'p0_defects === 0', blocking: true },
    { id: 'AC-A2', description: 'Không có lỗi P1 (service offline > 2 phút)', measurable: true, gate: 'G3', measurement: 'p1_defects === 0', blocking: true },
    { id: 'AC-A3', description: 'Evidence package được tạo (health_check.json + source_scan.log)', measurable: true, gate: 'G2', measurement: 'evidence_files.length >= 2', blocking: true },
    { id: 'AC-A4', description: 'QA confidence score ≥ 70%', measurable: true, gate: 'G4', measurement: 'confidence >= 70', blocking: true },
    { id: 'AC-A5', description: 'Báo cáo CEO được tạo và gửi', measurable: true, gate: 'BUSINESS', measurement: 'ceo_report_delivered === true', blocking: false },
  ],

  fix_bug: [
    { id: 'AC-F1', description: 'Fix nằm trong auto-fix boundary (không phải schema, prod data, hay deps)', measurable: true, gate: 'G5', measurement: 'auto_fix_boundary_check === PASS', blocking: true },
    { id: 'AC-F2', description: 'TypeScript build sau fix: 0 errors', measurable: true, gate: 'G1', measurement: 'tsc_errors === 0', blocking: true },
    { id: 'AC-F3', description: 'Regression suite ≥ 80% pass sau fix', measurable: true, gate: 'G4', measurement: 'regression_pass_rate >= 0.8', blocking: true },
    { id: 'AC-F4', description: 'Không có lỗi P0 mới sau fix', measurable: true, gate: 'G3', measurement: 'new_p0_defects === 0', blocking: true },
    { id: 'AC-F5', description: 'Evidence trước và sau fix được lưu', measurable: true, gate: 'G2', measurement: 'before_after_evidence === true', blocking: false },
  ],

  deploy_release: [
    { id: 'AC-D1', description: 'CEO đã approve deployment', measurable: true, gate: 'G5', measurement: 'ceo_approval_granted === true', blocking: true },
    { id: 'AC-D2', description: 'Build clean — 0 TypeScript errors', measurable: true, gate: 'G1', measurement: 'tsc_errors === 0', blocking: true },
    { id: 'AC-D3', description: 'Regression suite ≥ 80% pass pre-deploy', measurable: true, gate: 'G4', measurement: 'regression_pass_rate >= 0.8', blocking: true },
    { id: 'AC-D4', description: 'Health check PASS post-deploy', measurable: true, gate: 'G2', measurement: 'post_deploy_health === true', blocking: true },
    { id: 'AC-D5', description: 'Rollback plan documented', measurable: true, gate: 'G5', measurement: 'rollback_plan_ready === true', blocking: true },
  ],

  check_status: [
    { id: 'AC-S1', description: 'Tất cả PM2 processes có status online', measurable: true, gate: 'G1', measurement: 'pm2_all_online === true', blocking: true },
    { id: 'AC-S2', description: 'Health check PASS (HTTP 200)', measurable: true, gate: 'G2', measurement: 'health_check.ok === true', blocking: false },
    { id: 'AC-S3', description: 'Không có process restart > 50 lần', measurable: true, gate: 'G3', measurement: 'max_restarts <= 50', blocking: false },
  ],

  build_feature: [
    { id: 'AC-B1', description: 'Feature hoạt động đúng theo acceptance test', measurable: true, gate: 'G1', measurement: 'feature_acceptance_test === PASS', blocking: true },
    { id: 'AC-B2', description: 'TypeScript build clean — 0 errors', measurable: true, gate: 'G1', measurement: 'tsc_errors === 0', blocking: true },
    { id: 'AC-B3', description: 'Regression suite không bị ảnh hưởng (≥ 80%)', measurable: true, gate: 'G4', measurement: 'regression_pass_rate >= 0.8', blocking: true },
    { id: 'AC-B4', description: 'CEO review và approve trước khi merge', measurable: true, gate: 'G5', measurement: 'ceo_review_approved === true', blocking: true },
  ],
};

const DEFAULT_CRITERIA: AcceptanceCriterion[] = [
  { id: 'AC-GEN1', description: 'Không có lỗi P0', measurable: true, gate: 'G3', measurement: 'p0_defects === 0', blocking: true },
  { id: 'AC-GEN2', description: 'Evidence được tạo', measurable: true, gate: 'G2', measurement: 'evidence_files.length >= 1', blocking: true },
  { id: 'AC-GEN3', description: 'QA hoàn tất', measurable: true, gate: 'G4', measurement: 'qa_completed === true', blocking: false },
  { id: 'AC-GEN4', description: 'Báo cáo được gửi cho CEO', measurable: true, gate: 'BUSINESS', measurement: 'ceo_report_delivered === true', blocking: false },
];

// ── Scope-derived extra criteria ───────────────────────────────────────────────

function extraCriteriaFromScope(req: RequirementPackage): AcceptanceCriterion[] {
  const extras: AcceptanceCriterion[] = [];

  // Multi-phase pipeline detection (audit + fix + test + report)
  const raw = req.raw_request.toLowerCase();
  const isMultiPhase = raw.includes('fix') && (raw.includes('kiem tra') || raw.includes('test'));

  if (isMultiPhase) {
    extras.push({
      id: 'AC-MP1',
      description: 'Fix chỉ áp dụng nếu audit PASS (an toàn)',
      measurable: true,
      gate: 'G5',
      measurement: 'audit_safe_before_fix === true',
      blocking: true,
    });
    extras.push({
      id: 'AC-MP2',
      description: 'Test lại sau fix — regression không được giảm',
      measurable: true,
      gate: 'G4',
      measurement: 'post_fix_regression >= pre_fix_regression',
      blocking: true,
    });
  }

  return extras;
}

// ── Main API ──────────────────────────────────────────────────────────────────

export function generateAcceptanceCriteria(intent: IntentResult, req: RequirementPackage): AcceptanceCriteriaPackage {
  const base = CRITERIA_LIBRARY[intent.intent] || DEFAULT_CRITERIA;
  const extras = extraCriteriaFromScope(req);
  const criteria = [...base, ...extras];

  return {
    request_id: req.request_id,
    generated_at: new Date().toISOString(),
    criteria,
    total: criteria.length,
    blocking_count: criteria.filter(c => c.blocking).length,
  };
}

export function formatCriteriaForCeo(pkg: AcceptanceCriteriaPackage): string {
  const lines = ['*Acceptance Criteria:*'];
  for (const c of pkg.criteria) {
    const icon = c.blocking ? '🔴' : '🟡';
    lines.push(`${icon} ${c.description}`);
    lines.push(`   → ${c.measurement}`);
  }
  return lines.join('\n');
}
