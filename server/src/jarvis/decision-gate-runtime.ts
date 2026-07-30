/**
 * P3 — Decision Gate Runtime
 *
 * Routes every CEO message to one of 6 outcomes.
 * EXECUTE must be LEAST frequent.
 *
 * Outcomes (in priority order):
 *   1. ACKNOWLEDGE — CEO stated a fact → confirm receipt
 *   2. REPORT      — CEO asked about status → return data
 *   3. UPDATE      — CEO provided new context → update memory
 *   4. CLARIFY     — ambiguous input → ask what they mean
 *   5. APPROVAL    — action needs CEO sign-off → request approval
 *   6. EXECUTE     — run a workflow/action → least frequent
 *
 * Rule: ACTION_NOT_DEFAULT — execute only when explicitly triggered.
 */

import { detectStatement, type StatementType } from './statement-detector';
import { classifyEvidence, type EvidenceGateInput, type EvidenceClassification } from './evidence-gate-runtime';

// ── Types ─────────────────────────────────────────────────────────────────────

export type DecisionOutcome =
  | 'ACKNOWLEDGE'
  | 'REPORT'
  | 'UPDATE'
  | 'CLARIFY'
  | 'APPROVAL'
  | 'EXECUTE';

export interface DecisionGateResult {
  outcome: DecisionOutcome;
  evidence: EvidenceClassification;
  confidence: number;      // 0-100
  reasoning: string;
  should_block_workflow: boolean;
}

// ── Pattern detectors ─────────────────────────────────────────────────────────

