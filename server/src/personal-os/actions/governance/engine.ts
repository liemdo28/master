import { randomUUID } from 'crypto';
import { canonicalJson, payloadHash } from '../policy';
import type { ActionApproval, ActionProposal, ActionRiskClass } from '../types';
import { GovernanceAuditService } from './audit';
import { BudgetManager } from './budget';
import { KillSwitchService } from './kill-switch';
import { RiskEvaluator } from './risk';
import { GovernanceStore } from './store';
import type {
  ApprovalLevel,
  ContextualConstraints,
  PolicyDecision,
  PolicyDecisionResult,
  PolicyRule,
} from './types';

const RISK_RANK: Record<ActionRiskClass, number> = { R0: 0, R1: 1, R2: 2, R3: 3, R4: 4 };

export interface GovernanceEvaluationInput {
  proposal: ActionProposal;
  approval?: ActionApproval | null;
  stage: 'proposal' | 'approval' | 'execution' | 'simulation';
  actor?: string;
  context?: Partial<ContextualConstraints>;
}

export class ActionPolicyEngine {
  readonly store: GovernanceStore;
  readonly riskEvaluator = new RiskEvaluator();
  readonly budgetManager: BudgetManager;
  readonly killSwitch: KillSwitchService;
  readonly audit: GovernanceAuditService;

  constructor(db: import('better-sqlite3').Database) {
    this.store = new GovernanceStore(db);
    this.budgetManager = new BudgetManager(this.store);
    this.killSwitch = new KillSwitchService(this.store);
    this.audit = new GovernanceAuditService(this.store);
  }

  evaluate(input: GovernanceEvaluationInput): PolicyDecision {
    const policySet = this.store.activePolicySet();
    if (!policySet) throw new Error('missing active policy set');
    const proposal = input.proposal;
    const risk = this.riskEvaluator.assess(proposal);
    const killSwitchState = this.killSwitch.state({ projectId: proposal.projectId, actionType: proposal.actionType });
    const budgetState = this.budgetManager.state(proposal);
    const contextualConstraints = this.context(proposal, input.approval ?? null, input.context);
    const matchedPolicies: string[] = [];
    const deniedPolicies: string[] = [];
    const reasons: string[] = [...risk.factors, ...risk.warnings];
    let decision: PolicyDecisionResult = 'ALLOW';
    let approvalLevel: ApprovalLevel = 'NONE';

    const matchedRules = policySet.rules.filter(rule => matchesRule(rule, proposal, risk.riskClass));
    for (const rule of matchedRules) matchedPolicies.push(rule.id);

    const deny = matchedRules.find(rule => rule.effect === 'DENY');
    if (killSwitchState.blocked) {
      decision = 'BLOCK_KILL_SWITCH';
      approvalLevel = 'NONE';
      reasons.push('Kill switch is enabled for this action scope.');
      deniedPolicies.push('KILL_SWITCH');
    } else if (deny) {
      decision = 'DENY';
      approvalLevel = 'NONE';
      reasons.push(`Denied by policy rule ${deny.id}.`);
      deniedPolicies.push(deny.id);
    } else if (contextualConstraints.staleReasons.length > 0) {
      decision = 'BLOCK_CONTEXT';
      approvalLevel = 'NONE';
      reasons.push(...contextualConstraints.staleReasons);
      deniedPolicies.push('CONTEXT_DENY');
    } else if (budgetState.blocked) {
      decision = 'BLOCK_BUDGET';
      approvalLevel = 'NONE';
      reasons.push(budgetState.reason ?? 'Budget limit reached.');
      deniedPolicies.push('BUDGET_LIMIT');
    } else {
      const strongRule = matchedRules.find(rule => rule.effect === 'REQUIRE_STRONG_APPROVAL' || rule.approvalLevel === 'STRONG');
      const standardRule = matchedRules.find(rule => rule.effect === 'REQUIRE_APPROVAL' || rule.approvalLevel === 'STANDARD');
      if (risk.requiresStrongApproval || strongRule) {
        decision = 'REQUIRE_STRONG_APPROVAL';
        approvalLevel = 'STRONG';
        reasons.push(strongRule ? `Strong approval required by ${strongRule.id}.` : 'Strong approval required by deterministic risk assessment.');
      } else if (standardRule) {
        decision = 'REQUIRE_APPROVAL';
        approvalLevel = 'STANDARD';
        reasons.push(`Standard approval required by ${standardRule.id}.`);
      }
    }

    const evaluatedAt = new Date().toISOString();
    const inputHash = payloadHash({
      proposalId: proposal.id,
      actionType: proposal.actionType,
      projectId: proposal.projectId,
      payloadHash: proposal.payloadHash,
      approvalId: input.approval?.id ?? null,
      stage: input.stage,
      policyVersion: policySet.version,
      context: contextualConstraints,
      budgetState,
      killSwitchState,
      risk,
    });
    const unsigned = {
      proposalId: proposal.id,
      actionType: proposal.actionType,
      projectId: proposal.projectId,
      riskClass: risk.riskClass,
      decision,
      requiredApprovalLevel: approvalLevel,
      reasons,
      matchedPolicies,
      deniedPolicies,
      budgetState,
      killSwitchState,
      contextualConstraints,
      evaluatedAt,
      policyVersion: policySet.version,
      inputHash,
      evidenceReferences: proposal.evidenceReferences,
    };
    const decisionHash = payloadHash(unsigned);
    const saved = this.store.savePolicyDecision({
      ...unsigned,
      id: `decision-${randomUUID()}`,
      decisionHash,
    });
    this.audit.recordDecision(eventTypeFor(saved.decision), saved, input.actor ?? 'system', { stage: input.stage });
    return saved;
  }

