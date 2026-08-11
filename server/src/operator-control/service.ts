import path from 'path';
import { TaskStore } from '../task-runtime/store';
import { PersonalOsStore } from '../personal-os/store';
import { ControlledActionStore } from '../personal-os/actions/store';
import { GovernanceStore } from '../personal-os/actions/governance/store';
import { OrchestrationStore } from '../personal-os/orchestration/store';
import { DelegationStore } from '../personal-os/delegation/store';
import { DELEGATION_ELIGIBLE_ACTION_TYPES } from '../personal-os/delegation/types';
import { generateAuthorityManifest } from '../authority-control-plane/scanner';
import { legacyMutationSurfaces } from '../authority-control-plane/legacy-adapter';
import { sanitizeRecord, sanitizeText } from './redaction';
import type { ActionProposal, ActionType } from '../personal-os/actions/types';
import type { PolicyDecision } from '../personal-os/actions/governance/types';
import type { DelegatedAuthority } from '../personal-os/delegation/types';
import type { ActionPlan, ActionPlanStep } from '../personal-os/orchestration/types';
import type {
  EffectiveAuthorityAction, OperatorAuthoritySummary, OperatorAuthorityView,
  OperatorBlockedReason, OperatorControlSnapshot, OperatorItem, OperatorItemState,
  OperatorRiskSummary, OperatorServiceOptions, OperatorSourceType, OperatorUrgency,
  OperatorOverview,
} from './types';

const FROZEN_EXTERNAL_WRITES: ActionType[] = ['GMAIL_CREATE_DRAFT', 'CALENDAR_EVENT_PROPOSAL', 'CALENDAR_CREATE_EVENT'];
const FORBIDDEN_ACTIONS = new Set(['GMAIL_SEND_DRAFT', 'PURCHASE', 'PAYMENT', 'AUTONOMOUS_DEPLOY', 'AUTONOMOUS_MERGE', 'GENERIC_MUTATION']);
const WAITING_STATES = new Set(['WAITING_APPROVAL', 'DRAFT']);
const BLOCKING_ACTION_STATUSES = new Set(['FAILED', 'RECOVERY_REQUIRED', 'EXPIRED']);
const BLOCKING_PLAN_STATUSES = new Set(['PAUSED', 'FAILED']);
const BLOCKING_STEP_STATUSES = new Set(['BLOCKED', 'FAILED', 'RECONCILIATION_REQUIRED']);

export class OperatorControlService {
  private taskStore: TaskStore;
  private personalStore: PersonalOsStore;
  private actionStore: ControlledActionStore;
  private governanceStore: GovernanceStore;
  private orchestrationStore: OrchestrationStore;
  private delegationStore: DelegationStore;
  private repoRoot: string;
  private now: () => Date;

  constructor(options: OperatorServiceOptions = {}) {
    this.repoRoot = options.repoRoot ?? path.resolve(__dirname, '../..');
    this.now = options.now ?? (() => new Date());
    this.taskStore = new TaskStore(options.taskRuntimeRoot);
    this.personalStore = new PersonalOsStore(options.personalOsRoot);
    this.actionStore = new ControlledActionStore(options.personalOsRoot);
    this.governanceStore = new GovernanceStore(this.actionStore.handle);
    this.orchestrationStore = new OrchestrationStore(options.personalOsRoot);
    this.delegationStore = new DelegationStore(options.personalOsRoot);
  }

  close(): void {
    this.delegationStore.close();
    this.orchestrationStore.close();
    this.actionStore.close();
    this.personalStore.close();
    this.taskStore.close();
  }

  snapshot(): OperatorControlSnapshot {
    const items = dedupeOperatorItems([
      ...this.taskItems(),
      ...this.knowledgeItems(),
      ...this.controlledActionItems(),
      ...this.planItems(),
      ...this.delegationItems(),
      ...this.authorityItems(),
    ]);
    const authority = this.authorityView();
    const pending = items.filter(item => item.state === 'WAITING_ON_OPERATOR');
    const blocked = items.filter(item => ['BLOCKED', 'QUARANTINED'].includes(item.state));
    const attention = items.filter(item => ['EXPIRING', 'NEEDS_ATTENTION'].includes(item.state));
    return { overview: this.overview(items, authority), pending, blocked, attention, authority, items };
  }

