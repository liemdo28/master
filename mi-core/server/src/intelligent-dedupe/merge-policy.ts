/**
 * merge-policy.ts
 * Policy engine for merging duplicate entities.
 */
import type { DuplicateKind } from './duplicate-detector';

export interface MergeDecision {
  action: 'MERGE' | 'KEEP_BOTH' | 'KEEP_FIRST' | 'KEEP_SECOND' | 'BLOCK';
  merged_id: string | null;
  reason: string;
}

export function evaluateMerge(kind: DuplicateKind, a: { id: string; description: string }, b: { id: string; description: string }): MergeDecision {
  switch (kind) {
    case 'objective':
      // Same objective = duplicate, block second
      return { action: 'BLOCK', merged_id: null, reason: 'Duplicate objective detected' };

    case 'task':
      // Same task text + same owner = duplicate, block second
      if (a.description === b.description) {
        return { action: 'KEEP_FIRST', merged_id: a.id, reason: 'Duplicate task, keeping first' };
      }
      return { action: 'MERGE', merged_id: a.id, reason: 'Similar tasks merged' };

    case 'workflow':
      // Same domain + schedule + owner = merge into existing
      return { action: 'MERGE', merged_id: a.id, reason: 'Duplicate workflow merged into existing' };

    case 'oss_capability':
      return { action: 'KEEP_FIRST', merged_id: a.id, reason: 'OSS capability already selected' };

    case 'connector_event':
      return { action: 'KEEP_FIRST', merged_id: a.id, reason: 'Connector event already processed' };

    case 'approval_request':
      return { action: 'KEEP_FIRST', merged_id: a.id, reason: 'Approval request already pending' };

    default:
      return { action: 'BLOCK', merged_id: null, reason: `Unknown duplicate kind: ${kind}` };
  }
}
