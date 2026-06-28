/**
 * workflow-fingerprint.ts
 * Fingerprints workflows to detect duplicate workflow triggers.
 */
import { createHash } from 'crypto';

export interface WorkflowFingerprintInput {
  workflow_id: string;
  domain: string;
  schedule: string;
  owner_department: string;
}

function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[^\w\s]/g, '');
}

export function buildWorkflowFingerprint(input: WorkflowFingerprintInput): string {
  const parts = [
    normalize(input.workflow_id),
    normalize(input.domain),
    normalize(input.schedule),
    normalize(input.owner_department),
  ];
  return createHash('sha256').update(parts.join('|')).digest('hex');
}

export function buildWorkflowFingerprintKey(input: WorkflowFingerprintInput): string {
  const parts = [
    normalize(input.domain),
    normalize(input.schedule),
    normalize(input.owner_department),
  ];
  return parts.join('|');
}
