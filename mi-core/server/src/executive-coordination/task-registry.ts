/**
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