function norm(text: string): string {
  return text.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Explicit action triggers — only these lead to EXECUTE
const EXECUTE_PATTERNS: RegExp[] = [
  // Direct creation commands
  /\b(tao|tao|create|build|implement|viet|write|design|generate)\b.*\b(bai|post|flyer|banner|report|file|code|script|api|module)\b/i,
  // Direct action verbs with targets
  /\b(deploy|push|release|rollback|revert|send|gui|email|post|publish|submit)\b/i,
  // Audit + fix pipeline
  /\b(audit|kiem\s*tra|check|scan|review)\b.*\b(fix|sua|patch|resolve)\b/i,
  // Workflow triggers
  /\b(chay|run|execute|thuc\s*hien|khoi\s*dong|start)\b.*\b(workflow|pipeline|process)\b/i,
  // COO commands
  /\b(coo|autonomous)\b/i,
];

// Report/data queries
const REPORT_PATTERNS: RegExp[] = [
  // Status queries
  /\b(sao|the\s*nao|status|tinh\s*hinh|trang\s*thai|bao\s*cao|report|summary|overview)\b/i,
  // "co gi" / "co gi khong" queries
  /\b(co\s*gi|co\s*khong|co\s*ai|co\s*nao|bao\s*nhieu|bao\s*nhieu)\b/i,
  // Location queries
  /\b(o\s*dau|where|location|link|url)\b/i,
  // Health/status checks
  /\b(check|kiem\s*tra|xem|coi|check)\b.*\b(service|server|pm2|process|health|incident)\b/i,
];

// Temporal update patterns
const UPDATE_PATTERNS: RegExp[] = [
  /\b(la|là)\b.*\b(tuan|thang|hom|ngay|gio)\b/i,
  /\b(dang|vua|moi|se\s+sap)\b.*\b(lam|xu\s*ly|fix|deploy|check|handle)\b/i,
];

// Clarification triggers
const CLARIFY_PATTERNS: RegExp[] = [
  /^(ha|sao|k|why|tai\s*sao|y\s*nghia|nghia\s*la)\??$/i,
];

// Approval needed
const APPROVAL_PATTERNS: RegExp[] = [
  /\b(can\s*duyet|can\s*approval|need\s*approval|chua\s*duyet|pending)\b/i,
  /\b(deploy|release|push|send|gui|publish)\b.*\b(production|prod|live|public)\b/i,
];

// ── Core decision function ────────────────────────────────────────────────────

export function classifyDecision(
  rawText: string,
  evidenceInput?: EvidenceGateInput,
): DecisionGateResult {
  const text = rawText.trim();
  const n = norm(text);

  // Step 1: Check if it's a statement → ACKNOWLEDGE
  const statement = detectStatement(text);
  if (statement.is_statement) {
    const evidence: EvidenceClassification = {
      state: 'CONFIRMED',
      source: 'acknowledge_engine',
      freshness_minutes: 0,
      confidence: 100,
      reason: `Statement detected: ${statement.type}`,
      requires_disclaimer: false,
    };
    return {
      outcome: 'ACKNOWLEDGE',
      evidence,
      confidence: 100,
      reasoning: `CEO statement (type: ${statement.type}) → acknowledge only`,
      should_block_workflow: true,
    };
  }

  // Step 2: Check for ambiguous single-word inputs → CLARIFY
  for (const pat of CLARIFY_PATTERNS) {
    if (pat.test(text) || pat.test(n)) {
      const evidence: EvidenceClassification = {
        state: 'CONFIRMED',
        source: 'conversation_context',
        freshness_minutes: 0,
        confidence: 100,
        reason: 'Ambiguous input — clarification needed',
        requires_disclaimer: false,
      };
      return {
        outcome: 'CLARIFY',
        evidence,
        confidence: 95,
        reasoning: `Ambiguous input "${text.slice(0, 20)}" → ask for clarification`,
        should_block_workflow: true,
      };
    }
  }

  // Step 3: Evidence classification for data queries
  let evidence: EvidenceClassification;
  if (evidenceInput) {
    evidence = classifyEvidence(evidenceInput);
  } else {
    evidence = {
      state: 'UNCONFIRMED',
      source: 'pending',
      freshness_minutes: null,
      confidence: 50,
      reason: 'No evidence input provided — defaulting to UNCONFIRMED',
      requires_disclaimer: false,
    };
  }

  // Step 4: Check for EXECUTE (must be explicit)
  for (const pat of EXECUTE_PATTERNS) {
    if (pat.test(n) || pat.test(text)) {
      // Even with execute trigger, check if it needs approval first
      for (const ap of APPROVAL_PATTERNS) {
        if (ap.test(n) || ap.test(text)) {
          return {
            outcome: 'APPROVAL',
            evidence,
            confidence: 90,
            reasoning: `Action requires CEO approval before execution`,
            should_block_workflow: false,
          };
        }
      }
      return {
        outcome: 'EXECUTE',
        evidence,
        confidence: 85,
        reasoning: `Explicit action trigger detected → execute pipeline`,
        should_block_workflow: false,
      };
    }
  }

  // Step 5: Check for REPORT queries
  for (const pat of REPORT_PATTERNS) {
    if (pat.test(n) || pat.test(text)) {
      return {
        outcome: 'REPORT',
        evidence,
        confidence: 85,
        reasoning: `Status/data query detected → return report`,
        should_block_workflow: false,
      };
    }
  }

  // Step 6: Check for UPDATE (temporal context)
  for (const pat of UPDATE_PATTERNS) {
    if (pat.test(n) || pat.test(text)) {
      return {
        outcome: 'UPDATE',
        evidence,
        confidence: 80,
        reasoning: `Context update detected → update conversation memory`,
        should_block_workflow: true,
      };
    }
  }

  // Step 7: Default → CLARIFY (not execute!)
  // This is the critical change: default is NEVER execute
  return {
    outcome: 'CLARIFY',
    evidence,
    confidence: 40,
    reasoning: `No clear intent detected → ask CEO what they need`,
    should_block_workflow: true,
  };
}

// ── Outcome formatters ────────────────────────────────────────────────────────

export function formatDecisionResponse(result: DecisionGateResult, context?: string): string {
  switch (result.outcome) {
    case 'ACKNOWLEDGE':
      return '';  // statement-detector already provides the reply
    case 'REPORT':
      return context || 'Em đang lấy dữ liệu...';
    case 'UPDATE':
      return 'Đã ghi nhận. Em cập nhật context.';
    case 'CLARIFY':
      return context
        ? `Anh muốn em làm gì với "${context.slice(0, 40)}"?`
        : 'Anh muốn em làm gì ạ?';
    case 'APPROVAL':
      return context || '⏳ Hành động này cần anh approve trước khi thực hiện.';
    case 'EXECUTE':
      return context || 'Em đang thực hiện...';
    default:
      return 'Anh muốn em giúp gì?';
  }
}

// ── Metrics ───────────────────────────────────────────────────────────────────

const outcomeCounts: Record<DecisionOutcome, number> = {
  ACKNOWLEDGE: 0,
  REPORT: 0,
  UPDATE: 0,
  CLARIFY: 0,
  APPROVAL: 0,
  EXECUTE: 0,
};

let totalDecisions = 0;

export function recordDecision(outcome: DecisionOutcome): void {
  outcomeCounts[outcome]++;
  totalDecisions++;
}

export function getDecisionMetrics(): {
  total: number;
  by_outcome: Record<DecisionOutcome, number>;
  execute_rate: number;
  acknowledge_rate: number;
  action_not_default: boolean;
} {
  return {
    total: totalDecisions,
    by_outcome: { ...outcomeCounts },
    execute_rate: totalDecisions > 0 ? (outcomeCounts.EXECUTE / totalDecisions) * 100 : 0,
    acknowledge_rate: totalDecisions > 0 ? (outcomeCounts.ACKNOWLEDGE / totalDecisions) * 100 : 0,
    action_not_default: totalDecisions > 0
      ? outcomeCounts.EXECUTE < outcomeCounts.ACKNOWLEDGE
        && outcomeCounts.EXECUTE < outcomeCounts.REPORT
      : true,
  };
}

export function resetMetrics(): void {
  for (const k of Object.keys(outcomeCounts) as DecisionOutcome[]) {
    outcomeCounts[k] = 0;
  }
  totalDecisions = 0;
}
