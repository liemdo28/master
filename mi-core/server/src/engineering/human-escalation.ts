/**
 * Phase 34I — Human Escalation
 * Pushes approval requests and P0 escalations to CEO via WhatsApp.
 */

import { sendToCeo, queueToCeo } from '../services/whatsapp-sender';
import { getTask } from './engineering-queue';
import { getEvidence } from './evidence-engine';

export interface EscalationPayload {
  task_id:        string;
  reason:         string;
  objective:      string;
  model:          string;
  complexity:     string;
  domain:         string;
  is_p0:          boolean;
  evidence_count: number;
  review_score?:  number;
}

function buildMessage(p: EscalationPayload): string {
  const icon = p.is_p0 ? '🚨' : '⚠️';
  const lines = [
    `${icon} *Mi Engineering — Human Approval Required*`,
    ``,
    `*Task:* \`${p.task_id}\``,
    `*Objective:* ${p.objective.slice(0, 150)}`,
    `*Domain:* ${p.domain} | *Complexity:* ${p.complexity}`,
    `*Recommended Model:* ${p.model}`,
    p.review_score !== undefined ? `*Review Score:* ${p.review_score}/100` : '',
    `*Reason:* ${p.reason}`,
    `*Evidence:* ${p.evidence_count} record(s)`,
    ``,
    `Reply:`,
    `• \`approve ${p.task_id}\` — approve for auto-execution`,
    `• \`reject ${p.task_id}\` — reject task`,
    `• \`status ${p.task_id}\` — view full evidence`,
  ].filter(l => l !== '');

  return lines.join('\n');
}

export async function escalateToHuman(taskId: string, reason: string): Promise<boolean> {
  const task     = getTask(taskId);
  const evidence = getEvidence(taskId);

  if (!task) {
    queueToCeo(`⚠️ Mi Engineering: escalation requested for unknown task ${taskId}`);
    return false;
  }

  const payload: EscalationPayload = {
    task_id:        taskId,
    reason,
    objective:      task.objective,
    model:          task.routing?.model_name || task.selected_model || 'unknown',
    complexity:     task.classification?.complexity || 'unknown',
    domain:         task.classification?.domain || 'unknown',
    is_p0:          task.classification?.is_p0 || false,
    evidence_count: evidence.length,
    review_score:   task.review_score,
  };

  const message = buildMessage(payload);

  try {
    const sent = await sendToCeo(message);
    if (!sent) {
      queueToCeo(message);
    }
    return true;
  } catch {
    queueToCeo(message);
    return false;
  }
}

export async function notifyTaskComplete(taskId: string, status: 'DONE' | 'FAILED'): Promise<void> {
  const task = getTask(taskId);
  if (!task) return;

  const icon = status === 'DONE' ? '✅' : '❌';
  const msg = [
    `${icon} *Engineering Task ${status}*`,
    `Task: \`${taskId}\``,
    `Objective: ${task.objective.slice(0, 100)}`,
    `Model: ${task.routing?.model_name || task.selected_model}`,
  ].join('\n');

  queueToCeo(msg);
}

export async function notifyP0(taskId: string, objective: string): Promise<void> {
  const msg = [
    `🚨 *P0 ESCALATION — Immediate Human Required*`,
    `Task: \`${taskId}\``,
    `Objective: ${objective.slice(0, 200)}`,
    `Action: Mi has halted auto-execution. Review and approve manually.`,
  ].join('\n');

  try {
    await sendToCeo(msg);
  } catch {
    queueToCeo(msg);
  }
}
