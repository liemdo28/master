import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { WorkflowEvidenceRecord } from './types';

export function buildWorkflowEvidenceRecord(record: WorkflowEvidenceRecord): WorkflowEvidenceRecord {
  return {
    ...record,
    duration: Math.max(0, record.duration),
    errors: record.errors ?? [],
    evidence: record.evidence ?? [],
  };
}

export function writeWorkflowEvidence(record: WorkflowEvidenceRecord, storeDir = join(process.cwd(), '.mi-harness', 'workflow-fabric', 'evidence')): string {
  mkdirSync(storeDir, { recursive: true });
  const safeId = record.workflow_id.replace(/[^a-zA-Z0-9._-]+/g, '-');
  const fp = join(storeDir, `${safeId}-${Date.now()}.json`);
  writeFileSync(fp, JSON.stringify(buildWorkflowEvidenceRecord(record), null, 2));
  return fp;
}
