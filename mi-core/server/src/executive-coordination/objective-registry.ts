/** Phase 0 â€” Objective Registry
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