  overview(items = this.snapshot().items, authority = this.authorityView()): OperatorOverview {
    const counts = countStates(items);
    const pendingBySource = emptySourceCounts();
    for (const item of items) if (item.state === 'WAITING_ON_OPERATOR') pendingBySource[item.sourceType] += 1;
    return {
      generatedAt: this.now().toISOString(),
      counts,
      pendingBySource,
      criticalCount: items.filter(item => item.urgency === 'CRITICAL').length,
      expiringCount: items.filter(item => item.state === 'EXPIRING').length,
      legacyQuarantinedCount: authority.legacy.quarantinedLegacy,
      authority,
    };
  }

  pending(): OperatorItem[] { return this.snapshot().pending; }
  blocked(): OperatorItem[] { return this.snapshot().blocked; }
  authority(): OperatorAuthorityView { return this.authorityView(); }
  item(id: string): OperatorItem | null { return this.snapshot().items.find(item => item.id === id) ?? null; }

  private taskItems(): OperatorItem[] {
    return this.taskStore.listTasks().filter(task => ['WAITING_APPROVAL', 'BLOCKED'].includes(task.status)).map(task => {
      const state: OperatorItemState = task.status === 'WAITING_APPROVAL' ? 'WAITING_ON_OPERATOR' : 'BLOCKED';
      return item({
        id: `task:${task.id}`,
        sourceType: 'TASK_APPROVAL',
        sourceId: task.id,
        projectId: task.projectId,
        title: sanitizeText(task.userRequest, 160) || `Task ${task.id}`,
        summary: sanitizeText(task.resultSummary || 'Task Runtime item needs operator attention.'),
        state,
        urgency: task.taskKind === 'coding' ? 'HIGH' : 'MEDIUM',
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
        actor: task.executionEngine,
        requestedBy: 'task-runtime',
        risk: riskSummary(task.riskLevel, task.approvalState === 'requested', task.status === 'WAITING_APPROVAL'),
        authority: authoritySummary(task.riskLevel === 'approved-external' ? 'CONTROLLED_ACTION' : null, null, state === 'BLOCKED' ? 'UNKNOWN_BLOCKER' : 'WAITING_HUMAN_APPROVAL'),
        blockedReason: state === 'BLOCKED' ? 'UNKNOWN_BLOCKER' : 'WAITING_HUMAN_APPROVAL',
        evidenceRefs: [`task:${task.id}`],
        allowedOperatorActions: ['open_task'],
      });
    });
  }

  private knowledgeItems(): OperatorItem[] {
    return this.personalStore.listKnowledge()
      .filter(record => record.status === 'NEEDS_CONFIRMATION')
      .map(record => item({
        id: `knowledge:${record.id}`,
        sourceType: 'KNOWLEDGE_CONFIRMATION',
        sourceId: record.id,
        projectId: record.projectIds[0] ?? null,
        title: sanitizeText(record.title, 160),
        summary: sanitizeText(record.summary || 'Knowledge candidate needs explicit confirmation.'),
        state: 'WAITING_ON_OPERATOR',
        urgency: 'LOW',
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        requestedBy: record.sourceType,
        risk: riskSummary('read-only', true, false),
        authority: authoritySummary(null, null, 'KNOWLEDGE_NEEDS_CONFIRMATION'),
        blockedReason: 'KNOWLEDGE_NEEDS_CONFIRMATION',
        evidenceRefs: record.evidenceReferences.slice(0, 10),
        allowedOperatorActions: ['open_knowledge'],
      }));
  }

