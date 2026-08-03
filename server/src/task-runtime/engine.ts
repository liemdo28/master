// Task lifecycle engine: create, transition, run a step, record evidence, complete.
// Deliberately minimal — this is the Phase 1 vertical slice, not the full orchestrator.
// It does not call gstack/, council/, or autonomous/ (Approval Engine) — those are
// out of scope for this slice per docs/architecture/MIGRATION_PLAN.md.

import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { TaskStore } from './store';
import { ALLOWED_TRANSITIONS } from './types';
import type { CreateTaskInput, TaskRecord, TaskStatus } from './types';
import { validateCodingTaskStart } from '../project-registry/guard';

const ARG_METACHARS = /[;&|`$<>\\\r\n]/;
const DEFAULT_COMMAND_TIMEOUT_MS = 10_000;
const DEFAULT_COMMAND_MAX_BUFFER_BYTES = 128 * 1024;
const SAFE_COMMAND_ARGS = new Map<string, ReadonlyArray<ReadonlyArray<string>>>([
  ['node', [['--version'], ['--task-runtime-intentional-failure']]],
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
  private runningProcesses = new Map<string, ChildProcessWithoutNullStreams>();

  constructor(private store: TaskStore) {}

  createTask(input: CreateTaskInput): TaskRecord {
    const now = new Date().toISOString();
    const workingDirectory = resolveWorkingDirectory(input.workingDirectory);
    const taskKind = input.taskKind ?? 'general';
    if (taskKind !== 'general' && taskKind !== 'coding') {
      throw new Error('taskKind must be either general or coding.');
    }
    if (taskKind === 'coding') {
      validateCodingTaskStart({
        projectId: input.projectId,
        workingDirectory,
        mapVersion: input.mapVersion,
        contextPackId: input.contextPackId,
      });
    }
    const task: TaskRecord = {
      id: `task-${randomUUID()}`,
      parentTaskId: input.parentTaskId ?? null,
      userRequest: input.userRequest,
      normalizedIntent: null,
      taskKind,
      projectId: input.projectId ?? null,
      mapVersion: input.mapVersion ?? null,
      contextPackId: input.contextPackId ?? null,
      repository: input.repository ?? null,
      workingDirectory,
      branch: input.branch ?? null,
      baseBranch: input.baseBranch ?? null,
      baseCommit: input.baseCommit ?? null,
      taskBranch: null,
      worktreePath: null,
      codingEngine: null,
      modelRoles: null,
      candidateFiles: null,
      filesRead: null,
      filesChanged: null,
      validationPlan: null,
      validationResults: null,
      retryCount: 0,
      maxRetries: input.maxRetries ?? 3,
      reviewStatus: null,
      commitPolicy: null,
      commitSha: null,
      rollbackState: null,
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
    this.store.runInTransaction(() => {
      this.store.insertTask(task);
      this.store.appendEvent(task.id, 'task.created', {
        userRequest: task.userRequest,
        taskKind: task.taskKind,
        projectId: task.projectId,
        mapVersion: task.mapVersion,
        contextPackId: task.contextPackId,
      });
    });
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
    this.store.runInTransaction(() => {
      this.store.updateTask(task);
      this.store.appendEvent(taskId, 'task.status_changed', { from: previousStatus, to: next, reason: reason ?? null });
    });
    return task;
  }

  /**
   * Runs a single read-only, allowlisted command as a task step and stores its
   * stdout/stderr as an evidence file. This intentionally does not accept a raw
   * shell string (spawn with an argv array) to avoid command injection,
   * and only allows commands present in SAFE_COMMANDS.
   */
  async runCommandStep(taskId: string, command: string, args: string[]): Promise<{ evidenceId: string; relativePath: string; exitCode: number; signal: string | null }> {
    validateCommandInvocation(command, args);
    const task = this.mustGetTask(taskId);
    if (task.status !== 'RUNNING') {
      throw new Error(`Task ${taskId} must be RUNNING to execute a command step (current: ${task.status}).`);
    }

    const startedAt = new Date().toISOString();
    const result = await this.spawnCommand(taskId, command, args, resolveWorkingDirectory(task.workingDirectory) ?? process.cwd());
    const finishedAt = new Date().toISOString();

    const latestTask = this.mustGetTask(taskId);
    latestTask.currentStep += 1;
    latestTask.updatedAt = finishedAt;
    const evidenceId = `step-${latestTask.currentStep}-command`;
    const { relativePath, absolutePath } = this.store.evidencePathFor(taskId, evidenceId);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(
      absolutePath,
      JSON.stringify({
        command,
        args,
        exitCode: result.exitCode,
        signal: result.signal,
        stdout: result.stdout,
        stderr: result.stderr,
        startedAt,
        finishedAt,
        timeoutMs: commandTimeoutMs(),
        maxBufferBytes: commandMaxBufferBytes(),
        timedOut: result.timedOut,
        outputLimitExceeded: result.outputLimitExceeded,
        cancelled: result.cancelled,
      }, null, 2)
    );

    this.store.runInTransaction(() => {
      this.store.updateTask(latestTask);
      this.store.appendEvent(taskId, 'command.completed', {
        command,
        args,
        exitCode: result.exitCode,
        signal: result.signal,
        evidenceId,
        relativePath,
        timedOut: result.timedOut,
        outputLimitExceeded: result.outputLimitExceeded,
        cancelled: result.cancelled,
      });
    });
    return { evidenceId, relativePath, exitCode: result.exitCode, signal: result.signal };
  }

  cancelTask(taskId: string, reason = 'Task execution cancelled.'): TaskRecord {
    const child = this.runningProcesses.get(taskId);
    if (child && !child.killed) child.kill();
    const task = this.mustGetTask(taskId);
    if (task.status !== 'RUNNING') {
      return this.transition(taskId, 'CANCELLED', reason);
    }
    const now = new Date().toISOString();
    task.status = 'CANCELLED';
    task.updatedAt = now;
    task.completedAt = now;
    task.resultSummary = reason;
    this.store.runInTransaction(() => {
      this.store.updateTask(task);
      this.store.appendEvent(taskId, 'task.status_changed', { from: 'RUNNING', to: 'CANCELLED', reason });
      this.store.appendEvent(taskId, 'task.cancelled', { reason });
    });
    return task;
  }

  getRunningTaskIds(): string[] {
    return [...this.runningProcesses.keys()];
  }

  private spawnCommand(taskId: string, command: string, args: string[], cwd: string): Promise<{
    stdout: string;
    stderr: string;
    exitCode: number;
    signal: string | null;
    timedOut: boolean;
    outputLimitExceeded: boolean;
    cancelled: boolean;
  }> {
    return new Promise(resolve => {
      const commandSpec = resolveCommandForSpawn(command, args);
      const child = spawn(commandSpec.file, commandSpec.args, {
        cwd,
        shell: false,
        env: minimalCommandEnv(),
        windowsHide: true,
      });
      this.runningProcesses.set(taskId, child);

      let stdout = '';
      let stderr = '';
      let outputBytes = 0;
      let settled = false;
      let timedOut = false;
      let outputLimitExceeded = false;
      let cancelled = false;
      let exitCode = 1;
      let signal: string | null = null;
      const maxBuffer = commandMaxBufferBytes();

      const finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.runningProcesses.delete(taskId);
        resolve({ stdout, stderr, exitCode, signal, timedOut, outputLimitExceeded, cancelled });
      };

      const stopChild = (reason: 'TIMEOUT' | 'OUTPUT_LIMIT') => {
        if (reason === 'TIMEOUT') timedOut = true;
        if (reason === 'OUTPUT_LIMIT') outputLimitExceeded = true;
        signal = reason;
        exitCode = 1;
        if (!child.killed) child.kill();
      };

      const appendOutput = (target: 'stdout' | 'stderr', chunk: Buffer) => {
        const remaining = Math.max(0, maxBuffer - outputBytes);
        const accepted = chunk.subarray(0, remaining).toString('utf8');
        if (target === 'stdout') stdout += accepted;
        else stderr += accepted;
        outputBytes += chunk.length;
        if (outputBytes > maxBuffer && !outputLimitExceeded) stopChild('OUTPUT_LIMIT');
      };

      const timer = setTimeout(() => stopChild('TIMEOUT'), commandTimeoutMs());

      child.stdout.on('data', chunk => appendOutput('stdout', Buffer.from(chunk)));
      child.stderr.on('data', chunk => appendOutput('stderr', Buffer.from(chunk)));
      child.on('error', err => {
        stderr += String(err.message ?? err);
        exitCode = 1;
        finish();
      });
      child.on('close', (code, sig) => {
        const latestTask = this.store.getTask(taskId);
        cancelled = latestTask?.status === 'CANCELLED';
        if (cancelled) {
          exitCode = 1;
          signal = signal ?? 'CANCELLED';
        } else if (!timedOut && !outputLimitExceeded) {
          exitCode = typeof code === 'number' ? code : 1;
          signal = typeof sig === 'string' ? sig : null;
        }
        finish();
      });
    });
  }

  completeTask(taskId: string, resultSummary: string): TaskRecord {
    const task = this.mustGetTask(taskId);
    const allowed = ALLOWED_TRANSITIONS[task.status] ?? [];
    if (!allowed.includes('COMPLETED')) {
      throw new Error(`Illegal transition for task ${taskId}: ${task.status} -> COMPLETED. Allowed: [${allowed.join(', ')}]`);
    }
    const previousStatus = task.status;
    const now = new Date().toISOString();
    task.status = 'COMPLETED';
    task.updatedAt = now;
    task.completedAt = now;
    task.resultSummary = resultSummary;
    this.store.runInTransaction(() => {
      this.store.updateTask(task);
      this.store.appendEvent(taskId, 'task.status_changed', { from: previousStatus, to: 'COMPLETED', reason: resultSummary });
      this.store.appendEvent(taskId, 'task.completed', { resultSummary });
    });
    return task;
  }

  failTask(taskId: string, resultSummary: string): TaskRecord {
    const task = this.mustGetTask(taskId);
    const allowed = ALLOWED_TRANSITIONS[task.status] ?? [];
    if (!allowed.includes('FAILED')) {
      throw new Error(`Illegal transition for task ${taskId}: ${task.status} -> FAILED. Allowed: [${allowed.join(', ')}]`);
    }
    const previousStatus = task.status;
    const now = new Date().toISOString();
    task.status = 'FAILED';
    task.updatedAt = now;
    task.completedAt = now;
    task.resultSummary = resultSummary;
    this.store.runInTransaction(() => {
      this.store.updateTask(task);
      this.store.appendEvent(taskId, 'task.status_changed', { from: previousStatus, to: 'FAILED', reason: resultSummary });
      this.store.appendEvent(taskId, 'task.failed', { resultSummary });
    });
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

function minimalCommandEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const key of ['PATH', 'Path', 'SystemRoot', 'WINDIR', 'COMSPEC', 'PATHEXT', 'HOME', 'USERPROFILE', 'TMP', 'TEMP']) {
    if (process.env[key]) env[key] = process.env[key];
  }
  return env;
}

export const TASK_RUNTIME_COMMAND_LIMITS = {
  timeoutMs: DEFAULT_COMMAND_TIMEOUT_MS,
  maxBufferBytes: DEFAULT_COMMAND_MAX_BUFFER_BYTES,
  executionMode: 'spawn',
};

function commandTimeoutMs(): number {
  const raw = Number(process.env.MI_TASK_RUNTIME_COMMAND_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_COMMAND_TIMEOUT_MS;
}

function resolveCommandForSpawn(command: string, args: string[]): { file: string; args: string[] } {
  const nodeShim = process.env.MI_TASK_RUNTIME_TEST_NODE_SHIM_SCRIPT;
  if (command === 'node' && nodeShim) {
    return { file: process.execPath, args: [nodeShim, ...args] };
  }
  return { file: command, args };
}

function commandMaxBufferBytes(): number {
  const raw = Number(process.env.MI_TASK_RUNTIME_COMMAND_MAX_BUFFER_BYTES);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_COMMAND_MAX_BUFFER_BYTES;
}