  assertExecutionAllowed(decision: PolicyDecision, approval: ActionApproval): void {
    if (!['ALLOW', 'REQUIRE_APPROVAL', 'REQUIRE_STRONG_APPROVAL'].includes(decision.decision)) {
      throw new Error(`policy blocked execution: ${decision.decision}`);
    }
    if (decision.requiredApprovalLevel === 'STRONG' && !isStrongAcknowledgement(approval.riskAcknowledgement, decision)) {
      throw new Error('strong approval confirmation is required');
    }
    if (decision.requiredApprovalLevel === 'DUAL_CONFIRMATION') {
      throw new Error('dual confirmation is not enabled for Phase 5G actions');
    }
  }

  private context(proposal: ActionProposal, approval: ActionApproval | null, overrides: Partial<ContextualConstraints> = {}): ContextualConstraints {
    const proposalExpired = new Date(proposal.expiresAt).getTime() <= Date.now();
    const approvalExpired = approval ? new Date(approval.expiresAt).getTime() <= Date.now() : false;
    const constraints: ContextualConstraints = {
      proposalExpired,
      approvalExpired,
      projectRegistered: proposal.projectId ? overrides.projectRegistered ?? true : true,
      projectArchived: overrides.projectArchived ?? false,
      personalOsSchemaHealthy: overrides.personalOsSchemaHealthy ?? true,
      providerCapabilityAvailable: overrides.providerCapabilityAvailable ?? true,
      policyVersionCurrent: overrides.policyVersionCurrent ?? true,
      serviceHealthy: overrides.serviceHealthy ?? true,
      staleReasons: [],
    };
    if (proposalExpired) constraints.staleReasons.push('Proposal expired.');
    if (approvalExpired) constraints.staleReasons.push('Approval expired.');
    if (!constraints.projectRegistered) constraints.staleReasons.push('Project is not registered.');
    if (constraints.projectArchived) constraints.staleReasons.push('Project is archived.');
    if (!constraints.personalOsSchemaHealthy) constraints.staleReasons.push('Personal OS schema is not healthy.');
    if (!constraints.providerCapabilityAvailable) constraints.staleReasons.push('Provider capability is unavailable.');
    if (!constraints.policyVersionCurrent) constraints.staleReasons.push('Policy version is stale.');
    if (!constraints.serviceHealthy) constraints.staleReasons.push('Relevant service is unhealthy.');
    return constraints;
  }
}

export function isStrongAcknowledgement(value: string, decision: Pick<PolicyDecision, 'proposalId' | 'decisionHash'>): boolean {
  const text = String(value || '').trim();
  return text.includes(`CONFIRM:${decision.proposalId}`) && /[a-f0-9]{12}/i.test(text);
}

function matchesRule(rule: PolicyRule, proposal: ActionProposal, riskClass: ActionRiskClass): boolean {
  if (!rule.enabled) return false;
  const now = Date.now();
  if (rule.validFrom && new Date(rule.validFrom).getTime() > now) return false;
  if (rule.validUntil && new Date(rule.validUntil).getTime() <= now) return false;
  if (rule.actionTypes.length && !rule.actionTypes.includes(proposal.actionType)) return false;
  if (rule.projects.length && (!proposal.projectId || !rule.projects.includes(proposal.projectId))) return false;
  if (rule.riskClasses.length && !rule.riskClasses.includes(riskClass)) return false;
  const forbiddenKeywords = Array.isArray(rule.conditions.forbiddenKeywords) ? rule.conditions.forbiddenKeywords.map(String) : [];
  if (forbiddenKeywords.length) {
    const haystack = canonicalJson({ actionType: proposal.actionType, operation: proposal.requestedOperation, payload: proposal.normalizedPayload }).toLowerCase();
    return forbiddenKeywords.some(keyword => haystack.includes(keyword.toLowerCase()));
  }
  if (rule.conditions.actionTypes && Array.isArray(rule.conditions.actionTypes)) {
    return rule.conditions.actionTypes.map(String).includes(proposal.actionType);
  }
  if (RISK_RANK[riskClass] >= 4 && rule.riskClasses.includes('R4')) return true;
  return true;
}

function eventTypeFor(decision: PolicyDecisionResult): string {
  if (decision === 'ALLOW' || decision === 'REQUIRE_APPROVAL' || decision === 'REQUIRE_STRONG_APPROVAL') return 'policy.allowed';
  if (decision === 'BLOCK_BUDGET') return 'policy.budget.blocked';
  if (decision === 'BLOCK_CONTEXT') return 'policy.context.blocked';
  if (decision === 'BLOCK_KILL_SWITCH') return 'kill_switch.enabled';
  return 'policy.denied';
}