  private controlledActionItems(): OperatorItem[] {
    const decisions = new Map(this.governanceStore.listDecisions(500).map(decision => [decision.proposalId, decision]));
    return this.actionStore.listProposals()
      .filter(proposal => proposal.status === 'WAITING_APPROVAL' || BLOCKING_ACTION_STATUSES.has(proposal.status))
      .map(proposal => {
        const decision = decisions.get(proposal.id) ?? null;
        const blockedReason = proposal.status === 'WAITING_APPROVAL' ? 'WAITING_HUMAN_APPROVAL' : normalizeBlockedReason({ proposal, decision });
        return item({
          id: `action:${proposal.id}`,
          sourceType: 'CONTROLLED_ACTION',
          sourceId: proposal.id,
          projectId: proposal.projectId,
          title: sanitizeText(proposal.title, 160),
          summary: sanitizeText(proposal.description || proposal.reason || proposal.preview.text),
          state: proposal.status === 'WAITING_APPROVAL' ? 'WAITING_ON_OPERATOR' : 'BLOCKED',
          urgency: proposal.riskClass === 'R4' ? 'CRITICAL' : proposal.riskClass === 'R3' ? 'HIGH' : 'MEDIUM',
          createdAt: proposal.createdAt,
          updatedAt: proposal.executedAt ?? proposal.rejectedAt ?? proposal.approvedAt ?? proposal.createdAt,
          expiresAt: proposal.expiresAt,
          requestedBy: 'ControlledActionService',
          actionType: proposal.actionType,
          targetSummary: sanitizeText(proposal.preview.text, 220),
          risk: riskSummary('EXTERNAL_REVERSIBLE', true, true, proposal.riskClass, decision?.requiredApprovalLevel ?? null),
          authority: this.actionAuthoritySummary(proposal, decision),
          policyState: decision ? decision.decision : null,
          budgetState: decision?.budgetState.blocked ? 'BLOCKED' : decision?.budgetState.remainingExecutions != null ? `remaining:${decision.budgetState.remainingExecutions}` : null,
          killSwitchState: decision?.killSwitchState.blocked ? 'BLOCKED' : null,
          planId: proposal.sourcePlanId,
          blockedReason,
          evidenceRefs: [...proposal.evidenceReferences, `action:${proposal.id}`].slice(0, 12),
          allowedOperatorActions: ['open_controlled_action'],
        });
      });
  }

  private planItems(): OperatorItem[] {
    const proposalsByPlan = new Set(this.actionStore.listProposals().map(proposal => proposal.sourcePlanId).filter((id): id is string => !!id));
    const out: OperatorItem[] = [];
    for (const plan of this.orchestrationStore.listPlans()) {
      if (plan.status === 'WAITING_APPROVAL' && !proposalsByPlan.has(plan.id)) out.push(this.planItem(plan, 'WAITING_ON_OPERATOR', 'WAITING_HUMAN_APPROVAL'));
      if (BLOCKING_PLAN_STATUSES.has(plan.status)) out.push(this.planItem(plan, 'BLOCKED', normalizePlanReason(plan.blockedReason || plan.failureReason)));
      for (const step of this.orchestrationStore.listStepsForPlan(plan.id)) {
        if (step.status === 'WAITING_APPROVAL' && step.proposalId) continue;
        if (step.status === 'WAITING_APPROVAL') out.push(this.stepItem(plan, step, 'WAITING_ON_OPERATOR', 'WAITING_HUMAN_APPROVAL'));
        if (BLOCKING_STEP_STATUSES.has(step.status)) out.push(this.stepItem(plan, step, 'BLOCKED', normalizePlanReason(step.failureReason)));
      }
    }
    return out;
  }

