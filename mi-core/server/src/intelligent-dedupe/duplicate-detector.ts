/**
 * duplicate-detector.ts
 * Central duplicate detection engine.
 */
import { buildObjectiveFingerprint, type ObjectiveFingerprintInput } from './objective-fingerprint';
import { buildTaskFingerprint, type TaskFingerprintInput } from './task-fingerprint';
import { buildWorkflowFingerprint, type WorkflowFingerprintInput } from './workflow-fingerprint';
import { buildOssCapabilityFingerprint, type OssCapabilityFingerprintInput } from './oss-capability-fingerprint';

export type DuplicateKind = 'objective' | 'task' | 'workflow' | 'oss_capability' | 'connector_event' | 'approval_request';

export interface DuplicateCheckResult {
  kind: DuplicateKind;
  fingerprint: string;
  existing_id: string | null;
  status: 'CLEAN' | 'DUPLICATE_FOUND' | 'BLOCKED';
  action: 'ALLOW' | 'MERGE' | 'BLOCK';
  reason: string;
}

// In-memory dedup stores
const objectiveStore = new Map<string, string>();
const taskStore = new Map<string, string>();
const workflowStore = new Map<string, string>();
const approvalStore = new Map<string, string>();
const connectorEventStore = new Map<string, string>();

export function checkObjectiveDuplicate(input: ObjectiveFingerprintInput, newId: string): DuplicateCheckResult {
  const fp = buildObjectiveFingerprint(input);
  const existing = objectiveStore.get(fp);
  if (existing) {
    return { kind: 'objective', fingerprint: fp, existing_id: existing, status: 'DUPLICATE_FOUND', action: 'BLOCK', reason: `Objective already exists: ${existing}` };
  }
  objectiveStore.set(fp, newId);
  return { kind: 'objective', fingerprint: fp, existing_id: null, status: 'CLEAN', action: 'ALLOW', reason: 'Objective is new' };
}

export function checkTaskDuplicate(input: TaskFingerprintInput, newId: string): DuplicateCheckResult {
  const fp = buildTaskFingerprint(input);
  const existing = taskStore.get(fp);
  if (existing) {
    return { kind: 'task', fingerprint: fp, existing_id: existing, status: 'DUPLICATE_FOUND', action: 'BLOCK', reason: `Task already exists: ${existing}` };
  }
  taskStore.set(fp, newId);
  return { kind: 'task', fingerprint: fp, existing_id: null, status: 'CLEAN', action: 'ALLOW', reason: 'Task is new' };
}

export function checkWorkflowDuplicate(input: WorkflowFingerprintInput, newId: string): DuplicateCheckResult {
  const fp = buildWorkflowFingerprint(input);
  const existing = workflowStore.get(fp);
  if (existing && existing !== newId) {
    return { kind: 'workflow', fingerprint: fp, existing_id: existing, status: 'DUPLICATE_FOUND', action: 'MERGE', reason: `Duplicate workflow detected: ${existing}` };
  }
  workflowStore.set(fp, newId);
  return { kind: 'workflow', fingerprint: fp, existing_id: null, status: 'CLEAN', action: 'ALLOW', reason: 'Workflow is new' };
}

export function checkConnectorEventDuplicate(eventKey: string, eventId: string): DuplicateCheckResult {
  const existing = connectorEventStore.get(eventKey);
  if (existing) {
    return { kind: 'connector_event', fingerprint: eventKey, existing_id: existing, status: 'DUPLICATE_FOUND', action: 'BLOCK', reason: `Connector event already processed: ${existing}` };
  }
  connectorEventStore.set(eventKey, eventId);
  return { kind: 'connector_event', fingerprint: eventKey, existing_id: null, status: 'CLEAN', action: 'ALLOW', reason: 'Connector event is new' };
}

export function checkApprovalDuplicate(approvalKey: string): DuplicateCheckResult {
  const existing = approvalStore.get(approvalKey);
  if (existing) {
    return { kind: 'approval_request', fingerprint: approvalKey, existing_id: existing, status: 'DUPLICATE_FOUND', action: 'BLOCK', reason: `Approval already requested: ${existing}` };
  }
  approvalStore.set(approvalKey, approvalKey);
  return { kind: 'approval_request', fingerprint: approvalKey, existing_id: null, status: 'CLEAN', action: 'ALLOW', reason: 'Approval request is new' };
}
