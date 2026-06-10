/**
 * Mi Approval Gate — Level 1/2/3 action queue.
 * Level 1: auto-allowed (read, scan, report)
 * Level 2: requires single approval (write, create, assign)
 * Level 3: requires double approval (delete, deploy, push, financial)
 */

import { v4 as uuid } from 'uuid';
import { EventEmitter } from 'events';

export type RiskLevel = 1 | 2 | 3;
export type ActionStatus = 'pending' | 'approved' | 'rejected' | 'executed' | 'rolled_back';

export interface ApprovalAction {
  id: string;
  created_at: string;
  risk_level: RiskLevel;
  category: string;
  description: string;
  target: string;
  before_state?: string;
  after_state?: string;
  rollback_plan?: string;
  status: ActionStatus;
  confirmations: number;   // for level 3: need 2
  resolved_at?: string;
  resolved_by?: string;
  result?: string;
}

// In-memory queue (persisted to file in production)
const queue = new Map<string, ApprovalAction>();
export const gateEvents = new EventEmitter();

// Level 1 categories — auto-allowed, no queue needed
const LEVEL1_CATEGORIES = new Set([
  'read_file', 'search_file', 'scan_project', 'map_source',
  'query_knowledge', 'pull_dashboard', 'pull_website',
  'generate_report', 'generate_draft', 'generate_patch_proposal', 'run_qa',
  'list_processes', 'check_port', 'read_log',
]);

export function isAutoAllowed(category: string): boolean {
  return LEVEL1_CATEGORIES.has(category);
}

export function enqueue(params: {
  risk_level: RiskLevel;
  category: string;
  description: string;
  target: string;
  before_state?: string;
  after_state?: string;
  rollback_plan?: string;
}): ApprovalAction {
  const action: ApprovalAction = {
    id: uuid(),
    created_at: new Date().toISOString(),
    status: 'pending',
    confirmations: 0,
    ...params,
  };
  queue.set(action.id, action);
  gateEvents.emit('new_action', action);
  return action;
}

export function approve(id: string, approver = 'owner'): ApprovalAction | null {
  const action = queue.get(id);
  if (!action || action.status !== 'pending') return null;

  action.confirmations += 1;

  if (action.risk_level === 3 && action.confirmations < 2) {
    // Level 3: needs a second confirmation
    gateEvents.emit('partial_approval', action);
    return action;
  }

  action.status = 'approved';
  action.resolved_at = new Date().toISOString();
  action.resolved_by = approver;
  gateEvents.emit('approved', action);
  return action;
}

export function reject(id: string, approver = 'owner'): ApprovalAction | null {
  const action = queue.get(id);
  if (!action || action.status !== 'pending') return null;
  action.status = 'rejected';
  action.resolved_at = new Date().toISOString();
  action.resolved_by = approver;
  gateEvents.emit('rejected', action);
  return action;
}

export function markExecuted(id: string, result?: string): void {
  const action = queue.get(id);
  if (!action) return;
  action.status = 'executed';
  action.result = result;
}

export function getPending(): ApprovalAction[] {
  return [...queue.values()].filter(a => a.status === 'pending');
}

export function getAll(): ApprovalAction[] {
  return [...queue.values()].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

export function getById(id: string): ApprovalAction | undefined {
  return queue.get(id);
}