  private delegationItems(): OperatorItem[] {
    return this.delegationStore.listDelegations()
      .filter(d => d.status === 'WAITING_APPROVAL' || ['PAUSED', 'PAUSED_POLICY_CHANGED', 'EXPIRED', 'EXHAUSTED', 'REVOKED'].includes(d.status) || this.isExpiring(d))
      .map(d => {
        const waiting = d.status === 'WAITING_APPROVAL';
        const state: OperatorItemState = waiting ? 'WAITING_ON_OPERATOR' : this.isExpiring(d) && d.status === 'ACTIVE' ? 'EXPIRING' : 'BLOCKED';
        return item({
          id: `delegation:${d.id}`,
          sourceType: 'DELEGATION',
          sourceId: d.id,
          projectId: d.projectId,
          title: sanitizeText(d.title, 160),
          summary: sanitizeText(d.description || `Delegation ${d.status.toLowerCase().replace(/_/g, ' ')}.`),
          state,
          urgency: state === 'EXPIRING' ? 'MEDIUM' : waiting ? 'HIGH' : 'HIGH',
          createdAt: d.createdAt,
          updatedAt: d.activatedAt ?? d.approvedAt ?? d.createdAt,
          expiresAt: d.expiresAt,
          actor: d.owner,
          requestedBy: d.owner,
          actionType: d.allowedActionTypes.join(', '),
          targetSummary: sanitizeText(sanitizeRecord(d.targetRestriction as Record<string, unknown>), 220),
          risk: riskSummary('EXTERNAL_REVERSIBLE', waiting, true, d.riskCeiling, d.approvalLevelCeiling),
          authority: authoritySummary(d.allowedActionTypes[0] ?? null, null, delegationReason(d)),
          policyState: d.policyVersion,
          budgetState: `${Math.max(0, d.maxExecutions - d.usedExecutions)} remaining`,
          delegationState: d.status,
          planId: d.sourcePlanId,
          blockedReason: waiting ? 'WAITING_HUMAN_APPROVAL' : delegationReason(d),
          evidenceRefs: d.evidenceReferences.slice(0, 12),
          allowedOperatorActions: ['open_delegation'],
        });
      });
  }

  private authorityItems(): OperatorItem[] {
    const manifest = generateAuthorityManifest(this.repoRoot);
    const legacy = legacyMutationSurfaces(manifest);
    if (!legacy.length) return [];
    return [item({
      id: 'legacy:phase6b-quarantine',
      sourceType: 'LEGACY_MIGRATION_WARNING',
      sourceId: 'phase6b-quarantine',
      projectId: null,
      title: 'Legacy authority quarantine',
      summary: `${manifest.counts.quarantinedLegacy} legacy mutation surface(s) are quarantined; ${manifest.counts.unresolvedLegacyMutations} unresolved.`,
      state: manifest.counts.unresolvedLegacyMutations > 0 ? 'BLOCKED' : 'QUARANTINED',
      urgency: manifest.counts.unresolvedLegacyMutations > 0 ? 'CRITICAL' : 'LOW',
      createdAt: manifest.generatedAt,
      updatedAt: manifest.generatedAt,
      risk: riskSummary('PROCESS_CONTROL', false, true),
      authority: authoritySummary(null, null, 'LEGACY_QUARANTINED'),
      blockedReason: 'LEGACY_QUARANTINED',
      evidenceRefs: ['authority:phase6b-legacy-migration'],
      allowedOperatorActions: ['open_authority'],
    })];
  }

  private authorityView(): OperatorAuthorityView {
    const manifest = generateAuthorityManifest(this.repoRoot);
    const legacy = legacyMutationSurfaces(manifest);
    const delegations = this.delegationStore.listDelegations();
    const budgets = this.governanceStore.listBudgets();
    const killSwitches = this.governanceStore.listKillSwitches(false);
    const effectiveActions = FROZEN_EXTERNAL_WRITES.map(actionType => effectiveAction(actionType, delegations, budgets, killSwitches));
    return {
      generatedAt: this.now().toISOString(),
      frozenExternalWritableActions: FROZEN_EXTERNAL_WRITES,
      effectiveActions,
      manifestCounts: manifest.counts,
      legacy: {
        legacyMutations: manifest.counts.legacyMutations,
        adaptedLegacy: manifest.counts.adaptedLegacy,
        quarantinedLegacy: manifest.counts.quarantinedLegacy,
        unresolvedLegacyMutations: manifest.counts.unresolvedLegacyMutations,
        sampleQuarantinedSurfaces: legacy.filter(surface => surface.phase6bDisposition === 'QUARANTINE_ONLY').slice(0, 12).map(surface => ({
          id: surface.id,
          runtimeMount: surface.runtimeMount,
          method: surface.method,
          canonicalOwner: surface.canonicalOwner,
          phase6bDisposition: surface.phase6bDisposition,
        })),
      },
    };
  }

