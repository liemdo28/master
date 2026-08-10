import { GovernanceStore } from './store';
import type { ActionProposal } from '../types';
import { externalTargetCount } from './risk';
import type { BudgetState } from './types';

export class BudgetManager {
  constructor(private readonly store: GovernanceStore) {}

  state(proposal: ActionProposal): BudgetState {
    const budget = this.store.findBudget(proposal.actionType, proposal.projectId);
    if (!budget) {
      return {
        blocked: true,
        budgetId: null,
        scope: 'NONE',
        maxExecutions: null,
        usedExecutions: 0,
        remainingExecutions: null,
        resetsAt: null,
        reason: 'No budget exists for this action type. External actions fail closed.',
      };
    }
    const refreshed = refreshIfNeeded(budget);
    const remaining = refreshed.maxExecutions - refreshed.currentUsage.executions;
    return {
      blocked: remaining <= 0,
      budgetId: refreshed.id,
      scope: refreshed.scope,
      maxExecutions: refreshed.maxExecutions,
      usedExecutions: refreshed.currentUsage.executions,
      remainingExecutions: Math.max(0, remaining),
      resetsAt: refreshed.resetsAt,
      reason: remaining <= 0 ? 'Execution budget exhausted.' : null,
    };
  }

  reserveExecution(proposal: ActionProposal): BudgetState {
    const budget = this.store.findBudget(proposal.actionType, proposal.projectId);
    if (!budget) return this.state(proposal);
    const refreshed = refreshIfNeeded(budget);
    const targets = externalTargetCount(proposal);
    if (refreshed.currentUsage.executions >= refreshed.maxExecutions) return this.state(proposal);
    if (refreshed.currentUsage.externalTargets + targets > refreshed.maxExternalTargets) {
      return { ...this.state(proposal), blocked: true, reason: 'External target budget exhausted.' };
    }
    refreshed.currentUsage.executions += 1;
    refreshed.currentUsage.externalTargets += targets;
    this.store.updateBudgetUsage(refreshed);
    return {
      blocked: false,
      budgetId: refreshed.id,
      scope: refreshed.scope,
      maxExecutions: refreshed.maxExecutions,
      usedExecutions: refreshed.currentUsage.executions,
      remainingExecutions: Math.max(0, refreshed.maxExecutions - refreshed.currentUsage.executions),
      resetsAt: refreshed.resetsAt,
      reason: null,
    };
  }

  incrementProposal(proposal: ActionProposal): void {
    const budget = this.store.findBudget(proposal.actionType, proposal.projectId);
    if (!budget) return;
    const refreshed = refreshIfNeeded(budget);
    refreshed.currentUsage.proposals += 1;
    this.store.updateBudgetUsage(refreshed);
  }

  incrementApproval(proposal: ActionProposal): void {
    const budget = this.store.findBudget(proposal.actionType, proposal.projectId);
    if (!budget) return;
    const refreshed = refreshIfNeeded(budget);
    refreshed.currentUsage.approvals += 1;
    this.store.updateBudgetUsage(refreshed);
  }
}

function refreshIfNeeded<T extends { period: string; resetsAt: string; currentUsage: any }>(budget: T): T {
  if (new Date(budget.resetsAt).getTime() > Date.now()) return budget;
  const ms = budget.period === 'WEEK' ? 7 * 24 * 60 * 60_000 : budget.period === 'DAY' ? 24 * 60 * 60_000 : 60 * 60_000;
  budget.currentUsage = { proposals: 0, approvals: 0, executions: 0, externalTargets: 0 };
  budget.resetsAt = new Date(Date.now() + ms).toISOString();
  return budget;
}
