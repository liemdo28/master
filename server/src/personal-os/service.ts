import { randomUUID } from 'crypto';
import { TaskEngine } from '../task-runtime/engine';
import { TaskStore } from '../task-runtime/store';
import { ProjectRegistryService } from '../project-registry/service';
import { PersonalOsStore } from './store';
import type { DailyBrief, Goal, GoalPlan, UserPreference } from './types';

function today(): string {
  return (process.env.MI_TEST_TODAY || new Date().toISOString().slice(0, 10));
}

function sanitizeUntrustedText(value: string): string {
  return value.replace(/ignore previous instructions|system prompt|developer message/gi, '[untrusted-instruction]');
}

export class PersonalOsService {
  constructor(
    readonly store = new PersonalOsStore(),
    readonly taskStore = new TaskStore(),
    readonly registry = new ProjectRegistryService(),
  ) {}

  close(): void {
    this.store.close();
    this.taskStore.close();
    this.registry.close();
  }

  createPreference(input: Parameters<PersonalOsStore['createPreference']>[0]): UserPreference {
    return this.store.createPreference(input);
  }

  planGoal(goalId: string): { goal: Goal; plan: GoalPlan; childTaskIds: string[] } {
    const goal = this.store.getGoal(goalId);
    if (!goal) throw new Error('goal not found');
    const projects = goal.projectIds.slice(0, 3);
    const milestones = [
      'Confirm the tagged v1.0 baseline and current production health.',
      'Review active task-runtime records, registry maps, and recent evidence.',
      'Identify the next safe Phase 5A implementation tasks.',
      'Prepare approval-gated child tasks without executing external actions.',
      'Generate a daily operating brief for the owner.',
    ].slice(0, 5);
    const proposed = milestones.map((title, index) => ({
      id: `proposed-${index + 1}`,
      title,
      risk: 'read-only',
      approvalRequired: true,
    }));
    const plan: GoalPlan = {
      goalId,
      objective: sanitizeUntrustedText(goal.title),
      assumptions: [
        'v1.0.0 is the current release baseline.',
        'Production-changing actions require explicit approval.',
        'Phase 5A creates planning records and draft tasks only.',
      ],
      milestones,
      proposedTasks: proposed,
      dependencies: ['Project Registry', 'Task Runtime', 'Daily Brief'],
      risks: ['Stale project state', 'Unconfigured calendar or email connectors', 'Accidental scope expansion'],
      approvalsRequired: ['Any execution beyond draft task creation'],
      successCriteria: goal.successCriteria.length ? goal.successCriteria : [
        'Goal, plan, child tasks, and daily brief persist after restart.',
        'No coding task, push, merge, deploy, email, publish, or external action runs automatically.',
      ],
      estimatedResourceClass: 'small',
      nextRecommendedAction: 'Review and approve only the next bounded child task.',
      createdAt: new Date().toISOString(),
    };

    const engine = new TaskEngine(this.taskStore);
    const childTaskIds = proposed.map(task => {
      const created = engine.createTask({
        userRequest: task.title,
        parentTaskId: goal.id,
        taskKind: 'general',
        projectId: projects[0] ?? null,
        riskLevel: 'read-only',
      });
      const waiting = engine.transition(created.id, 'CONTEXT_BUILDING');
      engine.transition(waiting.id, 'PLANNING');
      const approval = engine.transition(waiting.id, 'WAITING_APPROVAL', 'Phase 5A creates draft child tasks only.');
      return approval.id;
    });
    this.store.saveGoalPlan(goalId, plan, childTaskIds);
    childTaskIds.forEach((taskId, index) => {
      this.store.createPriority({
        goalId,
        taskId,
        reason: proposed[index].title,
        urgency: 3,
        importance: 4,
        dueAt: null,
        status: 'OPEN',
      });
    });
    return { goal, plan, childTaskIds };
  }

  goalProgress(goalId: string): Record<string, unknown> {
    const goal = this.store.getGoal(goalId);
    if (!goal) throw new Error('goal not found');
    const { plan, childTaskIds } = this.store.getGoalPlan(goalId);
    const childTasks = childTaskIds.map(id => this.taskStore.getTask(id)).filter(Boolean);
    return { goal, plan, childTasks, priorities: this.store.listPriorities(goalId) };
  }

  generateDailyBrief(): DailyBrief {
    const activeGoals = this.store.listGoals().filter(goal => ['DRAFT', 'ACTIVE', 'PAUSED', 'BLOCKED'].includes(goal.status));
    const tasks = this.taskStore.listTasks().slice(0, 20);
    let projects: unknown[] = [];
    try {
      projects = this.registry.listProjects().slice(0, 10).map(project => ({
        id: project.id,
        name: project.displayName,
        mapStatus: project.mapStatus,
        mapVersion: project.mapVersion,
        sourceSha: project.mapSourceSha,
      }));
    } catch {
      projects = [];
    }
    const pendingTasks = tasks.filter(task => ['WAITING_APPROVAL', 'READY', 'BLOCKED'].includes(task.status));
    const recentFailures = tasks.filter(task => task.status === 'FAILED').slice(0, 5);
    const recentSuccesses = tasks.filter(task => task.status === 'COMPLETED').slice(0, 5);
    const unknowns = [];
    if (!process.env.GOOGLE_CLIENT_ID) unknowns.push('Calendar and email facts are unknown because Google connectors are not configured in this environment.');
    if (!projects.length) unknowns.push('Project registry has no registered projects in this environment.');
    const brief: DailyBrief = {
      id: `brief-${randomUUID()}`,
      date: today(),
      generatedAt: new Date().toISOString(),
      activeGoals,
      activeProjects: projects,
      pendingTasks,
      pendingApprovals: pendingTasks.map(task => ({ taskId: task.id, reason: task.resultSummary ?? 'approval required' })),
      recentFailures,
      recentSuccesses,
      systemAlerts: [],
      recommendedNextActions: [
        { label: 'Review pending Phase 5A child tasks', reason: 'They are waiting for approval and do not execute automatically.', type: 'suggestion' },
      ],
      evidenceReferences: tasks.flatMap(task => [`task:${task.id}`]).slice(0, 10),
      facts: [
        `${activeGoals.length} active or draft goal(s) recorded.`,
        `${pendingTasks.length} task(s) currently need attention.`,
        `${projects.length} registered project summary record(s) available.`,
      ],
      suggestions: ['Approve one small next task only after reviewing scope and evidence.'],
      unknowns,
    };
    return this.store.saveDailyBrief(brief);
  }
}
