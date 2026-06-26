/**
<<<<<<< a471ef81
 * Phase 0B — Objective Registry
 *
 * Single source of truth for company objectives.
 * No objective may exist outside this registry.
 */
import {
  Objective, ObjectiveStatus, TaskPriority,
} from './types';
import {
  loadCollection, saveRecord, loadRecord, deleteRecord,
  genId, nowIso,
} from './persistence';

const SUBDIR = 'objectives';

export interface CreateObjectiveInput {
  title: string;
  description?: string;
  source?: string;
  requestedBy?: string;
  ownerExecutive?: string;
  primaryDivision?: string;
  supportingDivisions?: string[];
  priority?: TaskPriority;
  businessGoal?: string;
  expectedImpact?: string;
  targetDate?: string | null;
  evidenceRequired?: boolean;
  approvalRequired?: boolean;
}

export function createRegisteredObjective(
  titleOrInput: string | CreateObjectiveInput,
  requestedBy: string = 'ceo',
): Objective {
  const input: CreateObjectiveInput = typeof titleOrInput === 'string'
    ? { title: titleOrInput, requestedBy }
    : titleOrInput;

  const id = genId('OBJ');
  const now = nowIso();
  const obj: Objective = {
    id,
    title: input.title,
    description: input.description ?? '',
    source: input.source ?? 'manual',
    requestedBy: input.requestedBy ?? 'ceo',
    ownerExecutive: input.ownerExecutive ?? 'ceo',
    primaryDivision: input.primaryDivision ?? 'operations',
    supportingDivisions: input.supportingDivisions ?? [],
    priority: input.priority ?? 'P1',
    status: 'ACCEPTED',
    businessGoal: input.businessGoal ?? '',
    expectedImpact: input.expectedImpact ?? '',
    createdAt: now,
    updatedAt: now,
    targetDate: input.targetDate ?? null,
    closedAt: null,
    evidenceRequired: input.evidenceRequired ?? true,
    approvalRequired: input.approvalRequired ?? false,
    linkedTasks: [],
    linkedReports: [],
  };
  saveRecord(SUBDIR, obj);
  return obj;
}

export function getRegisteredObjectives(filter?: {
  status?: ObjectiveStatus; priority?: TaskPriority;
}): Objective[] {
  const all = loadCollection<Objective>(SUBDIR);
  return all.filter(o => {
    if (filter?.status && o.status !== filter.status) return false;
    if (filter?.priority && o.priority !== filter.priority) return false;
    return true;
  });
}

export function getRegisteredObjective(id: string): Objective | null {
  return loadRecord<Objective>(SUBDIR, id);
}

export function updateRegisteredObjective(
  id: string, patch: Partial<Objective>,
): Objective | null {
  const obj = getRegisteredObjective(id);
  if (!obj) return null;
  const updated = { ...obj, ...patch, id: obj.id, updatedAt: nowIso() };
  saveRecord(SUBDIR, updated);
  return updated;
}

export function closeObjective(id: string): Objective | null {
  const obj = getRegisteredObjective(id);
  if (!obj) return null;
  obj.status = 'COMPLETED';
  obj.closedAt = nowIso();
  obj.updatedAt = obj.closedAt;
  saveRecord(SUBDIR, obj);
  return obj;
}

export function linkTask(objectiveId: string, taskId: string): Objective | null {
  const obj = getRegisteredObjective(objectiveId);
  if (!obj) return null;
  if (!obj.linkedTasks.includes(taskId)) obj.linkedTasks.push(taskId);
  obj.updatedAt = nowIso();
  saveRecord(SUBDIR, obj);
  return obj;
}

export function deleteRegisteredObjective(id: string): boolean {
  return deleteRecord(SUBDIR, id);
}
=======
 * Phase 0 — Objective Registry
 * 
 * Unified registry of executive objectives.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';

export interface RegisteredObjective {
  id: string;
  title: string;
  status: 'active' | 'completed' | 'blocked';
  owner: string;
  createdAt: string;
  updatedAt: string;
}

const DATA_DIR = join(process.cwd(), '.mi-harness', 'coordination');
const OBJECTIVES_DIR = join(DATA_DIR, 'objectives');

function ensureDirs() { mkdirSync(OBJECTIVES_DIR, { recursive: true }); }

export function createRegisteredObjective(title: string, owner = 'ceo'): RegisteredObjective {
  ensureDirs();
  const existing = loadAll();
  const id = `OBJ-${String(existing.length + 1).padStart(3, '0')}`;
  const now = new Date().toISOString();
  const obj: RegisteredObjective = { id, title, status: 'active', owner, createdAt: now, updatedAt: now };
  writeFileSync(join(OBJECTIVES_DIR, `${id}.json`), JSON.stringify(obj, null, 2));
  return obj;
}

export function getRegisteredObjectives(): RegisteredObjective[] {
  ensureDirs();
  return loadAll();
}

function loadAll(): RegisteredObjective[] {
  try {
    return readdirSync(OBJECTIVES_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => { try { return JSON.parse(readFileSync(join(OBJECTIVES_DIR, f), 'utf-8')); } catch { return null; } })
      .filter(Boolean);
  } catch { return []; }
}
>>>>>>> origin/seo/phase-29-revenue-execution-loop
