/**
 * approval-policy-selector.ts — decide the approval gate for a workflow step.
 *
 * Read-only analysis runs auto; anything that writes to a production system or
 * spends money requires a human approval token (Phase 2D / 2D+). Unsafe actions
 * are never auto — that is the safety invariant.
 */

export type ApprovalGate = 'auto' | 'standard' | 'production_token';

export interface ApprovalDecision {
  step: string;
  gate: ApprovalGate;
  reason: string;
  requiresHuman: boolean;
}

const PRODUCTION_WRITE = /publish|launch|post|update menu|send|charge|refund|deploy|pay|order/;
const ANALYSIS = /analy|review|audit|baseline|inspect|report|check|monitor/;

export function selectApprovalPolicy(stepTitle: string, touchesProduction = false): ApprovalDecision {
  const lc = stepTitle.toLowerCase();
  if (touchesProduction || PRODUCTION_WRITE.test(lc)) {
    return { step: stepTitle, gate: 'production_token', reason: 'writes to a production system / spends money → Phase 2D+ token required', requiresHuman: true };
  }
  if (ANALYSIS.test(lc)) {
    return { step: stepTitle, gate: 'auto', reason: 'read-only analysis → safe to auto-run', requiresHuman: false };
  }
  return { step: stepTitle, gate: 'standard', reason: 'mutating but non-production → standard human approval', requiresHuman: true };
}