  private actionAuthoritySummary(proposal: ActionProposal, decision: PolicyDecision | null): OperatorAuthoritySummary {
    if (FORBIDDEN_ACTIONS.has(proposal.actionType) || !FROZEN_EXTERNAL_WRITES.includes(proposal.actionType)) {
      return authoritySummary(proposal.actionType, null, 'FORBIDDEN_CAPABILITY', 'FORBIDDEN');
    }
    const reason = normalizeBlockedReason({ proposal, decision });
    if (reason !== 'NONE' && reason !== 'WAITING_HUMAN_APPROVAL') return authoritySummary(proposal.actionType, null, reason, 'BLOCKED');
    return authoritySummary(proposal.actionType, null, 'WAITING_HUMAN_APPROVAL', 'PER_ACTION_APPROVAL_REQUIRED');
  }

  private planItem(plan: ActionPlan, state: OperatorItemState, blockedReason: OperatorBlockedReason): OperatorItem {
    return item({
      id: `plan:${plan.id}`,
      sourceType: 'ACTION_PLAN',
      sourceId: plan.id,
      projectId: plan.projectId,
      title: sanitizeText(plan.title, 160),
      summary: sanitizeText(plan.objective || plan.blockedReason || plan.failureReason),
      state,
      urgency: state === 'BLOCKED' ? 'HIGH' : 'MEDIUM',
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt,
      risk: riskSummary('LOCAL_REVERSIBLE', state === 'WAITING_ON_OPERATOR', true),
      authority: authoritySummary(null, null, blockedReason),
      planId: plan.id,
      blockedReason,
      evidenceRefs: [`plan:${plan.id}`],
      allowedOperatorActions: ['open_plan'],
    });
  }

  private stepItem(plan: ActionPlan, step: ActionPlanStep, state: OperatorItemState, blockedReason: OperatorBlockedReason): OperatorItem {
    return item({
      id: `plan-step:${step.id}`,
      sourceType: 'ACTION_PLAN_STEP',
      sourceId: step.id,
      projectId: step.projectId ?? plan.projectId,
      title: sanitizeText(step.description, 160),
      summary: sanitizeText(step.failureReason || `Step ${step.status.toLowerCase().replace(/_/g, ' ')}.`),
      state,
      urgency: step.type === 'CONTROLLED_ACTION' ? 'HIGH' : 'MEDIUM',
      createdAt: step.createdAt,
      updatedAt: step.updatedAt,
      actionType: step.actionType,
      risk: riskSummary(step.sideEffectClass, state === 'WAITING_ON_OPERATOR', step.sideEffectClass === 'EXTERNAL', step.riskClass, step.requiredApprovalLevel),
      authority: authoritySummary(step.actionType, null, blockedReason),
      planId: plan.id,
      stepId: step.id,
      blockedReason,
      evidenceRefs: [`plan:${plan.id}`, `step:${step.id}`],
      allowedOperatorActions: ['open_plan'],
    });
  }

  private isExpiring(d: DelegatedAuthority): boolean {
    const expires = Date.parse(d.expiresAt);
    if (!Number.isFinite(expires)) return false;
    return expires > this.now().getTime() && expires - this.now().getTime() <= 72 * 60 * 60 * 1000;
  }
}

export function dedupeOperatorItems(items: OperatorItem[]): OperatorItem[] {
  const seen = new Map<string, OperatorItem>();
  const rank = (item: OperatorItem): number => item.sourceType === 'CONTROLLED_ACTION' ? 5 : item.sourceType === 'ACTION_PLAN_STEP' ? 3 : 1;
  for (const item of items) {
    const key = item.planId && item.actionType ? `plan-action:${item.planId}:${item.actionType}:${item.targetSummary ?? ''}` : `${item.sourceType}:${item.sourceId}`;
    const existing = seen.get(key);
    if (!existing || rank(item) > rank(existing) || item.updatedAt > existing.updatedAt) seen.set(key, item);
  }
  return [...seen.values()].sort((a, b) => `${urgencyRank(b.urgency)}:${b.updatedAt}:${b.id}`.localeCompare(`${urgencyRank(a.urgency)}:${a.updatedAt}:${a.id}`));
}

