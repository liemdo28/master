/**
 * Autonomous Task Runner — Phase 7A.1: QUARANTINED.
 *
 * This module used to execute shell commands (approval.auto_command, or an
 * allowlisted L1 command) entirely outside canonical governance — no
 * ActionPolicyEngine/RiskEvaluator/kill-switch/budget check, gated only by
 * this file's own, separate jarvis approval-conversation store. Unrestricted
 * shell execution is not an approved authority (see Phase 6G's candidate
 * review), so per Phase 7A.1's default rule ("QUARANTINE or RETIRE unless a
 * canonical, already-approved action exactly covers the behavior" — none
 * does), both entrypoints now refuse to execute and return a blocked result
 * instead. Nothing here calls child_process anymore.
 */
import { getApprovalById } from './approval-conversation';
import { appendFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';

const LOG_DIR = path.join(process.env.GLOBAL_DIR || 'E:/Project/Master/.local-agent-global', 'jarvis');
const LOG_PATH = path.join(LOG_DIR, 'task-runner.jsonl');

function log(entry: Record<string, unknown>) {
  try {
    if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true });
    appendFileSync(LOG_PATH, JSON.stringify(entry) + '\n', 'utf8');
  } catch { /* never crash */ }
}

export interface TaskRunResult {
  task_id: string;
  status: 'success' | 'failed' | 'blocked';
  output?: string;
  error?: string;
  duration_ms: number;
}

export async function runApprovedTask(approvalId: string): Promise<TaskRunResult> {
  const start = Date.now();
  const approval = getApprovalById(approvalId);
  const duration_ms = Date.now() - start;

  if (!approval) {
    return { task_id: approvalId, status: 'blocked', error: 'Approval not found', duration_ms };
  }
  log({ approval_id: approvalId, command: approval.auto_command ?? null, status: 'blocked', reason: 'QUARANTINED_PHASE_7A1', at: new Date().toISOString() });
  return {
    task_id: approvalId,
    status: 'blocked',
    error: 'QUARANTINED_PHASE_7A1: autonomous shell execution outside canonical governance is retired. Unrestricted shell execution is not an approved authority.',
    duration_ms,
  };
}

export async function runL1Task(command: string): Promise<TaskRunResult> {
  const taskId = 'l1_' + Date.now();
  log({ task_id: taskId, command, status: 'blocked', reason: 'QUARANTINED_PHASE_7A1', at: new Date().toISOString() });
  return {
    task_id: taskId,
    status: 'blocked',
    error: 'QUARANTINED_PHASE_7A1: autonomous shell execution outside canonical governance is retired. Unrestricted shell execution is not an approved authority.',
    duration_ms: 0,
  };
}
