/**
<<<<<<< a471ef81
 * Phase 0C — Task Registry
 *
 * Single source of truth for ALL company tasks across all divisions.
 * No task may exist only inside a division.
 * Every task must have: owner, division, status.
 *
 * Task ID prefixes: ENG, OPS, FIN, MKT, IT, CRT, EXE, REV, SEO, QB, DD
 */
import {
  Task, TaskStatus, TaskPriority, TaskSeverity, ExecutionLogEntry,
} from './types';
import {
  loadCollection, saveRecord, loadRecord, deleteRecord,
  genId, nowIso,
} from './persistence';
import { routeTask } from './division-router';
import { autoClassify } from './priority-engine';

const SUBDIR = 'tasks';

const DIVISION_PREFIX: Record<string, string> = {
  'engineering': 'ENG', 'computer-operator': 'OPS', 'finance': 'FIN',
  'marketing': 'MKT', 'it': 'IT', 'creative': 'CRT', 'executive': 'EXE',
  'review': 'REV', 'seo': 'SEO', 'quickbooks': 'QB', 'doordash': 'DD',
};

function makeTaskId(division: string): string {
  const prefix = DIVISION_PREFIX[division] ?? 'GEN';
  return genId(prefix);
}

export interface CreateTaskInput {
  objectiveId: string;
  title: string;
  description?: string;
  source?: string;
  division?: string;
  owner?: string;
  assignee?: string;
  priority?: TaskPriority;
  severity?: TaskSeverity;
  dueDate?: string | null;
  dependencies?: string[];
  evidenceRequired?: boolean;
  approvalRequired?: boolean;
}

export function createTask(input: CreateTaskInput): Task {
  const route = input.division
    ? routeTask(input.title + ' ' + (input.description ?? ''))
    : routeTask(input.title + ' ' + (input.description ?? ''));

  const division = input.division ?? route.division;
  const taskPriority = input.priority ?? autoClassify(input.title, input.description ?? '').priority;

  const now = nowIso();
  const task: Task = {
    id: makeTaskId(division),
    objectiveId: input.objectiveId,
    title: input.title,
    description: input.description ?? '',
    source: input.source ?? 'coordination-pipeline',
    division,
    owner: input.owner ?? 'unassigned',
    assignee: input.assignee ?? 'unassigned',
    status: 'NEW',
    priority: taskPriority,
    severity: input.severity ?? 'medium',
    dueDate: input.dueDate ?? null,
    createdAt: now,
    updatedAt: now,
    startedAt: null,
    completedAt: null,
    blockedReason: null,
    dependencyIds: input.dependencies ?? [],
    duplicateOf: null,
    conflictWith: [],
    evidenceIds: [],
    approvalId: null,
    executionLog: [],
    resultSummary: null,
    evidenceRequired: input.evidenceRequired ?? true,
    approvalRequired: input.approvalRequired ?? false,
  };

  // Log creation
  task.executionLog.push({
    timestamp: now,
    action: 'created',
    from: 'NEW' as TaskStatus,
    to: 'NEW' as TaskStatus,
    actor: 'coordination-pipeline',
    note: `Task created in division ${division}`,
  });

  saveRecord(SUBDIR, task);
  return task;
}

export function getTask(id: string): Task | null {
  return loadRecord<Task>(SUBDIR, id);
}

export function getAllTasks(filter?: {
  status?: TaskStatus; division?: string; objectiveId?: string;
  priority?: TaskPriority;
}): Task[] {
  const all = loadCollection<Task>(SUBDIR);
  return all.filter(t => {
    if (filter?.status && t.status !== filter.status) return false;
    if (filter?.division && t.division !== filter.division) return false;
    if (filter?.objectiveId && t.objectiveId !== filter.objectiveId) return false;
    if (filter?.priority && t.priority !== filter.priority) return false;
    return true;
  });
}

export function getBlockedTasks(): Task[] {
  return getAllTasks({ status: 'BLOCKED' });
}

export function getPendingApprovals(): Task[] {
  return getAllTasks({ status: 'WAITING_APPROVAL' });
}

export function getBlockingDependencies(): Task[] {
  return getAllTasks({ status: 'WAITING_DEPENDENCY' });
}

export function getTasksByObjective(objectiveId: string): Task[] {
  return getAllTasks({ objectiveId });
}

export function getTasksByDivision(division: string): Task[] {
  return getAllTasks({ division });
}

export function addEvidence(taskId: string, evidenceId: string): Task | null {
  const task = getTask(taskId);
  if (!task) return null;
  if (!task.evidenceIds.includes(evidenceId)) task.evidenceIds.push(evidenceId);
  task.updatedAt = nowIso();
  saveRecord(SUBDIR, task);
  return task;
}

export function updateTaskStatus(
  id: string, newStatus: TaskStatus, actor: string = 'system', note: string = '',
): Task | null {
  const task = getTask(id);
  if (!task) return null;

  const from = task.status;
  const now = nowIso();

  // State machine validation
  if (newStatus === 'IN_PROGRESS' && !task.owner) {
    throw new Error('Cannot move to IN_PROGRESS without owner');
  }
  if (newStatus === 'DONE' && task.evidenceRequired && task.evidenceIds.length === 0) {
    throw new Error('Cannot close task without evidence (evidence_required=true)');
  }
  if (newStatus === 'BLOCKED' && !note) {
    throw new Error('Cannot block task without blocked_reason (note)');
  }

  task.status = newStatus;
  task.updatedAt = now;
  if (newStatus === 'IN_PROGRESS' && !task.startedAt) task.startedAt = now;
  if (newStatus === 'DONE') task.completedAt = now;
  if (newStatus === 'BLOCKED') task.blockedReason = note || null;

  task.executionLog.push({
    timestamp: now,
    action: `transition:${from}→${newStatus}`,
    from,
    to: newStatus,
    actor,
    note,
  });

  saveRecord(SUBDIR, task);
  return task;
}

