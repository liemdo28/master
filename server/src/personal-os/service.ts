import { randomUUID } from 'crypto';
import { TaskEngine } from '../task-runtime/engine';
import { TaskStore } from '../task-runtime/store';
import { ProjectRegistryService } from '../project-registry/service';
import { PersonalOsStore } from './store';
import type { DailyBrief, Goal, GoalPlan, KnowledgeRecord, KnowledgeSearchInput, MemoryPack, UserPreference } from './types';

function today(): string {
  return (process.env.MI_TEST_TODAY || new Date().toISOString().slice(0, 10));
}

function sanitizeUntrustedText(value: string): string {
  return redactSecrets(value).replace(/ignore previous instructions|system prompt|developer message/gi, '[untrusted-instruction]');
}

function redactSecrets(value: string): string {
  return value
    .replace(/BEGIN (RSA|OPENSSH|PRIVATE) KEY[\s\S]*?END \1 KEY/gi, '[REDACTED_SECRET]')
    .replace(/bearer\s+[A-Za-z0-9._-]{20,}/gi, 'bearer [REDACTED_SECRET]')
    .replace(/(password|token|api[_-]?key)\s*=\s*\S+/gi, '$1=[REDACTED_SECRET]')
    .replace(/(postgres|mysql|mongodb(\+srv)?):\/\/\S+/gi, '[REDACTED_CONNECTION_STRING]');
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

  activateGoal(goalId: string): Goal {
    const goal = this.store.getGoal(goalId);
    if (!goal) throw new Error('goal not found');
    for (const projectId of goal.projectIds) {
      if (!this.registry.getProject(projectId)) throw new Error(`registered project required before activation: ${projectId}`);
    }
    return this.store.updateGoalStatus(goalId, 'ACTIVE');
  }

  planGoal(goalId: string): { goal: Goal; plan: GoalPlan; childTaskIds: string[] } {
    const goal = this.store.getGoal(goalId);
    if (!goal) throw new Error('goal not found');
    for (const projectId of goal.projectIds) {
      if (!this.registry.getProject(projectId)) throw new Error(`registered project required before planning: ${projectId}`);
    }
    const existing = this.store.existingPlan(goalId);
    if (existing.plan) {
      return { goal, plan: existing.plan, childTaskIds: existing.childTaskIds };
    }
    const operationId = this.store.startPlanOperation(goalId);
    const memoryPack = this.store.buildMemoryPack({
      query: goal.title,
      projectIds: goal.projectIds,
      goalId,
      policy: 'PROJECT_ONLY',
      maxRecords: 8,
      maxBytes: 5000,
      includeUnconfirmed: true,
    });
    const childTaskIds: string[] = [];
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
      planId: operationId,
      version: 1,
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
      memoryReferences: [
        ...memoryPack.relevantProjectConventions,
        ...memoryPack.relevantArchitectureDecisions,
        ...memoryPack.previousLessons,
      ].map(record => record.id),
      conflicts: memoryPack.conflicts,
      createdAt: new Date().toISOString(),
    };

    try {
      const engine = new TaskEngine(this.taskStore);
      if (process.env.MI_PHASE5A_FAIL_PLAN_AT === 'before-first-child') throw new Error('injected failure before first child');
      for (let index = 0; index < proposed.length; index++) {
        const task = proposed[index];
        const reusable = this.taskStore.listTasks()
          .find(existingTask => existingTask.parentTaskId === goal.id && existingTask.userRequest === task.title);
        if (reusable) {
          childTaskIds.push(reusable.id);
        } else {
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
          childTaskIds.push(approval.id);
        }
        this.store.updatePlanOperation(operationId, 'STAGING', childTaskIds);
        if (process.env.MI_PHASE5A_FAIL_PLAN_AT === 'after-some-children' && index === 1) {
          throw new Error('injected failure after some children');
        }
      }
      if (process.env.MI_PHASE5A_FAIL_PLAN_AT === 'before-plan-activation') throw new Error('injected failure before plan activation');
      this.store.saveGoalPlan(goalId, plan, childTaskIds);
      childTaskIds.forEach((taskId, index) => {
        if (!this.store.listPriorities(goalId).some(item => item.taskId === taskId)) {
          this.store.createPriority({
            goalId,
            taskId,
            reason: proposed[index].title,
            urgency: 3,
            importance: 4,
            dueAt: null,
            status: 'OPEN',
          });
        }
      });
      this.store.updatePlanOperation(operationId, 'COMPLETED', childTaskIds);
      return { goal, plan, childTaskIds };
    } catch (err) {
      this.store.updatePlanOperation(operationId, 'FAILED', childTaskIds, err instanceof Error ? err.message : String(err));
      throw err;
    }
  }

  goalProgress(goalId: string): Record<string, unknown> {
    const goal = this.store.getGoal(goalId);
    if (!goal) throw new Error('goal not found');
    const { plan, childTaskIds } = this.store.getGoalPlan(goalId);
    const childTasks = childTaskIds.map(id => this.taskStore.getTask(id)).filter(Boolean);
    return { goal, plan, childTasks, priorities: this.store.listPriorities(goalId) };
  }

  generateDailyBrief(): DailyBrief {
    const existing = this.store.latestDailyBrief(today());
    if (existing) return existing;
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
    const sanitizeTask = (task: any) => ({
      id: task.id,
      parentTaskId: task.parentTaskId,
      status: task.status,
      projectId: task.projectId,
      userRequest: sanitizeUntrustedText(task.userRequest || ''),
      resultSummary: sanitizeUntrustedText(task.resultSummary || ''),
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    });
    const pendingTasks = tasks.filter(task => ['WAITING_APPROVAL', 'READY', 'BLOCKED'].includes(task.status)).map(sanitizeTask);
    const recentFailures = tasks.filter(task => task.status === 'FAILED').slice(0, 5).map(sanitizeTask);
    const recentSuccesses = tasks.filter(task => task.status === 'COMPLETED').slice(0, 5).map(sanitizeTask);
    const unknowns = [];
    if (!process.env.GOOGLE_CLIENT_ID) unknowns.push('Calendar and email facts are unknown because Google connectors are not configured in this environment.');
    if (!projects.length) unknowns.push('Project registry has no registered projects in this environment.');
    const memoryPack = this.store.buildMemoryPack({
      query: 'daily brief active goals pending approvals recurring lessons unresolved issues',
      projectIds: activeGoals.flatMap(goal => goal.projectIds),
      policy: 'PERSONAL_AND_PROJECT',
      maxRecords: 8,
      maxBytes: 6000,
      includeUnconfirmed: true,
    });
    const brief: DailyBrief = {
      id: `brief-${randomUUID()}`,
      date: today(),
      generatedAt: new Date().toISOString(),
      activeGoals: activeGoals.map(goal => ({ ...goal, title: sanitizeUntrustedText(goal.title), description: sanitizeUntrustedText(goal.description) })),
      activeProjects: projects,
      pendingTasks,
      pendingApprovals: pendingTasks.map(task => ({ taskId: task.id, reason: task.resultSummary || 'approval required' })),
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
      confirmedMemory: [
        ...memoryPack.confirmedPreferences,
        ...memoryPack.previousLessons,
        ...memoryPack.recurringIssues,
      ].map(record => ({ id: record.id, kind: record.kind, title: record.title, summary: record.summary })),
      confirmationRequests: memoryPack.uncertainRecords.map(record => ({ id: record.id, title: record.title, kind: record.kind })),
    };
    return this.store.saveDailyBrief(brief);
  }

  createKnowledge(input: Parameters<PersonalOsStore['createKnowledge']>[0]): KnowledgeRecord {
    return this.store.createKnowledge(input);
  }

  searchKnowledge(input: KnowledgeSearchInput) {
    return this.store.searchKnowledge(input);
  }

  buildMemoryPack(input: KnowledgeSearchInput): MemoryPack {
    return this.store.buildMemoryPack(input);
  }

  extractKnowledgeFromTask(taskId: string): KnowledgeRecord {
    const task = this.taskStore.getTask(taskId);
    if (!task) throw new Error('task not found');
    if (!['COMPLETED', 'FAILED'].includes(task.status)) throw new Error('task must be completed or failed before extraction');
    const source = sanitizeUntrustedText(`${task.userRequest}\n${task.resultSummary || ''}`);
    const kind = task.status === 'FAILED' ? 'RECURRING_ISSUE' : 'LESSON_LEARNED';
    const summary = task.status === 'FAILED'
      ? `Unresolved issue from task ${taskId}: ${source.slice(0, 300)}`
      : `Lesson from task ${taskId}: ${source.slice(0, 300)}`;
    return this.store.createKnowledge({
      kind,
      title: task.status === 'FAILED' ? 'Task failure needs follow-up' : 'Completed task lesson',
      summary,
      content: summary,
      scope: task.projectId ? 'PROJECT_ONLY' : 'PERSONAL_AND_PROJECT',
      projectIds: task.projectId ? [task.projectId] : [],
      taskIds: [taskId],
      tags: task.status === 'FAILED' ? ['task', 'failure', 'recurring-issue'] : ['task', 'lesson'],
      sourceType: 'TASK_SUMMARY',
      provenance: `extracted from task ${taskId} summary`,
      confidence: task.status === 'FAILED' ? 0.7 : 0.8,
      status: 'NEEDS_CONFIRMATION',
      evidenceReferences: [`task:${taskId}`],
    });
  }
}