export function normalizeBlockedReason(input: { proposal?: ActionProposal | null; decision?: PolicyDecision | null; failureCode?: string | null; text?: string | null }): OperatorBlockedReason {
  const decision = input.decision?.decision;
  if (decision === 'BLOCK_KILL_SWITCH') return 'KILL_SWITCH_ACTIVE';
  if (decision === 'BLOCK_BUDGET') return 'BUDGET_EXHAUSTED';
  if (decision === 'DENY') return 'POLICY_DENIED';
  if (decision === 'BLOCK_CONTEXT') return 'CONTEXT_BLOCKED';
  if (input.decision?.killSwitchState.blocked) return 'KILL_SWITCH_ACTIVE';
  if (input.decision?.budgetState.blocked) return 'BUDGET_EXHAUSTED';
  const code = input.proposal?.failureCode ?? input.failureCode ?? '';
  if (['UNSUPPORTED_ACTION', 'FORBIDDEN_RISK', 'PERMISSION_DENIED'].includes(code)) return 'FORBIDDEN_CAPABILITY';
  if (['AUTH_REQUIRED', 'PROVIDER_UNAVAILABLE', 'RATE_LIMITED'].includes(code)) return 'PROVIDER_UNAVAILABLE';
  if (['PAYLOAD_HASH_MISMATCH', 'STALE_PREVIEW', 'CONFLICT_CHANGED'].includes(code)) return 'PAYLOAD_CHANGED';
  const text = (input.text ?? '').toLowerCase();
  if (text.includes('kill')) return 'KILL_SWITCH_ACTIVE';
  if (text.includes('budget') || text.includes('quota')) return 'BUDGET_EXHAUSTED';
  if (text.includes('policy') || text.includes('denied')) return 'POLICY_DENIED';
  if (text.includes('reconciliation')) return 'RECONCILIATION_REQUIRED';
  if (text.includes('dependency')) return 'PLAN_DEPENDENCY_BLOCKED';
  return input.proposal?.status === 'WAITING_APPROVAL' ? 'WAITING_HUMAN_APPROVAL' : 'NONE';
}

function effectiveAction(actionType: ActionType, delegations: DelegatedAuthority[], budgets: ReturnType<GovernanceStore['listBudgets']>, killSwitches: ReturnType<GovernanceStore['listKillSwitches']>): EffectiveAuthorityAction {
  const activeKillSwitches = killSwitches.filter(sw => sw.enabled && (!sw.actionType || sw.actionType === actionType));
  const enabledBudgets = budgets.filter(b => b.enabled && (!b.actionType || b.actionType === actionType));
  const activeDelegations = delegations.filter(d => d.status === 'ACTIVE' && d.allowedActionTypes.includes(actionType) && DELEGATION_ELIGIBLE_ACTION_TYPES.has(actionType));
  const remainingDelegatedExecutions = activeDelegations.reduce((sum, d) => sum + Math.max(0, d.maxExecutions - d.usedExecutions), 0);
  if (activeKillSwitches.length) return effective(actionType, 'BLOCKED', false, 'KILL_SWITCH_ACTIVE', activeDelegations.length, remainingDelegatedExecutions, activeKillSwitches.length, enabledBudgets.length, ['Active kill switch blocks execution.']);
  if (enabledBudgets.some(b => b.currentUsage.executions >= b.maxExecutions)) return effective(actionType, 'BLOCKED', false, 'BUDGET_EXHAUSTED', activeDelegations.length, remainingDelegatedExecutions, activeKillSwitches.length, enabledBudgets.length, ['Enabled budget has no remaining execution capacity.']);
  if (remainingDelegatedExecutions > 0) return effective(actionType, 'DELEGATED_CONDITIONALLY', true, 'NONE', activeDelegations.length, remainingDelegatedExecutions, 0, enabledBudgets.length, ['Active delegation exists; canonical delegation and governance checks still run at execution time.']);
  return effective(actionType, 'PER_ACTION_APPROVAL_REQUIRED', false, 'WAITING_HUMAN_APPROVAL', activeDelegations.length, remainingDelegatedExecutions, 0, enabledBudgets.length, ['No active delegation with remaining quota.']);
}