export function getTaskHistory(id: string): ExecutionLogEntry[] | null {
  const task = getTask(id);
  return task ? task.executionLog : null;
}

export function deleteTask(id: string): boolean {
  return deleteRecord(SUBDIR, id);
}
=======
 * Phase 0 — Task Registry
 * 
 * Single source of truth for ALL company tasks across all divisions.
 * Prevents orphan tasks. Every task must have: owner, division, status.
 * 
 * Storage: JSON files in .mi-harness/coordination/tasks/
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';
import type { CoordinatedTask, TaskStatus, Priority, Division, ApprovalType, TaskSource } from './types';
import { autoClassify } from './priority-engine';
function autoClassifyPriority(title: string, desc: string): Priority { return autoClassify(title, desc).priority; }

const DATA_DIR = join(process.cwd(), '.mi-harness', 'coordination');
const TASKS_DIR = join(DATA_DIR, 'tasks');

function ensureDirs() { mkdirSync(TASKS_DIR, { recursive: true }); }

let counter = 0;
function nextId(prefix: string): string {
  counter++;
  return `${prefix}-${String(counter).padStart(3, '0')}`;
}

// ── Create ──────────────────────────────────────────────────────────────────

export function createTask(params: {
  objectiveId: string;
  title: string;
  description: string;
  division: Division;
  owner: string;
  priority?: Priority;
  dependencies?: string[];
  approvalRequired?: ApprovalType;
}): CoordinatedTask {
  ensureDirs();

  const prefixMap: Record<Division, string> = {
    engineering: 'ENG', 'computer-operator': 'COP', finance: 'FIN',
    marketing: 'MKT', it: 'IT', creative: 'CRE', seo: 'SEO', operations: 'OPS',
  };

  // Load existing count for prefix
  const prefix = prefixMap[params.division];
  const existing = loadAll().filter(t => t.id.startsWith(prefix + '-'));
  const nextNum = existing.length + 1;
  const id = `${prefix}-${String(nextNum).padStart(3, '0')}`;

  const now = new Date().toISOString();
  const task: CoordinatedTask = {
    id,
    objectiveId: params.objectiveId,
    title: params.title,
    description: params.description,
    division: params.division,
    owner: params.owner,
    priority: params.priority || autoClassifyPriority(params.title, params.description),
    status: 'pending',
    dependencies: params.dependencies || [],
    approvalRequired: params.approvalRequired || 'none',
    evidenceRefs: [],
    duplicateOf: null,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
  };

  saveTask(task);
  return task;
}

// ── Update ──────────────────────────────────────────────────────────────────

export function updateTaskStatus(id: string, status: TaskStatus): CoordinatedTask | null {
  const task = loadTask(id);
  if (!task) return null;
  task.status = status;
  task.updatedAt = new Date().toISOString();
  if (status === 'completed') task.completedAt = new Date().toISOString();
  saveTask(task);
  return task;
}

export function addEvidence(id: string, evidence: CoordinatedTask['evidenceRefs'][0]): CoordinatedTask | null {
  const task = loadTask(id);
  if (!task) return null;
  task.evidenceRefs.push({ ...evidence, capturedAt: new Date().toISOString() });
  task.updatedAt = new Date().toISOString();
  saveTask(task);
  return task;
}

// ── Query ───────────────────────────────────────────────────────────────────

export function getTask(id: string): CoordinatedTask | null { return loadTask(id); }

export function getAllTasks(): CoordinatedTask[] { return loadAll(); }

export function getTasksByDivision(division: Division): CoordinatedTask[] {
  return loadAll().filter(t => t.division === division);
}

export function getTasksByObjective(objectiveId: string): CoordinatedTask[] {
  return loadAll().filter(t => t.objectiveId === objectiveId);
}

export function getBlockedTasks(): CoordinatedTask[] {
  return loadAll().filter(t => t.status === 'blocked');
}

export function getPendingApprovals(): CoordinatedTask[] {
  return loadAll().filter(t => t.status === 'awaiting-approval');
}

// ── Blocking check ─────────────────────────────────────────────────────────

/**
 * Check if a task is blocked by its dependencies.
 * Returns IDs of uncompleted dependencies.
 */
export function getBlockingDependencies(id: string): string[] {
  const task = loadTask(id);
  if (!task) return [];
  const all = loadAll();
  const taskMap = new Map(all.map(t => [t.id, t]));
  return task.dependencies.filter(depId => {
    const dep = taskMap.get(depId);
    return dep && dep.status !== 'completed';
  });
}

// ── Storage ─────────────────────────────────────────────────────────────────

function saveTask(task: CoordinatedTask) {
  ensureDirs();
  writeFileSync(join(TASKS_DIR, `${task.id}.json`), JSON.stringify(task, null, 2));
}

function loadTask(id: string): CoordinatedTask | null {
  const fp = join(TASKS_DIR, `${id}.json`);
  if (!existsSync(fp)) return null;
  try { return JSON.parse(readFileSync(fp, 'utf-8')); } catch { return null; }
}

function loadAll(): CoordinatedTask[] {
  ensureDirs();
  try {
    return readdirSync(TASKS_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => { try { return JSON.parse(readFileSync(join(TASKS_DIR, f), 'utf-8')); } catch { return null; } })
      .filter(Boolean);
  } catch { return []; }
}
>>>>>>> origin/seo/phase-29-revenue-execution-loop
