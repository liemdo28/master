/**
 * department-evidence-store.ts
 * Stores and retrieves department-level evidence.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { DepartmentId } from './department-registry';

export interface DepartmentEvidence {
  department: DepartmentId;
  task_id: string;
  evidence_type: 'ownership' | 'handoff' | 'boundary_violation' | 'support_request' | 'escalation';
  content: string;
  created_at: string;
}

const BASE = 'mi-core/evidence/department-map';

function ensureDir(dept: DepartmentId): void {
  mkdirSync(join(BASE, dept), { recursive: true });
}

export function storeEvidence(evidence: DepartmentEvidence): void {
  ensureDir(evidence.department);
  const fp = join(BASE, evidence.department, `${evidence.task_id}-${evidence.evidence_type}.json`);
  writeFileSync(fp, JSON.stringify(evidence, null, 2));
}

export function getEvidence(dept: DepartmentId, taskId: string): DepartmentEvidence[] {
  ensureDir(dept);
  // This would read from file system in production
  return [];
}

export function listEvidenceByType(dept: DepartmentId, type: DepartmentEvidence['evidence_type']): DepartmentEvidence[] {
  ensureDir(dept);
  return [];
}
