import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { EngineeringTask, EngineeringTaskStatus } from './types';

const TASKS_DIR = join(process.cwd(), '.mi-harness', 'engineering', 'tasks');

function ensureDirs() {
  mkdirSync(TASKS_DIR, { recursive: true });
}

function taskPath(id: string) {
  return join(TASKS_DIR, `${id}.json`);
}

export function createEngineeringTask(task: Omit<EngineeringTask, 'task_id' | 'createdAt' | 'updatedAt'>): EngineeringTask {
  ensureDirs();
  const existing = getEngineeringTasks();
  const task_id = `ET-${String(existing.length + 1).padStart(3, '0')}`;
  const now = new Date().toISOString();
  const created: EngineeringTask = { ...task, task_id, createdAt: now, updatedAt: now };
  saveEngineeringTask(created);
  return created;
}

export function saveEngineeringTask(task: EngineeringTask): EngineeringTask {
  ensureDirs();
  task.updatedAt = new Date().toISOString();
  writeFileSync(taskPath(task.task_id), JSON.stringify(task, null, 2));
  return task;
}

export function updateEngineeringTaskStatus(taskId: string, status: EngineeringTaskStatus): EngineeringTask | null {
  const task = getEngineeringTask(taskId);
  if (!task) return null;
  task.status = status;
  return saveEngineeringTask(task);
}

export function getEngineeringTask(taskId: string): EngineeringTask | null {
  const fp = taskPath(taskId);
  if (!existsSync(fp)) return null;
  try {
    return JSON.parse(readFileSync(fp, 'utf-8'));
  } catch {
    return null;
  }
}

export function getEngineeringTasks(): EngineeringTask[] {
  ensureDirs();
  return readdirSync(TASKS_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      try {
        return JSON.parse(readFileSync(join(TASKS_DIR, f), 'utf-8'));
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}
