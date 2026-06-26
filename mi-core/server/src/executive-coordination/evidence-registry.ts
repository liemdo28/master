/**
 * Phase 0J — Evidence Registry
 *
 * Centralize evidence across divisions.
 * Task cannot close without evidence if evidence_required=true.
 *
 * Types: git_commit | pull_request | screenshot | curl_output |
 *        api_response | log_file | test_result | report |
 *        database_snapshot | workflow_execution | browser_recording |
 *        deployment_proof | rollback_plan
 */
import {
  EvidenceRecord, EvidenceType, Task,
} from './types';
import {
  loadCollection, saveRecord, loadRecord, genId, nowIso,
} from './persistence';

const SUBDIR = 'evidence';

export interface AddEvidenceInput {
  taskId: string;
  objectiveId?: string | null;
  evidenceType: EvidenceType;
  title: string;
  source: string;
  filePath?: string | null;
  url?: string | null;
  hash?: string | null;
  createdBy?: string;
}

export function addEvidenceRecord(input: AddEvidenceInput): EvidenceRecord {
  const rec: EvidenceRecord = {
    id: genId('EVD'),
    taskId: input.taskId,
    objectiveId: input.objectiveId ?? null,
    evidenceType: input.evidenceType,
    title: input.title,
    source: input.source,
    filePath: input.filePath ?? null,
    url: input.url ?? null,
    hash: input.hash ?? null,
    createdAt: nowIso(),
    createdBy: input.createdBy ?? 'system',
    verified: false,
    verificationMethod: null,
  };
  saveRecord(SUBDIR, rec);
  return rec;
}

export function getEvidenceRecord(id: string): EvidenceRecord | null {
  return loadRecord<EvidenceRecord>(SUBDIR, id);
}

export function getEvidenceRecords(taskId: string): EvidenceRecord[] {
  return loadCollection<EvidenceRecord>(SUBDIR).filter(e => e.taskId === taskId);
}

export function getAllEvidenceRecords(): EvidenceRecord[] {
  return loadCollection<EvidenceRecord>(SUBDIR);
}

export function verifyEvidence(
  id: string, method: string = 'manual_review',
): EvidenceRecord | null {
  const rec = getEvidenceRecord(id);
  if (!rec) return null;
  rec.verified = true;
  rec.verificationMethod = method;
  saveRecord(SUBDIR, rec);
  return rec;
}

export function getUnverifiedEvidence(): EvidenceRecord[] {
  return loadCollection<EvidenceRecord>(SUBDIR).filter(e => !e.verified);
}

export function getEvidenceSummary(): {
  total: number;
  verified: number;
  unverified: number;
  byType: Record<string, number>;
} {
  const all = loadCollection<EvidenceRecord>(SUBDIR);
  let verified = 0;
  const byType: Record<string, number> = {};
  for (const e of all) {
    if (e.verified) verified++;
    byType[e.evidenceType] = (byType[e.evidenceType] ?? 0) + 1;
  }
  return { total: all.length, verified, unverified: all.length - verified, byType };
}

/**
 * Check if a task can be closed: must have evidence if evidence_required=true
 */
export function taskCanClose(task: Task): boolean {
  if (!task.evidenceRequired) return true;
  return task.evidenceIds.length > 0;
}

export function missingEvidenceForObjective(objectiveId: string, tasks: Task[]): Task[] {
  return tasks.filter(t =>
    t.objectiveId === objectiveId &&
    t.status === 'DONE' &&
    t.evidenceRequired &&
    t.evidenceIds.length === 0,
  );
}