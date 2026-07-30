/**
 * Scope Boundary Engine — Phase 13.4
 * Detects scope creep, ambiguous requests, conflicting objectives, and missing requirements.
 */

import type { IntentResult } from '../intent-router';

// ── Types ──────────────────────────────────────────────────────────────────────

export type ScopeClarity = 'CLEAR' | 'AMBIGUOUS' | 'MISSING';
export type BoundaryRecommendation = 'PROCEED' | 'CLARIFY' | 'REJECT';

export interface ScopeBoundaryResult {
  scope_clarity: ScopeClarity;
  detected_creep: string[];           // items that are likely out-of-scope
  missing_requirements: string[];     // things the request doesn't define
  conflicts: string[];                // contradictory objectives
  recommendation: BoundaryRecommendation;
  clarification_questions: string[];  // questions to ask CEO if CLARIFY
  reasons: string[];                  // why the boundary was flagged
}

// ── Ambiguity patterns ─────────────────────────────────────────────────────────

const AMBIGUOUS_PATTERNS: Array<{ pattern: RegExp; label: string; question: string }> = [
  { pattern: /fix everything|fix all|sua tat ca|fix het/i, label: 'Scope undefined: "fix everything"', question: 'Anh muốn fix những lỗi cụ thể nào? Hay chỉ các lỗi trong phạm vi Dashboard?' },
  { pattern: /update all|update everything|cap nhat tat ca/i, label: 'Scope undefined: "update all"', question: 'Anh muốn update component nào? Frontend, backend hay cả hai?' },
  { pattern: /check everything|kiem tra tat ca/i, label: 'Overscoped: "check everything"', question: 'Anh muốn kiểm tra project nào? Dashboard, mi-core hay toàn bộ hệ thống?' },
  { pattern: /improve|nang cap|optimize|toi uu/i, label: 'Vague objective: "improve/optimize"', question: 'Anh muốn cải thiện khía cạnh nào? Performance, code quality hay user experience?' },
  { pattern: /asap|ngay bay gio|immediately|khẩn cấp/i, label: 'Urgency without scope', question: 'Phần nào là ưu tiên cao nhất cần xử lý ngay?' },
];

// ── Scope creep detection ──────────────────────────────────────────────────────

const CREEP_PAIRS: Array<{ trigger: RegExp; creep: string }> = [
  { trigger: /dashboard/i, creep: 'WhatsApp routing changes not mentioned but may be affected' },
  { trigger: /fix.*loi|fix.*bug/i, creep: 'Refactoring unrelated code while fixing bug' },
  { trigger: /deploy/i, creep: 'Upgrading dependencies as part of deployment' },
  { trigger: /source.*scan|scan.*source/i, creep: 'Automatically fixing all TODO comments (beyond audit scope)' },
];

// ── Missing requirement detection ──────────────────────────────────────────────

const MISSING_REQ_RULES: Array<{ intent_match: string[]; check: RegExp; missing: string }> = [
  { intent_match: ['deploy_release'], check: /rollback|revert|hoan tac/, missing: 'Rollback plan not specified — required for deploy_release' },
  { intent_match: ['fix_bug'], check: /test|kiem tra lai|regression/, missing: 'Post-fix test verification not mentioned' },
  { intent_match: ['build_feature'], check: /test|acceptance|verify/, missing: 'Acceptance test criteria not specified' },
  { intent_match: ['deploy_release', 'fix_bug'], check: /approve|xac nhan|confirm/, missing: 'CEO approval flow not mentioned for risk_level ≥ 2 operation' },
];

// ── Conflict detection ─────────────────────────────────────────────────────────

const CONFLICT_RULES: Array<{ patterns: RegExp[]; conflict: string }> = [
  { patterns: [/fix.*loi/, /khong thay doi|no changes|readonly/], conflict: 'Contradictory: "fix bugs" + "no changes" — cannot fix without modification' },
  { patterns: [/deploy/, /rollback/], conflict: 'Contradictory: deploy + rollback in same request — clarify which direction' },
  { patterns: [/tự động|auto/, /ceo.*approve|cần.*approve/], conflict: 'Contradictory: "auto execute" + "needs approval" — approval required for this intent' },
];

// ── Main API ──────────────────────────────────────────────────────────────────

export function analyzeScopeBoundary(raw_request: string, intent: IntentResult): ScopeBoundaryResult {
  const n = raw_request.toLowerCase();
  const detected_creep: string[] = [];
  const missing_requirements: string[] = [];
  const conflicts: string[] = [];
  const clarification_questions: string[] = [];
  const reasons: string[] = [];

  // 1. Check ambiguity
  let hasAmbiguity = false;
  for (const a of AMBIGUOUS_PATTERNS) {
    if (a.pattern.test(raw_request)) {
      hasAmbiguity = true;
      reasons.push(a.label);
      clarification_questions.push(a.question);
    }
  }

  // 2. Scope creep
  for (const cp of CREEP_PAIRS) {
    if (cp.trigger.test(raw_request)) detected_creep.push(cp.creep);
  }

  // 3. Missing requirements
  for (const mr of MISSING_REQ_RULES) {
    if (mr.intent_match.includes(intent.intent) && !mr.check.test(n)) {
      missing_requirements.push(mr.missing);
    }
  }

  // 4. Conflicts
  for (const cr of CONFLICT_RULES) {
    if (cr.patterns.every(p => p.test(n))) conflicts.push(cr.conflict);
  }

  // 5. Derive recommendation
  let recommendation: BoundaryRecommendation = 'PROCEED';
  let scope_clarity: ScopeClarity = 'CLEAR';

  if (conflicts.length > 0) {
    recommendation = 'REJECT';
    scope_clarity = 'MISSING';
    reasons.push(`${conflicts.length} conflicting objective(s) detected`);
  } else if (hasAmbiguity && clarification_questions.length > 0) {
    recommendation = 'CLARIFY';
    scope_clarity = 'AMBIGUOUS';
  } else if (missing_requirements.length > 1) {
    // Multiple missing requirements — warn but proceed
    scope_clarity = 'AMBIGUOUS';
    reasons.push(`${missing_requirements.length} missing requirements — will use defaults`);
  }

  return {
    scope_clarity,
    detected_creep,
    missing_requirements,
    conflicts,
    recommendation,
    clarification_questions,
    reasons,
  };
}
