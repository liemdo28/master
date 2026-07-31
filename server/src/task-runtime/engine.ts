// Task lifecycle engine: create, transition, run a step, record evidence, complete.
// Deliberately minimal — this is the Phase 1 vertical slice, not the full orchestrator.
// It does not call gstack/, council/, or autonomous/ (Approval Engine) — those are
// out of scope for this slice per docs/architecture/MIGRATION_PLAN.md.

import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { TaskStore } from './store';
import { ALLOWED_TRANSITIONS } from './types';
import type { CreateTaskInput, TaskRecord, TaskStatus } from './types';

const ARG_METACHARS = /[;&|`$<>\\\r\n]/;
const SAFE_COMMAND_ARGS = new Map<string, ReadonlyArray<ReadonlyArray<string>>>([
  ['node', [['--version']]],
  ['git', [['status', '--short'], ['status', '--short', '--branch'], ['rev-parse', '--show-toplevel'], ['rev-parse', '--abbrev-ref', 'HEAD']]],
]);

function allowedWorkspaceRoots(): string[] {
  const raw = process.env.MI_TASK_RUNTIME_WORKSPACE_ROOTS;
  const roots = raw
    ? raw.split(path.delimiter).map(v => v.trim()).filter(Boolean)
    : [process.cwd()];
  return roots.map(root => path.resolve(root));
}

function isWithinRoot(target: string, root: string): boolean {
  const relative = path.relative(root, target);
  return relative === '' || (!!relative && !relative.startsWith('..') && !path.isAbsolute(relative));
}

function resolveWorkingDirectory(workingDirectory: string | null | undefined): string | null {
  if (workingDirectory == null) return null;
  const resolved = path.resolve(workingDirectory);
  const roots = allowedWorkspaceRoots();
  if (!roots.some(root => isWithinRoot(resolved, root))) {
    throw new Error('workingDirectory must stay inside configured workspace roots.');
  }
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
    throw new Error('workingDirectory must be an existing directory inside a configured workspace root.');
  }
  return resolved;
}

export function validateCommandInvocation(command: string, args: string[]): void {
  const allowedArgSets = SAFE_COMMAND_ARGS.get(command);
  if (!allowedArgSets) {
    throw new Error(`Command "${command}" is not in the read-only allowlist for task steps.`);
  }
  if (args.some(arg => ARG_METACHARS.test(arg))) {
    throw new Error('Command arguments must not contain shell metacharacters.');
  }
  if (!allowedArgSets.some(allowed => allowed.length === args.length && allowed.every((arg, index) => arg === args[index]))) {
    throw new Error(`Command "${command}" arguments are not approved for task-runtime.`);
  }
}

export class TaskEngine {
  constructor(private store: TaskStore) {}

  createTask(input: CreateTaskInput): TaskRecord {
    const now = new Date().toISOString();
    const workingDirectory = resolveWorkingDirectory(input.workingDirectory);
    const task: TaskRecord = {
      id: `task-${randomUUID()}`,
      parentTaskId: input.parentTaskId ?? null,
      userRequest: input.userRequest,
      normalizedIntent: null,
      projectId: input.projectId ?? null,
      repository: input.repository ?? null,
      workingDirectory,
      branch: input.branch ?? null,
      status: 'CREATED',
      riskLevel: input.riskLevel ?? 'read-only',
      approvalState: 'not-required',
      executionEngine: null,
      selectedModel: null,
      plan: null,
      currentStep: 0,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
      resultSummary: null,
    };
    this.store.insertTask(task);
    this.store.appendEvent(task.id, 'task.created', { userRequest: task.userRequest });
    return task;
  }

  transition(taskId: string, next: TaskStatus, reason?: string): TaskRecord {
    const task = this.mustGetTask(taskId);
    const allowed = ALLOWED_TRANSITIONS[task.status] ?? [];
    if (!allowed.includes(next)) {
      throw new Error(
        `Illegal transition for task ${taskId}: ${task.status} -> ${next}. Allowed: [${allowed.join(', ')}]`
      );
    }
    const now = new Date().toISOString();
    const previousStatus = task.status;
    task.status = next;
    task.updatedAt = now;
    if (next === 'COMPLETED' || next === 'FAILED' || next === 'CANCELLED' || next === 'ROLLED_BACK') {
      task.completedAt = now;
    }
    this.store.updateTask(task);
    this.store.appendEvent(taskId, 'task.status_changed', { from: previousStatus, to: next, reason: reason ?? null });
    return task;
  }

  /**
   * Runs a single read-only, allowlisted command as a task step and stores its
   * stdout/stderr as an evidence file. This intentionally does not accept a raw
   * shell string (execFileSync with an argv array) to avoid command injection,
   * and only allows commands present in SAFE_COMMANDS.
   */
  runCommandStep(taskId: string, command: string, args: string[]): { evidencePath: string; exitCode: number } {
    validateCommandInvocation(command, args);
    const task = this.mustGetTask(taskId);
    if (task.status !== 'RUNNING') {
      throw new Error(`Task ${taskId} must be RUNNING to execute a command step (current: ${task.status}).`);
    }

    const startedAt = new Date().toISOString();
    let stdout = '';
    let exitCode = 0;
    try {
      stdout = execFileSync(command, args, { encoding: 'utf8', cwd: resolveWorkingDirectory(task.workingDirectory) ?? process.cwd() });
    } catch (err: any) {
      exitCode = typeof err.status === 'number' ? err.status : 1;
      stdout = String(err.stdout ?? err.message ?? '');
    }
    const finishedAt = new Date().toISOString();

    task.currentStep += 1;
    task.updatedAt = finishedAt;
    this.store.updateTask(task);

    const evidenceDir = this.store.taskEvidenceDir(taskId);
    const evidenceFile = path.join(evidenceDir, `step-${task.currentStep}-command.json`);
    fs.writeFileSync(
      evidenceFile,
      JSON.stringify({ command, args, exitCode, stdout, startedAt, finishedAt }, null, 2)
    );

    this.store.appendEvent(taskId, 'command.completed', { command, args, exitCode, evidenceFile });
    return { evidencePath: evidenceFile, exitCode };
  }

  completeTask(taskId: string, resultSummary: string): TaskRecord {
    const task = this.transition(taskId, 'COMPLETED', resultSummary);
    task.resultSummary = resultSummary;
    this.store.updateTask(task);
    this.store.appendEvent(taskId, 'task.completed', { resultSummary });
    return task;
  }

  getTask(taskId: string): TaskRecord | null {
    return this.store.getTask(taskId);
  }

  private mustGetTask(taskId: string): TaskRecord {
    const task = this.store.getTask(taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);
    return task;
  }
}

// Read-only allowlist for Phase 1 acceptance testing. Anything requiring
// write/deploy/publish access belongs to a later phase's approval-gated engine.
export const SAFE_COMMANDS = new Set(['node', 'git']);
