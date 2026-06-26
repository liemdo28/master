import fs from 'fs';
import path from 'path';
import { StoredTaskRecord } from './types';

const ROOT = path.join(process.cwd(), '.local-agent-global', 'operator-runtime');
const TASKS_DIR = path.join(ROOT, 'tasks');

function ensureDirs() {
  fs.mkdirSync(TASKS_DIR, { recursive: true });
}

function taskPath(taskId: string): string {
  return path.join(TASKS_DIR, `${taskId}.json`);
}

export function saveStoredTask(task: StoredTaskRecord): void {
  ensureDirs();
  fs.writeFileSync(taskPath(task.id), JSON.stringify(task, null, 2), 'utf-8');
}

export function getStoredTask(taskId: string): StoredTaskRecord | null {
  ensureDirs();
  const file = taskPath(taskId);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf-8')) as StoredTaskRecord;
}

export function getStoredTasks(): StoredTaskRecord[] {
  ensureDirs();
  return fs.readdirSync(TASKS_DIR)
    .filter((file) => file.endsWith('.json'))
    .map((file) => JSON.parse(fs.readFileSync(path.join(TASKS_DIR, file), 'utf-8')) as StoredTaskRecord)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}
