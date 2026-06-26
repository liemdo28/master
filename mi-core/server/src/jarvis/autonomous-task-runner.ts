/**
 * Autonomous Task Runner — executes approved safe actions without human touch.
 * Only L1 tasks run automatically; L2/L3 require resolved approval.
 * All runs are logged; failures do not retry automatically.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { getApprovalById } from './approval-conversation';
import { appendFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';

const execAsync = promisify(exec);
const LOG_DIR = path.join(process.env.GLOBAL_DIR || 'D:/Project/Master/.local-agent-global', 'jarvis');
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

// Allowlist for autonomous L1 commands
const L1_COMMANDS_ALLOWLIST = [
  /^docker info$/,
  /^docker ps$/,
  /^curl -s http:\/\/127\.0\.0\.1:\d+\/api\//,
];

function isL1Safe(command: string): boolean {
  return L1_COMMANDS_ALLOWLIST.some(re => re.test(command.trim()));
}

export async function runApprovedTask(approvalId: string): Promise<TaskRunResult> {
  const start = Date.now();
  const approval = getApprovalById(approvalId);

  if (!approval) {
    return { task_id: approvalId, status: 'blocked', error: 'Approval not found', duration_ms: 0 };
  }
  if (approval.status !== 'approved') {
    return { task_id: approvalId, status: 'blocked', error: `Approval status: ${approval.status}`, duration_ms: 0 };
  }
  if (!approval.auto_command) {
    return { task_id: approvalId, status: 'blocked', error: 'No auto_command defined', duration_ms: 0 };
  }

  try {
    const { stdout, stderr } = await execAsync(approval.auto_command, { timeout: 60_000, cwd: 'D:/Project/Master/mi-core' });
    const duration_ms = Date.now() - start;
    log({ approval_id: approvalId, command: approval.auto_command, status: 'success', duration_ms, at: new Date().toISOString() });
    return { task_id: approvalId, status: 'success', output: stdout || stderr, duration_ms };
  } catch (e: unknown) {
    const duration_ms = Date.now() - start;
    const error = e instanceof Error ? e.message : String(e);
    log({ approval_id: approvalId, command: approval.auto_command, status: 'failed', error, duration_ms, at: new Date().toISOString() });
    return { task_id: approvalId, status: 'failed', error, duration_ms };
  }
}

export async function runL1Task(command: string): Promise<TaskRunResult> {
  const start = Date.now();
  const taskId = 'l1_' + Date.now();

  if (!isL1Safe(command)) {
    log({ task_id: taskId, command, status: 'blocked', reason: 'not_in_allowlist', at: new Date().toISOString() });
    return { task_id: taskId, status: 'blocked', error: 'Command not in L1 allowlist', duration_ms: 0 };
  }

  try {
    const { stdout } = await execAsync(command, { timeout: 10_000 });
    const duration_ms = Date.now() - start;
    log({ task_id: taskId, command, status: 'success', duration_ms, at: new Date().toISOString() });
    return { task_id: taskId, status: 'success', output: stdout, duration_ms };
  } catch (e: unknown) {
    const duration_ms = Date.now() - start;
    const error = e instanceof Error ? e.message : String(e);
    log({ task_id: taskId, command, status: 'failed', error, duration_ms, at: new Date().toISOString() });
    return { task_id: taskId, status: 'failed', error, duration_ms };
  }
}