function effective(actionType: ActionType, state: EffectiveAuthorityAction['state'], canExecuteWithoutHuman: boolean, reason: OperatorBlockedReason, activeDelegations: number, remainingDelegatedExecutions: number, activeKillSwitches: number, enabledBudgets: number, details: string[]): EffectiveAuthorityAction {
  return { actionType, state, canExecuteWithoutHuman, canonicalRecheckRequired: true, reason, activeDelegations, remainingDelegatedExecutions, activeKillSwitches, enabledBudgets, details };
}

function item(input: Partial<OperatorItem> & Pick<OperatorItem, 'id' | 'sourceType' | 'sourceId' | 'title' | 'summary' | 'state' | 'urgency' | 'createdAt' | 'updatedAt' | 'risk' | 'authority' | 'blockedReason' | 'evidenceRefs' | 'allowedOperatorActions'>): OperatorItem {
  return {
    projectId: null, expiresAt: null, actor: null, requestedBy: null, actionType: null, targetSummary: null,
    policyState: null, budgetState: null, killSwitchState: null, delegationState: null, planId: null, stepId: null,
    ...input,
    title: sanitizeText(input.title, 180),
    summary: sanitizeText(input.summary, 400),
    evidenceRefs: input.evidenceRefs.map(ref => sanitizeText(ref, 160)).slice(0, 12),
  };
}

function riskSummary(effectClass: string, approvalRequired: boolean, governanceRequired: boolean, riskClass: string | null = null, requiredApprovalLevel: string | null = null): OperatorRiskSummary {
  return { effectClass, riskClass, approvalRequired, requiredApprovalLevel, governanceRequired, externalSystem: effectClass.includes('EXTERNAL') ? 'external' : null, canExecuteWithoutHuman: false, canonicalRecheckRequired: governanceRequired };
}

function authoritySummary(actionType: string | null, surfaceId: string | null, reason: OperatorBlockedReason, state: OperatorAuthoritySummary['state'] = reason === 'NONE' ? 'READ_ONLY' : 'UNKNOWN'): OperatorAuthoritySummary {
  return { actionType, authorityClass: null, authoritySurfaceId: surfaceId, canonicalOwner: actionType ? 'ControlledActionService' : null, state, reason, details: [reason] };
}

function delegationReason(d: DelegatedAuthority): OperatorBlockedReason {
  if (d.status === 'EXPIRED') return 'DELEGATION_EXPIRED';
  if (d.status === 'EXHAUSTED') return 'DELEGATION_EXHAUSTED';
  if (d.status === 'REVOKED') return 'DELEGATION_REVOKED';
  if (d.status === 'PAUSED' || d.status === 'PAUSED_POLICY_CHANGED') return 'DELEGATION_PAUSED';
  return 'NONE';
}

function normalizePlanReason(text: string | null): OperatorBlockedReason {
  return normalizeBlockedReason({ text }) === 'NONE' ? 'PLAN_DEPENDENCY_BLOCKED' : normalizeBlockedReason({ text });
}

function countStates(items: OperatorItem[]): Record<OperatorItemState | 'total', number> {
  const counts = { total: items.length, WAITING_ON_OPERATOR: 0, ACTIVE: 0, BLOCKED: 0, NEEDS_ATTENTION: 0, EXPIRING: 0, QUARANTINED: 0, INFORMATIONAL: 0 };
  for (const item of items) counts[item.state] += 1;
  return counts;
}

function emptySourceCounts(): Record<OperatorSourceType, number> {
  return {
    TASK_APPROVAL: 0, KNOWLEDGE_CONFIRMATION: 0, CONTROLLED_ACTION: 0, GOVERNANCE_CHANGE: 0,
    ACTION_PLAN: 0, ACTION_PLAN_STEP: 0, DELEGATION: 0, LEGACY_MIGRATION_WARNING: 0, AUTHORITY_VIOLATION: 0,
  };
}

function urgencyRank(urgency: OperatorUrgency): number {
  return { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 }[urgency];
}
